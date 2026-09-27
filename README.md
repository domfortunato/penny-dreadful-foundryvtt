# Penny Dreadful for Foundry VTT

A Foundry VTT system for **Penny Dreadful**, a horror-movie game by
[Daniel Fitzpatrick](https://baphelon.itch.io/) with exactly one mechanic:
flip your pennies.

The Game Master is **The Director**. Every player starts with one penny. When the
Director asks for a check or a save they name a Difficulty Score (1 to 5); the
player flips every penny they hold, heads count 1, and meeting the DS is a
success. A failure adds a penny. A failure with ten pennies is the end of that
character. NPCs play by the same rule with a smaller hand: five pennies at
most by default, and a failure with a full hand is the end of them. The
Director can set the NPC hand anywhere from five to ten in the game settings
(NPC Penny Limit); it applies to every NPC.

There are no character sheets. There is a scoreboard.

## What the system does

- **The scoreboard**: a compact, semi-transparent window that opens for everyone.
  One row per character, ten penny slots, an eleventh column for the dead. Players
  can drag it or pop it out into its own browser window; nobody can minimize or
  close it. A size dropdown (100% to 200%, starting at 110%) resizes it for
  whoever picks. A book icon opens the rules.
- **Who flips**: only the Director and the row's own player can flip a row's
  pennies; an NPC is the Director's alone. Everyone else sees "waiting".
- **The Director's controls**: DS buttons 1 to 5 on each row issue a challenge;
  minus and plus adjust pennies; a star marks whose turn it is and a Next arrow
  advances it; characters and NPCs can be taken off the board (nothing is
  deleted) and added back or created by name from the toolbar. Each
  character's sheet has a Player dropdown that gives the row to a player —
  one player can own several characters. NPCs sit in their own section under
  the characters with a slot for each penny they can hold.
- **The flip**: the Director's request lands in chat as a card with a Flip
  button; the player flips from the card or from the board, and the pennies are
  rolled as Foundry coins. The result lands in chat as a card of copper cents
  and the board updates itself. No module is needed or configured.
- **If Dice So Nice happens to be active** (it is never required): the coins
  fly as that module's coins, the board waits for them to land, and the
  Director gets a thumbtack that holds each flip's coins on every screen
  until a broom button clears them.
- **The odds**: every DS button shows the chance of success for that row's
  pennies, and a percent button opens a table for every hand of 1 to 10
  pennies against every DS from 1 to 5.
- **The Director**: the Gamemaster role is labelled "The Director" and the
  default Gamemaster account is renamed once.
- **Rows make themselves**: a character actor is created for each player the
  first time they connect (a world setting turns this off).
- **The rules**: shipped as a journal in the *Penny Dreadful* compendium folder,
  beside the odds table.

## Installing

Foundry VTT 14.365 or newer. In Setup, Game Systems, Install System, paste:

```
https://github.com/domfortunato/penny-dreadful-foundryvtt/releases/latest/download/system.json
```

## Developing

Plain ES modules, no bundler. The compendium is built from YAML:

```
npm install
npm run import:rules     # docs/player-facing-rules.md and the odds table -> src/packs/rules/*.yml
npm run build:packs      # src/packs/ -> packs/   (stop Foundry first)
npm run check            # syntax, manifest, i18n and lint gates
```

Releases are cut with `npm run release X.Y.Z` on `master`; see
[RELEASE.md](RELEASE.md).

## Credits and licences

This distribution is not under a single licence; see [LICENSE.txt](LICENSE.txt).

- **Game text** (`docs/player-facing-rules.md`, `src/packs/rules/`, and the
  built packs): Penny Dreadful (c) 2026 by Daniel Fitzpatrick is licensed under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The text
  shipped here is an adaptation for Foundry VTT under the same licence.
  Daniel Fitzpatrick wrote the game; he is not involved in this Foundry system
  and does not endorse it.
- **Code** (`module/`, `templates/`, `css/`, `lang/`, `tools/`, `system.json`):
  MIT, (c) 2026 Dom Bosco.
- Icons are [Font Awesome](https://fontawesome.com/) as bundled with Foundry VTT.
- The code was written with the help of Claude Code. No game text was generated
  by AI.
