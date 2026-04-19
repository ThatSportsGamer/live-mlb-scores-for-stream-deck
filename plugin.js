/**
 * MLB Scores — Stream Deck Plugin
 * Uses Node.js built-in modules only (net, https, crypto).
 * No npm packages required.
 */

'use strict';

const net    = require('net');
const https  = require('https');
const crypto = require('crypto');
const events = require('events');
const path   = require('path');
const fs     = require('fs');

// ── Logging ───────────────────────────────────────────────────────────────────
const LOG_FILE = path.join(__dirname, 'plugin.log');
try { fs.writeFileSync(LOG_FILE, `=== MLB Plugin ${new Date().toISOString()} ===\nNode: ${process.version}\nArgs: ${process.argv.slice(2).join(' ')}\n`); } catch (e) { /* ignore */ }

function log(...args) {
    const ts   = new Date().toISOString().slice(11, 19);
    const line = `[${ts}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`;
    try { fs.appendFileSync(LOG_FILE, line); } catch (e) { /* ignore */ }
}

process.on('uncaughtException',  err => log('CRASH:', err.stack || err.message));
process.on('unhandledRejection', err => log('UNHANDLED:', String(err)));

// ── Parse Stream Deck launch arguments ────────────────────────────────────────
let sdPort, pluginUUID, registerEvent;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '-port')          sdPort        = argv[i + 1];
    if (argv[i] === '-pluginUUID')    pluginUUID    = argv[i + 1];
    if (argv[i] === '-registerEvent') registerEvent = argv[i + 1];
}

log('port=' + sdPort + ' uuid=' + pluginUUID + ' event=' + registerEvent);

if (!sdPort || !pluginUUID || !registerEvent) {
    log('ERROR: Missing required args. Stream Deck may not have launched this plugin correctly.');
    process.exit(1);
}

// ── Minimal WebSocket client (no external deps) ───────────────────────────────
class SimpleWS extends events.EventEmitter {
    constructor(port, host) {
        super();
        this.readyState  = 0; // CONNECTING
        this._buf        = Buffer.alloc(0);
        this._handshaked = false;

        this._sock = net.createConnection(parseInt(port, 10), host || '127.0.0.1');

        this._sock.on('connect', () => {
            log('TCP connected, sending WS upgrade...');
            const key = crypto.randomBytes(16).toString('base64');
            this._sock.write([
                'GET / HTTP/1.1',
                `Host: 127.0.0.1:${port}`,
                'Upgrade: websocket',
                'Connection: Upgrade',
                `Sec-WebSocket-Key: ${key}`,
                'Sec-WebSocket-Version: 13',
                '', '',
            ].join('\r\n'));
        });

        this._sock.on('data',  chunk => this._onData(chunk));
        this._sock.on('error', err   => { log('TCP error:', err.message); this.emit('error', err); });
        this._sock.on('close', ()    => { this.readyState = 3; log('TCP closed'); this.emit('close'); });
    }

    _onData(chunk) {
        this._buf = Buffer.concat([this._buf, chunk]);

        if (!this._handshaked) {
            let end = -1;
            for (let i = 0; i <= this._buf.length - 4; i++) {
                if (this._buf[i]===13 && this._buf[i+1]===10 &&
                    this._buf[i+2]===13 && this._buf[i+3]===10) { end = i + 4; break; }
            }
            if (end === -1) return;

            const header = this._buf.slice(0, end).toString('ascii');
            log('HTTP response:', header.split('\r\n')[0]);

            if (!header.includes('101')) {
                log('WS upgrade failed!');
                this.emit('error', new Error('WebSocket upgrade rejected'));
                return;
            }

            this._handshaked = true;
            this.readyState  = 1; // OPEN
            this._buf        = this._buf.slice(end);
            log('WS handshake OK');
            this.emit('open');
        }

        this._parseFrames();
    }

