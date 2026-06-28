# Live MLB Scores — Stream Deck Plugin

<img src="screenshots/LiveMLBScoresThumbnail.png" width=960 height=480>


A Stream Deck plugin that shows live MLB scores directly on your buttons. Each button tracks one team and updates automatically every 30 seconds.

![Live MLB Scores Plugin](https://img.shields.io/badge/Stream%20Deck-Plugin-blue) ![Version](https://img.shields.io/badge/version-1.0.13-green)

---

## Features

- **Live scores** — shows away score, home score, and current inning while a game is in progress
- **Pre-game** — shows the matchup (e.g. `ATL @ NYM`) and scheduled start time
- **Final scores** — shows the final score with a "Final" label
- **Score-change flash** — when a team scores, the button flashes in that team's primary color
- **Browser shortcut** — press any button to open that game in MLB Gameday or MLB.tv; switches to Gameday automatically 30 minutes after the final out
- **Doubleheader support** — automatically shows Game 1, then switches to Game 2 when it ends; G1/G2 label keeps you oriented
- **Doubleheader toggle** — double-click a doubleheader button to peek at the other game; auto-reverts after 15 seconds
- **No-flicker updates** — buttons only redraw when the display actually changes
- **Multi-button support** — add as many team buttons as you want, each refreshes independently
- **All-Star Game coverage** — when your team has no game during the All-Star break, the button automatically shows the All-Star Game itself (AL in red, NL in blue) until it's over

---

## Recent Updates

**v1.0.13.0**
- During the All-Star break, a team button with no game now shows the All-Star Game instead of "No Game" — AL vs. NL score, inning, and out indicators, just like a regular game, with AL shown in red and NL in blue

**v1.0.12.0**
- Out indicators: two dots appear to the left of the inning — gray for unrecorded outs, red for recorded outs (inspired by classic out-of-town scoreboards)

**v1.0.9.0**
- After a game ends, pressing a button set to MLB.tv now opens Gameday instead — the MLB.tv link stays active for 30 minutes post-game to cover any post-game coverage, then switches automatically
- If the plugin loads and the game is already final, pressing the button goes straight to Gameday

**v1.0.8.0**
- Double-click a doubleheader button to peek at the other game — when Game 1 is active, see Game 2's start time; when Game 2 is active, see Game 1's final score
- Double-click again to snap back to the active game, or wait 15 seconds to auto-revert
- Single-clicking while viewing the other game opens that game's Gameday page
- Score changes and end-of-game fireworks always return the button to the active game view

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
- Schedule holds on the current day's games until 2am local time, so late-running games stay on the button until they finish
- Pressing a button set to MLB.tv now opens Gameday instead if the game is more than an hour from first pitch

---


## Requirements

- [Elgato Stream Deck](https://www.elgato.com/stream-deck) hardware
- [Stream Deck software](https://www.elgato.com/downloads) version 6.0 or later (Mac or Windows)
- No MLB account required for scores — the plugin uses MLB's free public stats API

---

## Installation

1. Download the latest **`Live MLB Scores.streamDeckPlugin`** from the [Releases](../../releases) page
2. Double-click the file — Stream Deck will install it automatically
3. The plugin will appear in the Stream Deck action picker under **Live MLB Scores**

---

## Setup

1. Drag the **Live MLB Scores** action onto any button
2. In the settings panel on the right, select your team from the dropdown
3. Choose what happens when you press the button:
   - **MLB Gameday (free)** — opens the game's live Gameday page in your browser
   - **MLB.tv (subscription)** — opens the game's MLB.tv broadcast page

![Settings pane](screenshots/LiveMLBScoresSettingsPane.png)

That's it. The button will load your team's game within a few seconds and refresh every 30 seconds from there.

> **Note:** If MLB.tv is selected but the game hasn't started yet (more than 60 minutes away), pressing the button will open Gameday instead. After the final out, the button continues opening MLB.tv for 30 minutes to cover post-game coverage, then automatically switches to Gameday.

---

## What the Button Shows

![Live score button](screenshots/LiveMLBScoresButtonStates.png)

**Before the game:**
```
ATL @ NYM
 7:10 PM
```

**Live game:**
```
ATL  3
NYM  1
 ▲5
```

**Final score:**
```
ATL  3
NYM  1
Final
```

**Off day:**
```
  ATL
No Game
```

---

## Supported Teams

All 30 MLB teams are supported:

| AL East | AL Central | AL West |
|---|---|---|
| Baltimore Orioles | Chicago White Sox | Houston Astros |
| Boston Red Sox | Cleveland Guardians | Los Angeles Angels |
| New York Yankees | Detroit Tigers | Oakland Athletics |
| Tampa Bay Rays | Kansas City Royals | Seattle Mariners |
| Toronto Blue Jays | Minnesota Twins | Texas Rangers |

| NL East | NL Central | NL West |
|---|---|---|
| Atlanta Braves | Chicago Cubs | Arizona Diamondbacks |
| Miami Marlins | Cincinnati Reds | Colorado Rockies |
| New York Mets | Milwaukee Brewers | Los Angeles Dodgers |
| Philadelphia Phillies | Pittsburgh Pirates | San Diego Padres |
| Washington Nationals | St. Louis Cardinals | San Francisco Giants |

---

## How It Works

The plugin polls [MLB's free public Stats API](https://statsapi.mlb.com) once every 30 seconds per button. No API key or account is required. The plugin is fully self-contained — it uses only Node.js built-in modules and requires no external dependencies.

The schedule holds on the current day's games until 2 AM local time, so late-running games stay on the button until they finish.

---

## Uninstalling

Open Stream Deck → Preferences → Plugins, select **Live MLB Scores**, and click the **−** button.

---

## Contributing

Bug reports and feature requests are welcome — open an [Issue](../../issues) to get started.

---

## Disclaimer

This plugin is not affiliated with, endorsed by, or sponsored by Major League Baseball or MLB Advanced Media, L.P. All data is sourced from the MLB Stats API and is subject to MLBAM's terms of use. This plugin is intended for individual, personal, non-commercial use only.

---

## Credits

Created by **T.J. Lauerman aka ThatSportsGamer**

Created with Claude Cowork by Anthropic

Data provided by the [MLB Stats API](https://statsapi.mlb.com)
