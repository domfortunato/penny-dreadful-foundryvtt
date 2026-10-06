# Changelog

Release notes for Penny Dreadful, newest first. Each `## X.Y.Z` section is the body
of that release on GitHub: `npm run release X.Y.Z` refuses to cut a release without
one, writes the section into the release tag, and the Release Creation workflow
creates the release with it. `npm run release X.Y.Z -- --dry-run` shows the exact
body before anything is written. The procedure is in [RELEASE.md](RELEASE.md).

## 0.3.1

- **How to Play Penny Dreadful**: a short guide opens by itself the first time each person joins. In the module, the Director sees it at startup and each player sees it when the mini game opens their board. Tick "Show this next time" to see it at every startup. The board's new ? button opens it any time, and it links to the rules, the odds table and its own players' section. The same guide ships in the compendium as a journal, with one page for the system and one for the module
- The system's board now closes like any window, with its X or Escape. The coins in the Token controls or Alt+B bring it back. Closing a popped-out board's window now closes the board instead of moving it back to the main window. The board works the same in the system and the module
- New PCs and NPCs go into a *Penny Dreadful* folder in the Actors tab instead of the root. Actors already in a world stay where they are, and a folder you pick when creating an actor is kept
- A character's name (PC or NPC) is at most 25 characters, however it is named: the sheet, the add dialog, Foundry's create dialog, a sidebar rename, or a PC created for a player with a long account name. Names given before this release stay as they are until they are next edited
- Module: starting and ending the mini game moved to the board's header menu (⋮). It works without an active scene: Alt+B opens your board at any time, and the switch is also in Configure Settings → Penny Dreadful Mini Game Running. Ending asks first, and a cancelled end says the game is still running
- Module: the coins in the Token controls never end the game. They start a stopped game for the Director and otherwise bring your board back, so closing your own board and clicking the coins no longer offers to end the game for everyone
- Module: players get a PC automatically while the mini game runs: everyone connected when it starts, and anyone who connects while it is running. Nothing is created in your campaign while the game is off
- Module review fixes: the host system's own actor type labels ("Player Character", "Non-Player Character") are no longer overwritten; a mini-game PC is never made a player's primary character, so their ordinary chat in your campaign is not spoken as it; the module steps aside, with a notice to the GM, in a world that already runs the Penny Dreadful system; the one-shot confirm reads as whole sentences and promises fresh PCs only when they will be made

## 0.3.0

- Penny Dreadful now also ships as a mini-game **module** (id penny-dreadful-module), for running a one-shot interlude inside any other system's world. Enable it in a world and the Referee starts and ends the mini game with the coin button in the token toolbar: the scoreboard opens on every screen and closes everywhere when the interlude ends. As a guest the module behaves itself — the board is an ordinary closable window (Alt+B reopens it), no characters are created unless that is turned on in its settings, its "new one-shot" reset deletes only the mini game's own actors and chat messages, its PCs and NPCs appear in the Actors tab as clearly labelled types beside the host's (which are never tagged or touched), and the host's GM labels stay its own. Install it from Setup → Add-on Modules: https://github.com/domfortunato/penny-dreadful-module-foundryvtt/releases/latest/download/module.json
- Internal restructuring for the split (no change to how the system plays): the system no longer subclasses Actor — its update guards run as a hook, its data models merge into Foundry's map instead of replacing it, and the actor type names live in one constants file. One release now versions both packages, and each GitHub repo builds only its own flavor from the shared tag

## 0.2.1

- The Director can no longer ask for a DL higher than the pennies a row holds — such a flip cannot be met. The button is greyed out with a tooltip saying why, and the pending DL stays clickable so it can still be withdrawn even after pennies drop below it
- Review fixes: the one-shot reset clears the spotlight before touching any row, so a spotlight sitting on an NPC no longer hops onto a character mid-reset (and, with two Directors connected, can no longer survive the reset pointing at a deleted one); notices show character names exactly as typed, even names with angle brackets; the reset confirm formats its message and character counts for the reader's locale

## 0.2.0

- The Director can take characters off the board and put them back: every row now has a remove button, and the toolbar gains an Add-a-character button beside Add-an-NPC (pick an off-board actor, or type a name to create one). A removed row's pending ask is withdrawn, and its return is one click. Nothing is ever deleted, and the tooltips say so
- The character sheet's Player line is now a dropdown for the Director: pick a player (or "No player") and the row is theirs — ownership moves, the board shows their name, and Foundry's own character assignment follows. One player can own several characters. A new character starts with no player
- The add dialog names the player attached to an off-board character, e.g. "Victor (Player2)", so a returning row is no surprise
- Taking a row off the board asks first: "Remove PC from board?" (or NPC), a body that says the actor will stay in the Actors tab, and Remove/Cancel buttons with Cancel as the default
- The board's rows sit under their own PCs and NPCs headers, and the Actors tab labels every actor (PC-PD) or (NPC-PD) — a display label only, the name itself stays clean
- New one-shot: a clapperboard on the board resets the world for the next session — one confirm, then every PC is deleted, the chat log is cleared, NPCs leave the board but are kept, and fresh characters are created for connected players
- The board's icons say what they do: person-plus adds a PC, a slashed person takes a row off, the stranger in the trench coat adds an NPC, and a magnifier labels the size dropdown
- A row's name reads "Edit" on hover and is a button only for the Director and the row's own player; other players (and every player on an NPC row) see plain text
- The board's size is a dropdown of presets (100% to 200% in tens) instead of two zoom buttons, and the board now starts at 110%; a size already picked is kept
- Review fixes: the one-shot reset works when the Director who clicks is not Foundry's designated GM, re-reads the world after its confirm, benches NPCs before deleting PCs and clears the chat last, so an interrupted reset can no longer leave a half-cleared world; a renamed character with markup-like text displays correctly in the remove confirm; the size dropdown keeps keyboard focus between steps and formats its percentages like the odds do; assorted translation-readiness fixes ("1 messages", hand-built labels, PC/character wording unified)

## 0.1.0

**Requires Foundry VTT 14.365 or higher.** No modules are needed.

- The scoreboard: one row per character, ten penny slots and a column for the dead; opens for everyone, can be dragged or popped out into its own window, never minimized or closed, and sized from 100% to 200% per player
- The Director issues a challenge with the DL buttons on a row; a card in chat asks the player to flip, with a Flip button (the board has one too); only the player and the Director can flip that row; the pennies are rolled as Foundry coins and the result lands in chat
- No module is required or configured. If Dice So Nice happens to be active, the board waits for its coins to land and the Director can hold each flip's coins on every screen until they clear them
- Odds of success: every DL button shows the chance for that row's pennies, and a table for every hand of 1 to 10 pennies against DL 1 to 5 ships as a journal, one click from the board
- Failures add a penny; a failure at ten pennies marks the character dead
- Spotlight: the row whose turn it is, advanced by the Director or automatically after each flip
- NPCs can be put on the board and flipped by the Director; they sit in their own section under the characters, hold five pennies at most by default, and a failure with a full hand is the end of them
- NPC Penny Limit (game settings): the Director sets the most pennies any NPC can hold, from 5 to 10, default 5
- A character actor is created for each player on first connection
- The Gamemaster role reads "The Director" and the default account is renamed
- The player-facing rules ship as a journal, one click from the board