    _parseFrames() {
        while (this._buf.length >= 2) {
            const b0       = this._buf[0];
            const b1       = this._buf[1];
            const opcode   = b0 & 0x0f;
            const isMasked = !!(b1 & 0x80);
            let   plen     = b1 & 0x7f;
            let   offset   = 2;

            if (plen === 126) {
                if (this._buf.length < 4) return;
                plen = this._buf.readUInt16BE(2); offset = 4;
            } else if (plen === 127) {
                if (this._buf.length < 10) return;
                plen = Number(this._buf.readBigUInt64BE(2)); offset = 10;
            }

            const maskLen = isMasked ? 4 : 0;
            const total   = offset + maskLen + plen;
            if (this._buf.length < total) return;

            let payload = Buffer.from(this._buf.slice(offset + maskLen, total));
            if (isMasked) {
                const mask = this._buf.slice(offset, offset + 4);
                for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
            }
            this._buf = this._buf.slice(total);

            if      (opcode === 0x1) this.emit('message', payload.toString('utf8'));
            else if (opcode === 0x8) { this.readyState = 3; log('WS close frame'); this.emit('close'); return; }
            else if (opcode === 0x9) this._sendFrame(0x8a, payload); // pong — must echo ping payload per RFC 6455
        }
    }

    send(str) {
        if (this.readyState !== 1) { log('WARN: send() called but WS not open (state=' + this.readyState + ')'); return; }
        this._sendFrame(0x81, Buffer.from(String(str), 'utf8'));
    }

    // Write one WebSocket frame. Client frames must be masked per RFC 6455.
    _sendFrame(opcode, payload) {
        const len  = payload.length;
        const mask = crypto.randomBytes(4);
        let   hdr;

        if (len < 126) {
            hdr = Buffer.alloc(6);
            hdr[0] = opcode; hdr[1] = 0x80 | len;
            mask.copy(hdr, 2);
        } else if (len < 65536) {
            hdr = Buffer.alloc(8);
            hdr[0] = opcode; hdr[1] = 0x80 | 126;
            hdr.writeUInt16BE(len, 2);
            mask.copy(hdr, 4);
        } else {
            log('WS: payload too large (' + len + ' bytes)'); return;
        }

        const masked = Buffer.alloc(len);
        for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
        this._sock.write(Buffer.concat([hdr, masked]));
    }
}

// ── Plugin state ──────────────────────────────────────────────────────────────
const instances    = new Map(); // context -> { teamId, teamAbbr, linkType }
const prevScores   = new Map(); // context -> { awayRuns, homeRuns }
const prevState    = new Map(); // context -> last known game state string
const flashing     = new Set(); // contexts mid-flash animation
const refreshing   = new Set(); // contexts mid-async refresh
const lastRender   = new Map(); // context -> JSON key of last rendered lines
const currentGame  = new Map(); // context -> { gamePk, gameDate, homeId, awayId } | null
const refreshTimers = new Map(); // context -> intervalId (staggered per-button timers)

// ── Connect to Stream Deck ────────────────────────────────────────────────────
log('Connecting to Stream Deck on port', sdPort);
const ws = new SimpleWS(sdPort);

ws.on('open', () => {
    log('WS open — registering plugin');
    ws.send(JSON.stringify({ event: registerEvent, uuid: pluginUUID }));
});

ws.on('message', raw => {
    let ev;
    try { ev = JSON.parse(raw); } catch (e) { log('Bad JSON:', e.message); return; }
    log('← SD event:', ev.event, ev.context ? ev.context.slice(0, 8) : '');
    try { handleEvent(ev); } catch (e) { log('handleEvent crash:', e.stack || e.message); }
});

ws.on('error', err => log('WS error:', err.message));
ws.on('close', ()  => {
    log('WS closed — exiting so Stream Deck can restart');
    setTimeout(() => process.exit(0), 2000);
});

