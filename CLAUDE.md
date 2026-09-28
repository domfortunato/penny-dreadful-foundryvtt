# Penny Dreadful — working notes

A Foundry VTT **14** system (id `penny-dreadful`) for Daniel Fitzpatrick's Penny
Dreadful. One mechanic: flip your pennies. Read `README.md` for what it does and
`docs/player-facing-rules.md` for the whole game.

## Versions and shape

- Target `compatibility {minimum: "14.365", verified: "14.367"}`. No shims for
  older cores. Node 24.
- Plain ES modules, no bundler, no jQuery. Sheets and the scoreboard are
  ApplicationV2 + HandlebarsApplicationMixin; every part renders exactly one root
  element. Sub-types are `TypeDataModel`s registered in `CONFIG.Actor.dataModels`;
  there is no `template.json`.
- No `socket`. Every write is made by a client that already has permission:
  the owner writes the flip result, the Director writes everything else.
- The authority on any API claim is the shipped client at
  `C:\Users\domin\foundry\app\client\**`, then foundryvtt.com.

## Rules of the repo

- **No AI-generated player-facing game text.** The rules journal is
  `docs/player-facing-rules.md` verbatim, converted by `tools/import/rules.mjs`.
  Edit the markdown, rerun `npm run import:rules`, rebuild. Never edit the YAML.
- `src/packs/` is the source of truth; `packs/` is built and gitignored. Stop
  Foundry before `npm run build:packs`.
- `npm run check` before every push: syntax, manifest, i18n and lint gates.
- `npm run dev:detach` checks the pop-out round trip. Playwright cannot fire a
  popup's unload events with `page.close()`; close it from inside with `window.close()`.
- `npm run dev:smoke` drives a live world (Director + a player) end to end with
  Playwright borrowed from `../air-bladder`; see the header of `tools/dev/e2e-smoke.mjs`.
- Licensing is two regimes (`LICENSE.txt`): game text CC BY-SA 4.0, code MIT.
- The odds journal (`tools/import/odds.mjs`) and the board's tooltips share
  `module/odds.js`; `npm run import:rules` regenerates both journals.

## Git flow

- `dev` holds all work; `master` is the released state. No hotfixes.
- History starts at one squashed commit (2026-09-25), so GitHub's first record
  is the 0.1.0 code. The 28 commits before it, whose long messages record why
  most things are the way they are, live in the private Gitea repo
  `fortunato/penny-dreadful-history` (not mirrored). Look there before
  changing something whose reason is not in this file.
- `origin` is Gitea (`fortunato/penny-dreadful`, private); Gitea push-mirrors to
  `github.com/domfortunato/penny-dreadful-foundryvtt` (public). The names differ
  on purpose: the public one says what it is. The Foundry system id stays
  `penny-dreadful` forever. The workstation has no GitHub push credentials, on
  purpose.
- Releases: `RELEASE.md`. Never tag or release on GitHub.
- After every release merge `master` back into `dev`.

## Servers

Staging is CT 125 "Misc" (`c:\Users\domin\code\foundry`, runbook
`runbooks/foundry-ct125-misc.md`):

| | Dev | Test |
|---|---|---|
| URL | http://192.168.30.125:30000 | http://192.168.30.125:30001 |
| Source | git clone of `dev` | the published GitHub release |
| Update | `scripts/deploy-system.sh 125 penny-dreadful --yes` | Setup → Game Systems → Update, after a release |

Dev is a git clone owned by `foundry` with a read-only deploy key: never run
git as root there, and never click "Update System" on it. Test is installed
from the manifest, exactly as a player installs it, so it tests the release
itself; `deploy-system.sh --app foundry-test` no longer applies to it. Its
old clone was moved to `/home/foundry/penny-dreadful-test-git-clone.moved-2026-09-25`.

Local inner loop: `C:\Users\domin\foundry\data\Data\systems\penny-dreadful` is a
junction to this folder; the local 14.365 app runs on :30000.

## Things learned the hard way (keep adding)

- ApplicationV2's close button is hard-coded in `_renderFrame`; the scoreboard
  removes it there, no-ops `close()` unless `{force: true}`, and hides it in CSS.
