# UI Strings Worksheetpenny-dreadful-foundryvtt

Foundry's AI policy (§4.1) says every UI label in a listed package must be
written by a person. This worksheet lists every piece of interface text in
Penny Dreadful, the module and the system alike (they share one strings penny-dreadful-foundryvttfile),
so you can write each one in your own words.

**How to fill it in**

- Type your wording after `Your text:` on the same line.
- Keep every `{placeholder}` exactly as shown. The code swaps in the real
  value, such as a character's name or a DS number.
- Some strings come in pairs, one for exactly 1 and one for any other number
  ("1 penny" against "3 pennies"). Write both.
- **Module only** and **System only** mark text that only one flavor shows.
  Everything else appears in both.
- Window titles and menu entries are in title case; tooltips, notices and
  hints are sentences.
- Periods: none on short text (labels, buttons, hover text, card headings,
  card status lines). Periods only on full messages: pop-up notices, dialog
  messages and setting hints. (Dom's rule, 2026-10-04.)

When you're done, tell Claude. It will proofread your wording (spelling and
grammar only), then a script copies your text into `lang/en.json`.

---

## 1. The Board Window

#### `PD.Board.Title`
Where: the board window's title bar. Everyone.
Does: names the window. It is the game's name.
Your text: Penny Dreadful

#### `PD.Board.Pcs`
Where: the divider above the player characters' rows. Everyone.
Does: labels the PC section.
Your text: Player Characters

#### `PD.Board.Npcs`
Where: the divider above the NPCs' rows. Everyone.
Does: labels the NPC section.
Your text: Non-Player Characters

#### `PD.Board.Empty`
Where: inside the board when no one has a row yet. Everyone.
Does: explains why the board is blank.
Your text: No characters on the scoreboard

#### `PD.Board.Zoom`
Where: hover text and screen-reader label of the size dropdown (100% to 200%). Everyone.
Does: names the control that makes the board bigger or smaller.
Your text: Zoom

## 2. The Board's Toolbar (hover text on the icons)

#### `PD.Board.Rules`
Where: the book icon. Everyone.
Does: opens the rules journal.
Your text: Read Penny Dreadful's rules

#### `PD.Board.Odds`
Where: the % icon. Everyone.
Does: opens the table of odds for every hand against every DS.
Your text: Odds of success

#### `PD.Board.HowTo`
Where: the ? icon. Everyone.
Does: opens the How To window.
Your text: Scoreboard instructions

#### `PD.Board.HoldCoins`
Where: the thumbtack, while it is OFF. Director only, and only with Dice So Nice active.
Does: turning it on keeps each flip's 3D coins on every screen until the Director clears them.
Your text: Hold flipped coins on every canvas

#### `PD.Board.HoldCoinsOn`
Where: the thumbtack, while it is ON.
Does: says coins are being held on every screen, and that clicking again stops it.
Your text: Holding flipped coins on every canvas

#### `PD.Board.ClearCoins`
Where: the broom, shown while coins are held. Director only, Dice So Nice only.
Does: sweeps the held coins off every screen.
Your text: Sweep flipped coins from every canvas

#### `PD.Board.Next`
Where: the skip-forward icon. Director only.
Does: moves the spotlight (the gold star) to the next row.
Your text: Spotlight next character

#### `PD.Board.AddCharacter`
Where: the person-plus icon. Director only.
Does: opens a dialog to put a PC on the board, either one already in the Actors tab or a new one by name.
Your text: Add player character

#### `PD.Board.AddNpc`
Where: the stranger (trench coat) icon. Director only.
Does: the same, for an NPC.
Your text: Add non-player character

#### `PD.Board.NewOneShot` (System only)
Where: the clapperboard. Director only.
Does: resets the world for a new one-shot: deletes every PC, clears the WHOLE chat log, takes NPCs off the board (keeping them), and makes fresh PCs for connected players. It asks first.
Your text: Delete PCs, clear chat and create new characters

#### `PD.Board.NewOneShotModule` (Module only)
Where: the clapperboard. Director only.
Does: the same, but in the module it deletes only the mini game's own chat messages, never the host campaign's.
Your text: Delete PCs, clear Penny Dreadful mini-game messages from chat and create new characters

## 3. The Board's Header Menu (⋮) (Module only, Director only)