// ── Stream Deck event handler ─────────────────────────────────────────────────
function handleEvent({ event, context, payload }) {
    switch (event) {

        case 'willAppear':
            instances.set(context, (payload && payload.settings) || {});
            log('willAppear — settings:', instances.get(context));
            if (refreshTimers.has(context)) clearInterval(refreshTimers.get(context));
            refreshTimers.set(context, setInterval(() => refreshButton(context), 30_000));
            refreshButton(context);
            break;

        case 'willDisappear':
            instances.delete(context);
            prevScores.delete(context);
            prevState.delete(context);
            lastRender.delete(context);
            currentGame.delete(context);
            refreshing.delete(context);
            if (refreshTimers.has(context)) {
                clearInterval(refreshTimers.get(context));
                refreshTimers.delete(context);
            }
            break;

        case 'didReceiveSettings':
            instances.set(context, (payload && payload.settings) || {});
            log('didReceiveSettings:', instances.get(context));
            lastRender.delete(context); // force redraw with new settings
            refreshButton(context);
            break;

        case 'keyUp': {
            const cfg  = instances.get(context);
            const game = currentGame.get(context);
            if (game && game.gamePk) {
                const url = buildGameUrl(game, cfg && cfg.linkType);
                log('keyUp — opening URL:', url);
                ws.send(JSON.stringify({ event: 'openUrl', payload: { url } }));
            } else {
                log('keyUp — no game, refreshing');
                lastRender.delete(context);
                refreshButton(context);
            }
            break;
        }

        case 'sendToPlugin':
            if (payload && payload.settings) {
                instances.set(context, payload.settings);
                lastRender.delete(context);
                refreshButton(context);
            }
            break;
    }
}

// ── Refresh one button ────────────────────────────────────────────────────────
async function refreshButton(context) {
    if (refreshing.has(context)) { log('Refresh already in progress, skipping'); return; }
    if (flashing.has(context))   { log('Flash in progress, skipping refresh'); return; }

    const cfg = instances.get(context);
    if (!cfg || !cfg.teamId) {
        setButton(context, ['Select A', 'Team In', 'Settings']);
        return;
    }

    refreshing.add(context);
    log('Refreshing', cfg.teamAbbr || cfg.teamId);
    try {
        const game    = await fetchTodayGame(cfg.teamId);
        currentGame.set(context, game
            ? { gamePk: game.gamePk, gameDate: game.gameDate, startISO: game.startISO, homeId: game.homeId, awayId: game.awayId }
            : null);

        // Detect live → final transition and play fireworks
        const prevGameState = prevState.get(context);
        prevState.set(context, game ? game.state : null);
        if (prevGameState === 'live' && game && game.state === 'final') {
            const winnerIsHome = game.homeRuns >= game.awayRuns;
            const winnerId     = winnerIsHome ? game.homeId   : game.awayId;
            log('Game over — fireworks for', teamName(winnerId));
            refreshing.delete(context);
            playFireworks(context, teamName(winnerId), teamColor(winnerId)).catch(e => log('fireworks error:', e.message));
            return;
        }

        const lines   = buildLines(game, cfg);
        const spacing = lines.some(l => typeof l === 'object') ? 1.2 : 1.4;
        log('→', JSON.stringify(lines));

        // Detect score change on live games and flash in the scoring team's color
        const prev = prevScores.get(context);
        if (game && game.state === 'live') {
            prevScores.set(context, { awayRuns: game.awayRuns, homeRuns: game.homeRuns });
            if (prev) {
                const awayScored = game.awayRuns > prev.awayRuns;
                const homeScored = game.homeRuns > prev.homeRuns;
                if (awayScored || homeScored) {
                    const color = (awayScored && homeScored) ? '#FFFFFF'
                        : awayScored ? (teamColor(game.awayId))
                                     : (teamColor(game.homeId));
                    log('Score change — flashing', color);
                    refreshing.delete(context);
                    flashButton(context, color, lines, spacing).catch(e => log('flashButton error:', e.message));
                    return;
                }
            }
        } else {
            prevScores.delete(context);
        }

        setButton(context, lines, spacing);
    } catch (err) {
        log('Fetch error:', err.message);
        setButton(context, [cfg.teamAbbr || 'MLB', 'Err']);
    } finally {
        refreshing.delete(context);
    }
}