- THE HARD RULE ON DICE SO NICE: never required, never configured, never
  assumed. The manifest does not name it. `module/dice-hold.js` is the only
  file that mentions it, and everything there checks for it first: with it
  active, the board waits for the coins to land and the Director gets hold
  (thumbtack) and clear (broom); without it, no button, no wait, no error.
  Hold works by cancelling the module's own hide timer on every client after
  its animation completes; clear fades its canvas the way it does itself.
  History: the module was used and configured, then a DOM coin overlay with
  Foundry's skull coin icons replaced it, and Dom rejected both. Never bring
  back a system-drawn coin box.
- CHAT CARD CLASS NAMES ARE AN API. Message content is stored and re-rendered
  forever, so a stylesheet rule on a class the old cards used restyles every
  old message. Reusing `.pd-coins` for a fixed overlay parked the coin strips
  of every past flip at the top right of the screen as a black pill of dots.
  Never give a class that has shipped in a card a second meaning.
- NPCs hold the world setting `npcMaxPennies` at most (NPC Penny Limit, 5-10,
  default 5, a NumberField so core refuses anything outside the range; read by
  `NpcModel.maxPennies`) and die on a failure with a full hand; characters ten. The schema's range is ten for both so nothing
  fails to load; `prepareBaseData` folds an NPC down and every writer reads
  `system.maxPennies`, never the constant.
- A POPPED-OUT BOARD SIZES ITS WINDOW, NOT THE OTHER WAY ROUND. At detach core
  pins inline max-width/height; only `_refit()` clears them and calls
  `resizeTo`, so `_onRender` calls it when `window.windowId === id`. It measures
  the board's natural width, which is the window's own width unless the board
  is `width: max-content`, so the stylesheet says so. Headless Chromium gives a
  popup a screen its own size, which caps every resize: `e2e-detach.mjs` fakes
  a large screen and checks the `resizeTo` request instead of the window.
- Windows the board opens (sheets, journals, dialogs) go through
  `renderFromBoard` / `boardWindowOptions` in `scoreboard.js`, so they appear in
  whichever browser window the board is in. They are the board's children
  only while it is popped out (core drags children into a later pop-out), and
  the board refits its window only while it is alone there (`_refit` sizes the
  window to the board and would squeeze a journal beside it).
- An NPC's hand is folded to the limit when prepared but the stored count is
  kept; the sheet's `_prepareSubmitData` drops an untouched folded count so a
  sheet edit never writes it back.
- World-setting writes and their controls (spotlight star and Next, coin hold)
  are gated on `game.user.can("SETTINGS_MODIFY")` (`canSetWorld`), not `isGM`: an Assistant
  GM is a GM the server refuses.
- The system's journals carry `flags.penny-dreadful.journal` (written by
  `journalShell` in `tools/import/journal-yaml.mjs`); `registerJournalHooks`
  adds `pd-journal` to their sheet, and the stylesheet hides Foundry's name
  field there, so the name shows once, in the window title. A flag, not a pack
  check, so an imported copy keeps it. The odds page hides its own heading
  and opens with the sidebar collapsed. Its table is 1-10 pennies by DS 1-5.
- The DS is fixed at 1-5 (`MAX_DS`), as the rules say. A Director setting to
  raise it to 10, and odds columns for DS 6-10, were tried and removed on
  Dom's ruling; `PennyActorModel.migrateData` drops a challenge left pending
  above 5 from that time, on load and create only: core migrates update
  input too (`partial`), and an update must not become a clear. Also Dom's
  ruling (2026-09-28): a DS above the row's CURRENT PENNIES cannot be asked
  (it cannot be met — the odds table shows a dash there). `issueChallenge`
  refuses it with a notice and the pill is disabled, EXCEPT the pending
  pill, which stays clickable even when pennies have since dropped below
  it: clicking the pending DS is the withdraw, and the refusal is checked
  after the withdraw branch for the same reason.
- A NUMBERFIELD CLAMPS, IT DOES NOT REJECT. In 14.365 `NumberField._cleanType`
  (`common/data/fields.mjs`) rounds a value into its min/max when cleaning,
  on load and on every write; validation only catches non-numbers. The
  data-models doc claimed the opposite for months. Writers clamp themselves
  anyway, so nothing depends on which it is.
- NEVER GIVE <body> A CLASS THE STYLESHEET USES. The player body class was
  `pd-player`, which is also the board's player-name line; its `display: block`
  landed on <body> for every player, broke Foundry's flex layout, hid the chat
  log and put the hotbar at the top. The body class is now `pd-client-player`
  and every board rule is scoped under `.pd-table`/`.pd-scoreboard`. The smoke
  test checks a player's body is still `flex` with a visible chat log.
