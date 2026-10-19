# Changelog

Full version history for Live MLB Scores, newest first. The [README](README.md) lists the three most recent updates.

**v1.0.32.0**
- Pregame keys match the NFL, CFB, NHL and NBA plugins: the teams stack on two lines (away team on top, "@ home" below, with a small "@"), then the start time. On game day it's just the teams and the time; for a later day the day gets its own gray line above the time
- Off-day keys show your team's next game the same way: the "Next Game" label is gone, and the day line reads the weekday ("Thursday"), or the date when it's a week or more away
- Doubleheaders put the game number on the day line ("Game 2")
- Postponed, canceled, suspended, delayed and warmup keys use the same stacked teams
- A postseason opponent that isn't decided yet shows its placeholder (e.g. `TB/CLE` for a World Series game) instead of "MLB"

**v1.0.31.0**
- Score flash is now 5 solid blinks of the scoring team's color with no text, so it reads at a glance even on light team colors
- New: right after the flash, a 3-second card shows the scoring team and how many runs scored (e.g. ATL / +2 RUNS), then the score returns
- Settings help text now says "key" instead of "button"

**v1.0.30.0**
- Rained-out games that MLB cancels outright now show CANC instead of a 0-0 "Final" (doubleheaders included)

**v1.0.29.0**
- Added a high-resolution (2x) plugin icon so it stays sharp on Retina/high-DPI displays
- Settings panel's Custom Link hint now mentions the link stays active for 30 minutes after the final out, then reverts to Gameday
- Custom Link URLs are also tidied up by the plugin itself (spaces trimmed, https:// added if missing, non-web links ignored) — a backstop for links saved before the settings panel started doing this
- Turned off Node debug mode for release builds

**v1.0.28.0**
- Added a "Custom Link" option to Key Press Opens — enter any URL (e.g. your regional sports network's live-game page) and the key opens Gameday until the game actually starts, then switches to your link. Falls back to Gameday if the field is left blank

**v1.0.27.0**
- Added a search box to the settings panel (matching Live CFB Scores and Live MiLB Scores) — type a team, city, or abbreviation for autocomplete instead of scrolling the Team dropdown. Picking a result still syncs the dropdown underneath, so both paths stay in sync

**v1.0.26.0**
- Added a custom key background color option (matching Live NFL Scores and Live CFB Scores) — pick a color and opacity in the settings panel instead of the default black

**v1.0.25.0**
- Fixed: pressing a key set to MLB.tv during the Warmup state (right before first pitch, including right after a rain delay clears) fell back to Gameday instead of opening the stream — MLB.tv already carries Warmup as pre-game coverage, so it now opens directly

**v1.0.24.0**
- Coming out of a rain delay, the key now shows `WARMUP` alongside the original scheduled time instead of just re-displaying that now-stale clock as if nothing happened

**v1.0.23.0**
- Fixed: a pre-game weather delay (e.g. "Delayed Start") could be misread as a mid-game delay because MLB's linescore data pre-populates a "Top 1" shell before first pitch — this in turn caused the previous fix's MLB.tv fallback check to think the game had started and open the stream early. Now checks the game's actual live/preview status instead

**v1.0.22.0**
- Fixed: pressing a key set to MLB.tv for a game delayed past its scheduled start time no longer opens the stream early — the plugin now checks the game's actual status instead of the clock, so a rain delay correctly falls back to Gameday until the game actually begins

**v1.0.21.0**
- Fixed: Gameday links now use the correct calendar date for evening games — West Coast/Mountain teams whose game time crosses into the next UTC day (e.g. a 7:10pm Denver first pitch) were getting a link one day ahead of the real game

**v1.0.20.0**
- Fixed: Gameday links now use the correct URL suffix for the game's actual state — pressing a key for a preview, delayed, postponed, or "Next Game" matchup no longer sends you to a blank `/live` page

**v1.0.19.0**
- Trimmed the "Next Game" date to just month/day (e.g. `7/25`) instead of including the day of the week — the line was running out of room on the key

**v1.0.18.0**
- Fixed: the All-Star Game could return a broken MLB.tv link on years an AL park hosts it — Gameday fallback now correctly detects the game regardless of which league is home or away
- Fixed: postponed, suspended, and pre-game delayed games now carry full team info so the Gameday link opens the correct game instead of a generic fallback URL

**v1.0.17.0**
- On off days, the key now shows your team's next scheduled game (matchup, date, and time) instead of a dead-end "No Game"

**v1.0.16.0**
- Fixed: the inning/out indicator row now stays centered when a G1 or G2 label is shown during doubleheaders

**v1.0.15.0**
- Pre-game delays now show the updated start time alongside the DELAY indicator — if the first pitch gets pushed back, the key reflects the new time within 30 seconds

**v1.0.14.0**
- Fixed: key no longer switches to "Top 1" during pre-game warmups before first pitch — the matchup and start time stay visible until the game actually begins

**v1.0.13.0**
- During the All-Star break, a team key with no game now shows the All-Star Game instead of "No Game" — AL vs. NL score, inning, and out indicators, just like a regular game, with AL shown in red and NL in blue

**v1.0.12.0**
- Out indicators: two dots appear to the left of the inning — gray for unrecorded outs, red for recorded outs (inspired by classic out-of-town scoreboards)

**v1.0.9.0**
- After a game ends, pressing a key set to MLB.tv now opens Gameday instead — the MLB.tv link stays active for 30 minutes post-game to cover any post-game coverage, then switches automatically
- If the plugin loads and the game is already final, pressing the key goes straight to Gameday

**v1.0.8.0**
- Double-click a doubleheader key to peek at the other game — when Game 1 is active, see Game 2's start time; when Game 2 is active, see Game 1's final score
- Double-click again to snap back to the active game, or wait 15 seconds to auto-revert
- Single-clicking while viewing the other game opens that game's Gameday page
- Score changes and end-of-game fireworks always return the key to the active game view

**v1.0.7.0**
- Doubleheader support: automatically shows Game 1 until it ends, then switches to Game 2
- G1/G2 label appears next to the inning indicator, start time, or final/PPD/SUSP status so you always know which game you're watching
- Game 2 start time TBD handled gracefully — shows "TBD" instead of a blank or wrong time

**v1.0.6.0**
- Updated Oakland Athletics to Athletics (ATH) to reflect team's relocation to Sacramento

**v1.0.5.0**
- Updated action and category icons to white on transparent background
- Added plugin category for Stream Deck action picker grouping

**v1.0.4.0**
- PPD and SUSP now display in red — signals the game won't happen today
- Pre-game rain delay displays DELAY in blue
- Mid-game rain delay keeps the current score visible with DELAY in blue where the inning indicator normally sits

*Note: v1.0.3 was an internal build — all changes are included here.*

**v1.0.3**
- Inning indicator and "Final" label now display in yellow
- End-of-game fireworks animation with the winning team's name and colors

**v1.0.2**
- Added custom icons

**v1.0.1**
- Schedule holds on the current day's games until 2am local time, so late-running games stay on the key until they finish
- Pressing a key set to MLB.tv now opens Gameday instead if the game is more than an hour from first pitch