// ── Build button display lines ────────────────────────────────────────────────
function buildLines(game, cfg) {
    const abbr = cfg.teamAbbr || 'MLB';
    if (!game)                    return [abbr, 'No Game'];
    if (game.state === 'preview') return [game.matchup, game.time];
    if (game.state === 'ppd')        return [game.matchup, { text: 'PPD',   fs: 16, color: '#E74C3C' }];
    if (game.state === 'susp')       return [game.matchup, { text: 'SUSP',  fs: 16, color: '#E74C3C' }];
    if (game.state === 'delay')      return [game.matchup, { text: 'DELAY', fs: 14, color: '#3498DB' }];
    if (game.state === 'delay-live') return [
        { text: game.awayAbbr + ' ' + game.awayRuns, fs: 18 },
        { text: game.homeAbbr + ' ' + game.homeRuns, fs: 18 },
        { text: 'DELAY',                              fs: 14, color: '#3498DB' },
    ];
    if (game.state === 'live')    return [
        { text: game.awayAbbr + ' ' + game.awayRuns, fs: 18 },
        { text: game.homeAbbr + ' ' + game.homeRuns, fs: 18 },
        { text: game.half + game.inn,                fs: 14, color: '#FFD700' },
    ];
    if (game.state === 'final')   return [
        { text: game.awayAbbr + ' ' + game.awayRuns, fs: 18 },
        { text: game.homeAbbr + ' ' + game.homeRuns, fs: 18 },
        { text: 'Final',                              fs: 14, color: '#FFD700' },
    ];
    return [abbr, '---'];
}

// ── Team data (abbr, URL slug, primary color) ─────────────────────────────────
const TEAMS = {
    108: { abbr: 'LAA', slug: 'angels',     color: '#BA0021', name: 'Angels'       },
    109: { abbr: 'ARI', slug: 'd-backs',    color: '#A71930', name: 'D-backs'      },
    110: { abbr: 'BAL', slug: 'orioles',    color: '#DF4601', name: 'Orioles'      },
    111: { abbr: 'BOS', slug: 'red-sox',    color: '#BD3039', name: 'Red Sox'      },
    112: { abbr: 'CHC', slug: 'cubs',       color: '#0E3386', name: 'Cubs'         },
    113: { abbr: 'CIN', slug: 'reds',       color: '#C6011F', name: 'Reds'         },
    114: { abbr: 'CLE', slug: 'guardians',  color: '#E31937', name: 'Guardians'    },
    115: { abbr: 'COL', slug: 'rockies',    color: '#33006F', name: 'Rockies'      },
    116: { abbr: 'DET', slug: 'tigers',     color: '#FA4616', name: 'Tigers'       },
    117: { abbr: 'HOU', slug: 'astros',     color: '#EB6E1F', name: 'Astros'       },
    118: { abbr: 'KC',  slug: 'royals',     color: '#004687', name: 'Royals'       },
    119: { abbr: 'LAD', slug: 'dodgers',    color: '#005A9C', name: 'Dodgers'      },
    120: { abbr: 'WSH', slug: 'nationals',  color: '#AB0003', name: 'Nationals'    },
    121: { abbr: 'NYM', slug: 'mets',       color: '#002D72', name: 'Mets'         },
    133: { abbr: 'OAK', slug: 'athletics',  color: '#006B3F', name: 'Athletics'    },
    134: { abbr: 'PIT', slug: 'pirates',    color: '#FDB827', name: 'Pirates'      },
    135: { abbr: 'SD',  slug: 'padres',     color: '#FFC425', name: 'Padres'       },
    136: { abbr: 'SEA', slug: 'mariners',   color: '#005C5C', name: 'Mariners'     },
    137: { abbr: 'SF',  slug: 'giants',     color: '#FD5A1E', name: 'Giants'       },
    138: { abbr: 'STL', slug: 'cardinals',  color: '#C41E3A', name: 'Cardinals'    },
    139: { abbr: 'TB',  slug: 'rays',       color: '#F5D130', name: 'Rays'         },
    140: { abbr: 'TEX', slug: 'rangers',    color: '#C0111F', name: 'Rangers'      },
    141: { abbr: 'TOR', slug: 'blue-jays',  color: '#134A8E', name: 'Blue Jays'    },
    142: { abbr: 'MIN', slug: 'twins',      color: '#D31145', name: 'Twins'        },
    143: { abbr: 'PHI', slug: 'phillies',   color: '#E81828', name: 'Phillies'     },
    144: { abbr: 'ATL', slug: 'braves',     color: '#CE1141', name: 'Braves'       },
    145: { abbr: 'CWS', slug: 'white-sox',  color: '#C4CED4', name: 'White Sox'    },
    146: { abbr: 'MIA', slug: 'marlins',    color: '#00A3E0', name: 'Marlins'      },
    147: { abbr: 'NYY', slug: 'yankees',    color: '#C4CED4', name: 'Yankees'      },
    158: { abbr: 'MIL', slug: 'brewers',    color: '#FFC52F', name: 'Brewers'      },
};