#### `PD.Board.MiniGameStart`
Where: a menu entry, shown while the mini game is off.
Does: starts the mini game, which opens the board on every player's screen.
Your text: Start the Penny Dreadful mini-game and open the scoreboard on every canvas

#### `PD.Board.MiniGameEnd`
Where: a menu entry, shown while the mini game runs.
Does: ends it, closing the board on every screen. It asks first.
Your text: End the Penny Dreadful mini-game and close the scoreboard on every canvas

## 4. A Row on the Board

#### `PD.Board.Edit`
Where: hover text on a character's name. Only the Director, and a player on their own PC, see it.
Does: clicking the name opens the character to rename it (and, for the Director, choose its player).
Your text: Rename character

#### `PD.Board.PlayerOnline`
Where: hover text on the small player-name line under a PC's name.
Does: says the player `{name}` is connected right now.
Must keep: `{name}` (the player's account name)
Your text: {name} is online

#### `PD.Board.PlayerOffline`
Where: the same line, when that player is not connected.
Does: says `{name}` is offline.
Must keep: `{name}`
Your text: {name} is offline

#### `PD.Board.Penny`
Where: hover text on each penny slot in a row.
Does: numbers the slot (the 1st penny, the 2nd…).
Must keep: `{n}` (the slot's number)
Your text: Penny {n}

#### `PD.Board.Dead`
Where: hover text on the skull of a dead character's row.
Does: says the character is dead.
Your text: It's the end

#### `PD.Board.Challenge`
Where: hover text on a DS number button (1 to 5) on a row. Director only.
Does: clicking asks that row to flip against this DS; it also shows the chance of success.
Must keep: `{ds}` (1 to 5) and `{chance}` (a percentage, like 62.3%)
Your text: Ask to flip against DS {ds} with {chance} chance of success

#### `PD.Board.ChallengeImpossible`
Where: hover text on a greyed-out DS button. Director only.
Does: explains the DS can't be asked, because it is higher than the pennies the row holds.
Must keep: `{ds}`
Your text: DS {ds} not allowed until character has more pennies

#### `PD.Board.ClearChallenge`
Where: hover text on the DS button that is currently asked. Director only.
Does: clicking it again withdraws the ask.
Must keep: `{ds}`
Your text: Clear DS {ds}

#### `PD.Board.Flip`
Where: the Flip button, on the row and on the chat card. The row's player and the Director.
Does: flips all the row's pennies against the asked DS.
Must keep: `{ds}`
Your text: Flip against DS {ds}

#### `PD.Board.Flipping`
Where: replaces the Flip button while the coins are in the air.
Does: says a flip is in progress.
Your text: Flip in progress

#### `PD.Board.Pending`
Where: a short label on a row with an ask waiting, seen by those who can't flip it.
Does: shows which DS was asked.
Must keep: `{ds}`
Your text: Pending flip against DS {ds}

#### `PD.Board.PendingHint`
Where: hover text on that label.
Does: says the row is waiting to flip, with its chance of success.
Must keep: `{chance}`
Your text: Pending flip with {chance} chance of success

#### `PD.Board.RemovePenny`
Where: hover text on the − button. Director only.
Does: takes one penny away. On a dead row it brings the character back to life first.
Your text: Remove penny or restore character

#### `PD.Board.AddPenny`
Where: hover text on the + button. Director only.
Does: adds one penny.
Your text: Add penny

#### `PD.Board.RemoveCharacter`
Where: hover text on the slashed-person button on a PC's row. Director only.
Does: takes the PC off the board. Nothing is deleted; it stays in the Actors tab.
Your text: Remove PC from the scoreboard; nothing is deleted

#### `PD.Board.RemoveNpc`
Where: the same button on an NPC's row.
Does: the same, for an NPC.
Your text: Remove NPC from the scoreboard; nothing is deleted

#### `PD.Board.Spotlight`
Where: hover text on a row's hollow star. Director only.
Does: puts this row in the spotlight (marks whose turn it is).
Your text: Spotlight character

#### `PD.Board.SpotlightNow`
Where: hover text on the gold star of the row in the spotlight.
Does: says this row is in the spotlight now.
Your text: Spotlighted

## 5. The Chat Card That Asks for a Flip

#### `PD.Chat.RequestTitle`
Where: the card's heading, posted when the Director clicks a DS.
Does: says the Director asks `{name}` to flip against DS `{ds}`.
Must keep: `{name}` (the character) and `{ds}`
Your text: The Director asks {name} to flip against DS {ds}

#### `PD.Chat.RequestWaiting`
Where: on the card, for everyone except the player who flips (and the Director).
Does: says the ask is waiting for `{name}` to flip.
Must keep: `{name}` (the PLAYER's account name)
Your text: Waiting for {name} to flip

#### `PD.Chat.RequestWaitingDirector`
Where: the same, on an NPC's ask (only the Director flips NPCs).
Does: says it is waiting for the Director to flip.
Your text: Waiting for the Director to flip

#### `PD.Chat.RequestFlipped`
Where: on the card once the flip is done.
Does: says `{name}` has flipped.
Must keep: `{name}` (the character)
Your text: {name} has flipped

#### `PD.Chat.RequestWithdrawn`
Where: on the card when the Director clicked the DS again to cancel.
Does: says the Director withdrew the ask.
Your text: The Director withdrew the ask

#### `PD.Chat.RequestEnded`
Where: on the card when the row died, left the board or was deleted before flipping.
Does: says the ask no longer stands.
Your text: No pending flip

## 6. The Chat Card With the Flip's Result

#### `PD.Chat.FlavorOne` and `PD.Chat.Flavor`
Where: the result card's heading.
Does: says `{name}` flips `{n}` penny/pennies against DS `{ds}`. Write the 1-penny version, then the version for any other number.
Must keep: `{name}`, `{n}`, `{ds}`
Your text (1 penny): {name} flips against DS {ds} ({n} penny)
Your text (other numbers): {name} flips against DS {ds} ({n} pennies)

#### `PD.Chat.HeadsOne` and `PD.Chat.Heads`
Where: the line under the coins.
Does: counts the heads against the DS.
Must keep: `{heads}` and `{ds}`
Your text (1 head): {heads} head
Your text (other numbers): {heads} heads

#### `PD.Chat.HeadsLabel`
Where: hover text on a coin that landed heads.
Your text: Heads

#### `PD.Chat.TailsLabel`
Where: hover text on a coin that landed tails.
Your text: Tails

#### `PD.Chat.Success`
Where: the green badge on a successful flip.
Your text: Success!

#### `PD.Chat.Failure`
Where: the badge on a failed flip.
Your text: Nope!

#### `PD.Chat.FailDetail`
Where: the line under a failure.
Does: says doom comes closer and how many pennies `{name}` holds now.
Must keep: `{name}` and `{pennies}`
Your text: Doom comes closer. {name} now holds {pennies} pennies.

#### `PD.Chat.DeathDetail`
Where: the line under a failure with a full hand.
Does: says this is the end for `{name}`, who held `{pennies}` pennies.
Must keep: `{pennies}` and `{name}`
Your text: With {pennies} pennies, this is the end for {name}

## 7. Dialogs

### Adding a PC or NPC (the person-plus and stranger buttons)

#### `PD.Dialog.AddCharacterTitle`
Where: the window title when adding a PC.
Your text: Add PC

#### `PD.Dialog.AddNpcTitle`
Where: the window title when adding an NPC.
Your text: Add NPC

#### `PD.Dialog.AddCharacterPick`
Where: the label of the dropdown of PCs that are off the board.
Your text: Choose a PC

#### `PD.Dialog.AddNpcPick`
Where: the same, for NPCs.
Your text: Choose an NPC

#### `PD.Dialog.AddCharacterNone`
Where: shown instead of the dropdown when no PC is off the board.
Does: says so, and that typing a name creates a new one.
Your text: There are no PCs to add.

#### `PD.Dialog.AddNpcNone`
Where: the same, for NPCs.
Your text: There are no NPCs to add.

#### `PD.Dialog.AddCharacterNew`
Where: the label in front of the name box, for making a new PC.
Does: offers to create a new PC with the name typed.
Your text: New PC named

#### `PD.Dialog.AddNpcNew`
Where: the same, for a new NPC.
Your text: New NPC named

#### `PD.Dialog.AddPlaceholder`
Where: the grey hint inside the empty name box.
Your text: Character name

#### `PD.Dialog.AddCandidate`
Where: how an off-board PC is listed in the dropdown when it has a player.
Does: shows the character's name with its player's name.
Must keep: `{name}` (the character) and `{player}`
Your text: {name} - {player}

#### `PD.Dialog.Add`
Where: the dialog's confirm button.
Your text: Add

#### `PD.Dialog.Cancel`
Where: the Cancel button of this and every other dialog.
Your text: Cancel

### Taking a Row Off the Board (the slashed-person button)

#### `PD.Dialog.RemovePcTitle`
Where: the confirm's title, for a PC. It should read as a question.
Your text: Remove this PC from the scoreboard?

#### `PD.Dialog.RemoveNpcTitle`
Where: the same, for an NPC.
Your text: Remove this NPC from the scoreboard?

#### `PD.Dialog.RemoveBody`
Where: the confirm's message.
Does: says (in the future tense) `{name}` will leave the board; nothing is deleted; it stays in the Actors tab and can be added back.
Must keep: `{name}`
Your text: {name} will leave the scoreboard; nothing is deleted; it stays in the Actors tab and can be added back.

#### `PD.Dialog.Remove`
Where: the confirm button.
Your text: Remove

### Starting a New One-Shot (the clapperboard)

The message is built from the sentences below that apply, in this order.

#### `PD.Dialog.OneShotTitle`
Where: the confirm's title. A question.
Your text: Delete PCs, clear chat and create new characters?

#### `PD.Dialog.OneShotPcsOne` and `PD.Dialog.OneShotPcs`
Does: says how many PCs will be deleted.
Must keep: `{characters}` (the count)
Your text (1 PC): {characters} character is deleted.
Your text (other numbers): {characters} characters are deleted.

#### `PD.Dialog.OneShotChatOne` and `PD.Dialog.OneShotChat` (System only)
Does: says the whole chat log will be cleared, and how many messages.
Must keep: `{messages}`
Your text (1 message): {messages} message is cleared from chat.
Your text (other numbers): {messages} messages are cleared from chat.

#### `PD.Dialog.OneShotChatModuleOne` and `PD.Dialog.OneShotChatModule` (Module only)
Does: says only the mini game's own chat messages will be cleared, and how many.
Must keep: `{messages}`
Your text (1 message): {messages} Penny Dreadful mini-game message is cleared from chat.
Your text (other numbers): {messages} Penny Dreadful mini-game messages are cleared from chat.

#### `PD.Dialog.OneShotNpcs`
Does: says NPCs will leave the board but are kept.
Your text: NPCs will leave the scoreboard but are kept.

#### `PD.Dialog.OneShotRecreate`
Does: says each connected player will get a fresh PC. (Shown only when automatic PCs are on.)
Your text: Each connected player will get a fresh PC.

#### `PD.Dialog.OneShotHostUntouched` (Module only)
Does: reassures that the host campaign's actors and chat are left alone.
Your text: Your world's other actors and chat are left alone.

### Ending the Mini Game (Module only)

#### `PD.Dialog.EndMiniGameTitle`
Where: the confirm's title. A question.
Your text: End the Penny Dreadful mini-game?

#### `PD.Dialog.EndMiniGameBody`
Does: says every player's board will close; nothing is deleted; starting again brings the board back as it was.
Your text: Every player's scoreboard will close but nothing is deleted. Start the game again and the scoreboard will appear for you and every player.

#### `PD.Dialog.EndMiniGame`
Where: the confirm button.
Your text: End the game

## 8. Notices (pop-ups at the top of the screen)

#### `PD.Notify.CharacterCreated`
Who: the Director, when a PC was made automatically for a player.
Must keep: `{player}`
Your text: PC created for {player}.

#### `PD.Notify.Dead`
Who: whoever tries to ask for, or make, a flip for a dead character.
Must keep: `{name}`
Your text: Sorry, {name} is dead.

#### `PD.Notify.DsOverPennies`
Who: the Director, on asking a DS higher than the row's pennies.
Must keep: `{name}` and `{ds}`
Your text: Sorry, {name} can't succeed at DS {ds}.

#### `PD.Notify.NoChallenge`
Who: someone who tries to flip when no flip was asked.
Must keep: `{name}`
Your text: Sorry, the Director hasn't asked {name} to flip.

#### `PD.Notify.NotOwner`
Who: someone who tries to flip a row that isn't theirs.
Does: says only that character's player or the Director can flip.
Must keep: `{name}`
Your text: Sorry, this isn't your flip.

#### `PD.Notify.AlreadyResolved`
Who: someone whose flip arrived after the ask was already answered (two people clicked at once).
Must keep: `{name}`
Your text: {name} flipped too late.

#### `PD.Notify.FlipNotRecorded`
Who: a player, when the flip reached chat but the board could not record it (a rare connection hiccup).
Does: tells them to ask the Director to check the pennies.
Must keep: `{name}`
Your text: Sorry, {name}'s flip is in chat but isn't on the scoreboard. Ask the Director to check {name}'s pennies.

#### `PD.Notify.FlipNotRecordedDirector`
Who: the Director, in the same case.
Does: tells the Director to check the pennies.
Must keep: `{name}`
Your text: Director, check {name}'s pennies.

#### `PD.Notify.JournalMissing`
Who: anyone, if the rules or odds journal is missing from the compendium.
Must keep: `{name}` (the journal's name)
Your text: Sorry, can't open {name}.

#### `PD.Notify.MiniGameStillRunning` (Module only)
Who: the Director, after cancelling End.
Does: confirms the game is still running.
Your text: The Penny Dreadful mini-game is running.

#### `PD.Notify.ModuleInSystemWorld` (Module only)
Who: the GM, if the module is enabled in a world that already runs the Penny Dreadful system.
Does: says the module stays off there because the system already plays the game, and to disable it in Manage Modules.
Your text: The Penny Dreadful mini-game must stay disabled in a world running the Penny Dreadful system.

## 9. Settings (Configure Settings → Penny Dreadful)

#### `PD.Settings.AutoCreate.label`
Does: names the switch for making PCs for players automatically.
Your text: Create a PC for each connected player

#### `PD.Settings.AutoCreate.hint` (System only)
Does: explains: when a player connects without a character, one named after them is made and put on the board.
Your text: Each connected player who has no PC will get one named after them.

#### `PD.Settings.AutoCreate.hintModule` (Module only)
Does: explains: while the mini game runs, each player without a PC gets one named after them, on the board.
Your text: While the game is running, each connected player who has no PC will get one named after them.

#### `PD.Settings.MiniGame.label` (Module only)
Does: names the switch that starts and ends the mini game.
Your text: Penny Dreadful mini-game running

#### `PD.Settings.MiniGame.hint` (Module only)
Does: explains: on opens the board on every screen, off closes it everywhere; it's the same switch as Start/End in the board's ⋮ menu; the coins can start the game but never end it.
Your text: Start the game and the scoreboard will appear for you and every player. Every player's scoreboard will close when the game ends, but nothing is deleted.

#### `PD.Settings.NpcMaxPennies.label`
Does: names the setting for the most pennies an NPC can hold.
Your text: NPC Penny Limit

#### `PD.Settings.NpcMaxPennies.hint`
Does: explains: 5 to 10, applies to every NPC, and a failure while holding that many is the end of the NPC.
Your text: Penny limit for every NPC, range 5 to 10. Failing a check at this limit means that it's the end for the NPC.

#### `PD.Settings.ShowHowTo.label`
Does: names the per-person switch to show the How To at every startup.
Your text: Open scoreboard instructions at every start

#### `PD.Settings.ShowHowTo.hint`
Does: explains: the How To opens by itself the first time you join; tick this (or "Show this next time" in its window) to see it every time; the board's ? button opens it any time.
Your text: The scoreboard instructions open by themselves the first time you join. Tick this to see them every time.

#### `PD.Keybind.Scoreboard`
Where: Configure Controls, the name of the Alt+B shortcut.
Does: opens the board.
Your text: Open Penny Dreadful scoreboard

## 10. The Character Sheet (click a name on the board)

#### `PD.Sheet.Name`
Where: the label of the name field.
Your text: Character name

#### `PD.Sheet.Player`
Where: the label of the player dropdown.
Your text: Player

#### `PD.Sheet.PlayerNone`
Where: the dropdown's choice for no player. Director only.
Your text: No player

#### `PD.Sheet.NoPlayer`
Where: shown to players instead of the dropdown when the character has no player.
Your text: No player

#### `PD.Sheet.Pennies`
Where: the label of the pennies field.
Your text: Pennies

#### `PD.Sheet.Dead`
Where: the label of the dead checkbox.
Your text: Dead

#### `PD.Sheet.OnBoard`
Where: the label of the on-the-board checkbox. Director only.
Your text: On the scoreboard

#### `PD.Sheet.Label`
Where: Foundry's sheet chooser (a character's ⋮ → Sheet), the name of our sheet.
Your text: Penny Dreadful

## 11. The How To Window

#### `PD.HowTo.Title`
Where: the window's title bar. Also the compendium journal's name.
Your text: Scoreboard Instructions

#### `PD.HowTo.ShowNextTime`
Where: the checkbox at the bottom.
Your text: Open at every start

#### `PD.HowTo.Close`
Where: the button at the bottom.
Your text: Close

## 12. Names Foundry Shows Elsewhere

#### `PD.Controls.MiniGame` (Module only)
Where: hover text on the coins in the Token controls, while the game is off. Director only.
Does: says clicking starts the mini game, opening the board on every screen.
Your text: Start the Penny Dreadful mini-game and open the scoreboard on every canvas

#### `PD.Controls.ScoreboardModule` (Module only)
Where: the same coins, while the game runs, and for players.
Does: says clicking opens the Penny Dreadful board.
Your text: Open Penny Dreadful scoreboard

#### `PD.Controls.Scoreboard` (System only)
Where: the same coins in a Penny Dreadful world.
Your text: Open Penny Dreadful scoreboard

#### `TYPES.Actor.penny-dreadful-module.character` (Module only)
Where: Foundry's Create Actor dialog, the type list, beside the host system's own types.
Does: names our PC type and says it is Penny Dreadful's.
Your text: PC (Penny Dreadful)

#### `TYPES.Actor.penny-dreadful-module.npc` (Module only)
Where: the same, for our NPC type.
Your text: NPC (Penny Dreadful)

#### `PD.Directory.PcTag`
Where: the Actors tab, after each Penny Dreadful PC's name. Your convention from 2026-09-27.
Your text: (PC-PD)

#### `PD.Directory.NpcTag`
Where: the same, after each NPC's name. Your convention.
Your text: (NPC-PD)

#### `PD.ActorFolder`
Where: the Actors tab, the name of the folder new PCs and NPCs go into.
Your text: Penny Dreadful

#### `PD.Pack.rules`
Where: the Compendium tab, the name of the compendium holding the rules, odds and How To.
Your text: Rules

#### `PD.Director` (System only)
Where: the GM role's name in the player list, and the renamed GM account. The rules call the GM "The Director".
Your text: The Director

#### `PD.AssistantDirector` (System only)
Where: the Assistant GM role's name.
Your text: Assistant Director

---

## Other Text You Need to Write

These aren't in the strings file, but the same rule applies.

- **The listing's description** on foundryvtt.com (§4.5 says it must be
  human-written), and the matching `description` in `module.json`.
- **The odds journal**: its title and its one sentence under the title,
  which says what the table shows (the chance that a flip's heads meet or
  beat the DS).
- **The How To**, `docs/how-to-module.md`: the sentences Claude added while
  checking your draft for facts. Rewrite them in your words, or tell Claude
  which facts you want and write them yourself. The facts it added were:
  - In Penny Dreadful the GM is called the Director. In the module, Foundry's
    GM role keeps its name.
  - Dice So Nice isn't required. With it, pennies tumble on every screen,
    and the board gains the hold and clear buttons.
  - The coins do nothing without an active scene.
  - Only a connected player with no Penny Dreadful character gets one. Anyone
    who connects while the game runs gets one too.
  - The coins never end the game. Ending asks first.
  - A DS higher than the row's pennies can't be asked, because it couldn't be met.
  - The skip-forward button spotlights the next row.
  - NPCs also go in the Penny Dreadful folder, marked (NPC-PD).
  - Click a name on the board to open it, pick the player or rename it (25
    characters at most).
  - Hold and clear need Dice So Nice.
  - The clapperboard asks first.
  - The links to the rules, the odds table and the players' section.
- **The system's How To**, `docs/how-to-system.md`. It ships too: both guides
  are pages of the one "How to Play Penny Dreadful" journal in the
  compendium, which the module includes. Rewrite it, or tell Claude to drop
  the system page from the journal.