- The board's general `.pd-scoreboard button` rule outranks a bare class, so a
  button that must look like text (the owner's name) repeats its size in a
  `.pd-scoreboard button.<class>` rule.
- Board membership is `system.onBoard` for characters and NPCs alike
  (characters start on, NPCs off; `boardGroups` filters both). The Director
  adds rows with two toolbar buttons sharing one dialog (`addToBoard(type)`,
  `templates/dialog/add-actor.html`; person-plus is the PC, `fa-user-secret`
  the NPC — Dom rejected the ghost) and removes any row with its
  `fa-user-slash` (`removeFromBoard`: a DialogV2 confirm first, then
  withdraw the chat ask, then clear challenge and `onBoard` in one update —
  nothing is deleted, and the tooltip and dialog say so, because Dom read a
  red ✕ as delete and a bare button as too easy to hit). The sheet's
  on-the-board checkbox is Director-only: membership is never the player's
  to change. The board's size control is a `<select>` of presets (100–200%
  in tens, `SCALE_DEFAULT` 110%, a magnifier as its label): a `change`
  cannot be an AppV2 action (those are click-only), so `_onRender` wires
  the fresh element on every render. The row's name is an Edit button only
  where `canFlipFor` says the row is yours — `isOwner` would leak it to a
  default grant, and to players on NPC rows.
- The Actors tab shows every actor's type as a render-time tag, "(PC-PD)" /
  "(NPC-PD)" (`registerDirectoryHooks` in actor.js, class `pd-type-tag`,
  drawn on `renderActorDirectory`): decoration only, never written into the
  name, so the board, chat cards and dialogs stay clean. On the board the
  rows sit under their own PCs / NPCs dividers. The remove confirm's title
  is per type ("Remove PC from board?"), its body is future tense with the
  name, and its buttons are Remove / Cancel — core's confirm already makes
  the no-button the default, so Enter never removes.
- The new-one-shot tool (`startNewOneShot` in director.js, the clapperboard)
  resets a world Dom reuses between one-shots. ORDER AND GUARDS ARE
  DELIBERATE (fifth review): everything is re-read AFTER the confirm (core
  deletes look ids up with `strict: true`, so a stale pre-dialog list can
  throw mid-reset); on-board NPCs are benched BEFORE the characters are
  deleted (never deleted — an NPC is the Director's prep), so a second
  GM's spotlight keeper has no row to advance onto; the chat is cleared
  LAST via `ChatMessage.deleteDocuments([], {deleteAll: true})` (core's
  `messages.flush()` would stack a second confirm; and clearing early
  turns a later failure into a half-reset); and `ensureCharacterFor` runs
  with `{force: true}`, because the clicking Director need not be
  `game.users.activeGM` and the designation guard would silently recreate
  nothing. Off-board actors live in the Actors tab; that is where
  "nothing is deleted" points.
- A character's player is assigned on its sheet, not in Foundry's ownership
  dialog: the Director's Player dropdown calls `assignPlayer` (players.js),
  which makes the chosen user the row's one explicit non-GM OWNER (other
  players' OWNER entries go; lower grants stay) and keeps Foundry's
  `user.character` pointer in step both ways, so the core player list never
  contradicts the board (that mismatch is how "it auto-assigned Player 2"
  got reported: auto-create had built the character for that player days
  earlier and it came back from off-board with its owner intact — nothing
  ever assigns on create, which a live probe confirmed). The `pdPlayer`
  field is not schema: `_processFormData` pulls it out before
  DocumentSheetV2 validates the changes with `fallback: false`. The add
  dialog names each candidate's player for the same reason.
- A challenge is asked for in chat, not in a dialog: `module/request.js` posts
  a card whose stored content is only an empty action area; the Flip button
  (or "waiting" / "flipped" / "withdrawn" / "no longer pending") is drawn per
  client at render time and redrawn on any change to the row, its deletion,
  user changes, and flip-card or request changes. The states are RECORDED,
  never guessed from what chat holds: the flip's actor write stamps
  `challenge.resolved` with the token, the flipper then marks its flip card
  `applied`, the Director marks a request `withdrawn`; flipped outranks
  withdrawn. Who may flip is one
  rule, `canFlipFor` in `flip.js`: the Director or the row's `ownerUser`,
  never another player with owner rights, and an NPC only the Director. The
  server cannot enforce it (no socket); a player could still write their own
  actor from the console, which the board shows.