const teamAbbr  = id => TEAMS[id]?.abbr  || 'MLB';
const teamSlug  = id => TEAMS[id]?.slug  || '';
const teamColor = id => TEAMS[id]?.color || '#FFFFFF';
const teamName  = id => TEAMS[id]?.name  || teamAbbr(id);

function buildGameUrl(game, linkType) {
    if (!game || !game.gamePk) return 'https://www.mlb.com';
    const away = teamSlug(game.awayId) || 'away';
    const home = teamSlug(game.homeId) || 'home';
    if (linkType === 'tv') {
        // If the game starts more than 60 minutes from now, the stream won't be live yet.
        // Fall back to Gameday so the user still gets something useful.
        const startsIn = game.startISO ? (new Date(game.startISO) - Date.now()) : 0;
        if (startsIn > 60 * 60 * 1000) {
            log('TV requested but game is ' + Math.round(startsIn / 60000) + 'min away — falling back to Gameday');
            return `https://www.mlb.com/gameday/${away}-vs-${home}/${game.gameDate}/${game.gamePk}/live`;
        }
        return `https://www.mlb.com/tv/g${game.gamePk}`;
    }
    return `https://www.mlb.com/gameday/${away}-vs-${home}/${game.gameDate}/${game.gamePk}/live`;
}

// ── MLB Stats API ─────────────────────────────────────────────────────────────
function fetchTodayGame(teamId) {
    return new Promise((resolve, reject) => {
        const now  = new Date();
        // Don't roll to the next day's schedule until 2am — covers late-running games
        if (now.getHours() < 2) now.setDate(now.getDate() - 1);
        const date = now.getFullYear() + '-' +
                     String(now.getMonth() + 1).padStart(2, '0') + '-' +
                     String(now.getDate()).padStart(2, '0');
        const url  = 'https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=' + date +
                     '&teamId=' + teamId + '&hydrate=linescore';

        const req = https.get(url, { headers: { 'User-Agent': 'StreamDeckMLBScores/1.0' } }, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve(parseSchedule(JSON.parse(body))); }
                catch (e) { reject(e); }
            });
        });

        req.on('error', reject);
        req.setTimeout(10_000, () => { req.destroy(); reject(new Error('Request timed out')); });
    });
}

