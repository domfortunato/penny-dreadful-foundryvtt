# Changelog

Release notes for Penny Dreadful, newest first. Each `## X.Y.Z` section is the body
of that release on GitHub: `npm run release X.Y.Z` refuses to cut a release without
one, writes the section into the release tag, and the Release Creation workflow
creates the release with it. `npm run release X.Y.Z -- --dry-run` shows the exact
body before anything is written. The procedure is in [RELEASE.md](RELEASE.md).

## Unreleased

- The Director can take characters off the board and put them back: every row now has a remove button, and the toolbar gains an Add-a-character button beside Add-an-NPC (pick an off-board actor, or type a name to create one). A removed row's pending ask is withdrawn, and its return is one click
- The board's size is a dropdown of presets (100% to 200% in tens) instead of two zoom buttons, and the board now starts at 110%; a size already picked is kept

## 0.1.0

**Requires Foundry VTT 14.365 or higher.** No modules are needed.

- The scoreboard: one row per character, ten penny slots and a column for the dead; opens for everyone, can be dragged or popped out into its own window, never minimized or closed, and sized from 100% to 200% per player
- The Director issues a challenge with the DS buttons on a row; a card in chat asks the player to flip, with a Flip button (the board has one too); only the player and the Director can flip that row; the pennies are rolled as Foundry coins and the result lands in chat
- No module is required or configured. If Dice So Nice happens to be active, the board waits for its coins to land and the Director can hold each flip's coins on every screen until they clear them
- Odds of success: every DS button shows the chance for that row's pennies, and a table for every hand of 1 to 10 pennies against DS 1 to 5 ships as a journal, one click from the board
- Failures add a penny; a failure at ten pennies marks the character dead
- Spotlight: the row whose turn it is, advanced by the Director or automatically after each flip
- NPCs can be put on the board and flipped by the Director; they sit in their own section under the characters, hold five pennies at most by default, and a failure with a full hand is the end of them
- NPC Penny Limit (game settings): the Director sets the most pennies any NPC can hold, from 5 to 10, default 5
- A character actor is created for each player on first connection
- The Gamemaster role reads "The Director" and the default account is renamed
- The player-facing rules ship as a journal, one click from the board