function parseSchedule(data) {
    try {
        if (!data?.dates?.length) { log('API: no dates (off day)'); return null; }

        const games = data.dates[0].games;
        if (!games?.length) { log('API: no games'); return null; }

        const g      = games[0];
        const status   = g?.status?.abstractGameState; // 'Preview' | 'Live' | 'Final'
        const detailed = g?.status?.detailedState || '';
        if (!status) { log('API: missing status'); return null; }

        const homeId = g?.teams?.home?.team?.id;
        const awayId = g?.teams?.away?.team?.id;
        if (!homeId || !awayId) { log('API: missing team IDs'); return null; }

        const homeAbr  = teamAbbr(homeId);
        const awayAbr  = teamAbbr(awayId);
        const matchup  = awayAbr + ' @ ' + homeAbr;
        const gamePk   = g.gamePk;
        // Slice date directly from ISO string — avoids timezone ambiguity
        const gameDate = g.gameDate ? g.gameDate.slice(0, 10).replace(/-/g, '/') : '2000/01/01';
        const ls       = g.linescore;

        log('API:', status, detailed, matchup, 'pk=' + gamePk);

        const startISO = g.gameDate || null;  // full ISO datetime, used for MLB.tv pre-game check

        // Special states — check detailedState first so they override abstractGameState
        if (detailed.startsWith('Postponed'))         return { state: 'ppd',   matchup, gamePk, gameDate };
        if (detailed.startsWith('Suspended'))         return { state: 'susp',  matchup, gamePk, gameDate };
        if (detailed.toLowerCase().includes('delay')) {
            // Mid-game delay: game started, show score with DELAY where inning would be
            const inn = ls?.currentInning;
            if (inn) {
                const homeRuns = ls?.teams?.home?.runs ?? 0;
                const awayRuns = ls?.teams?.away?.runs ?? 0;
                return { state: 'delay-live', matchup, homeAbbr: homeAbr, awayAbbr: awayAbr, homeId, awayId, homeRuns, awayRuns, gamePk, gameDate, startISO };
            }
            return { state: 'delay', matchup, gamePk, gameDate };
        }

        if (status === 'Preview') {
            return { state: 'preview', matchup, time: fmtTime(g.gameDate), gamePk, gameDate, startISO, homeId, awayId };
        }

        const homeRuns = ls?.teams?.home?.runs ?? 0;
        const awayRuns = ls?.teams?.away?.runs ?? 0;

        if (status === 'Final') {
            return { state: 'final', matchup, homeAbbr: homeAbr, awayAbbr: awayAbr, homeId, awayId, homeRuns, awayRuns, gamePk, gameDate, startISO };
        }

        // Live
        const inn  = ls?.currentInning || '?';
        const half = ls?.inningHalf === 'Top' ? '\u25b2' : '\u25bc';

        return { state: 'live', matchup, homeAbbr: homeAbr, awayAbbr: awayAbr, homeId, awayId, homeRuns, awayRuns, inn, half, gamePk, gameDate, startISO };

    } catch (e) {
        log('parseSchedule error:', e.message);
        return null;
    }
}

function fmtTime(iso) {
    try { return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
    catch (e) { return '?:??'; }
}

// ── SVG button renderer ───────────────────────────────────────────────────────
function escXml(s) {
    return String(s).replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Accepts an array of strings (auto-sized) or { text, fs } objects (explicit size).
function makeImage(lines, lineSpacing = 1.4, bgColor = 'black') {
    const W = 72, H = 72, PAD = 4, MAX_W = W - PAD * 2;

    const items = lines.map(l => {
        if (typeof l === 'string') {
            let fs = 16;
            while (fs > 8 && l.length * fs * 0.60 > MAX_W) fs--;
            return { text: l, fs };
        }
        return l;
    });

    const lineHeights = items.map(({ fs }) => fs * lineSpacing);
    const totalH      = lineHeights.reduce((a, b) => a + b, 0);
    let   y           = (H - totalH) / 2 + items[0].fs * 0.80;

    const rows = items.map(({ text, fs, color }, i) => {
        if (i > 0) y += lineHeights[i - 1] - items[i - 1].fs * 0.80 + fs * 0.80;
        return `<text x="36" y="${y.toFixed(1)}" text-anchor="middle" fill="${color || 'white'}" ` +
               `font-family="Helvetica Neue,Arial,sans-serif" font-size="${fs}" font-weight="600">${escXml(text)}</text>`;
    }).join('');

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="144" height="144" overflow="hidden">` +
        `<rect width="${W}" height="${H}" fill="${bgColor}"/>` +
        rows + `</svg>`;

    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

function makeFireworks(frame, winnerColor, winnerName) {
    const W = 72, H = 72;
    const cx = 36, cy = 36;
    const COLORS = [winnerColor, '#FFD700', '#FFFFFF'];

    let circles = '';
    // Overlapping burst waves every 4 frames across the full animation
    [0, 4, 8, 12, 16, 20, 24, 28, 32, 36].forEach((startFrame, burstIdx) => {
        const f = frame - startFrame;
        if (f < 0 || f >= 6) return;
        const progress = f / 5;
        const r        = 5 + progress * 28;
        const pSize    = Math.max(0.5, 3.5 - progress * 2.5);
        const opacity  = (1 - progress * 0.65).toFixed(2);
        for (let i = 0; i < 8; i++) {
            const angle = (i * 45 + burstIdx * 22.5) * Math.PI / 180;
            const px    = (cx + r * Math.cos(angle)).toFixed(1);
            const py    = (cy + r * Math.sin(angle)).toFixed(1);
            const color = COLORS[(i + burstIdx) % COLORS.length];
            circles += `<circle cx="${px}" cy="${py}" r="${pSize.toFixed(1)}" fill="${color}" opacity="${opacity}"/>`;
        }
    });

    // Throbbing text — alternates every 2 frames
    const throb   = Math.floor(frame / 2) % 2 === 0;
    const winSize = throb ? 20 : 16;

    // Auto-size team name to fit the button width
    let nameSize = 13;
    while (nameSize > 7 && winnerName.length * nameSize * 0.62 > 62) nameSize--;
    const nameY = throb ? 25 : 27;

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="144" height="144" overflow="hidden">` +
        `<rect width="${W}" height="${H}" fill="black"/>` +
        circles +
        `<text x="36" y="${nameY}" text-anchor="middle" fill="white" ` +
        `font-family="Helvetica Neue,Arial,sans-serif" font-size="${nameSize}" font-weight="700">${escXml(winnerName)}</text>` +
        `<text x="36" y="50" text-anchor="middle" fill="#FFD700" ` +
        `font-family="Helvetica Neue,Arial,sans-serif" font-size="${winSize}" font-weight="800">WIN!</text>` +
        `</svg>`;

    return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function playFireworks(context, winnerName, winnerColor) {
    if (flashing.has(context)) return;
    flashing.add(context);
    log('→ fireworks for', winnerName, winnerColor);
    try {
        for (let i = 0; i < 42; i++) {
            const img = makeFireworks(i, winnerColor, winnerName);
            ws.send(JSON.stringify({ event: 'setImage', context, payload: { image: img, target: 0 } }));
            await sleep(120);
        }
    } finally {
        flashing.delete(context);
        lastRender.delete(context);
        refreshButton(context);
    }
}

function setButton(context, lines, lineSpacing, bgColor) {
    const key = JSON.stringify(lines);
    if (!bgColor && lastRender.get(context) === key) return; // skip if unchanged
    if (!bgColor) lastRender.set(context, key);
    ws.send(JSON.stringify({ event: 'setImage', context, payload: { image: makeImage(lines, lineSpacing, bgColor), target: 0 } }));
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function flashButton(context, color, lines, spacing) {
    if (flashing.has(context)) return;
    flashing.add(context);
    log('→ flash', color);
    try {
        for (let i = 0; i < 4; i++) {
            setButton(context, lines, spacing, color);
            await sleep(200);
            setButton(context, lines, spacing, 'black');
            await sleep(200);
        }
    } finally {
        flashing.delete(context);
        setButton(context, lines, spacing, 'black');
    }
}
