# Penny Dreadful — design decisions and lessons

The long form of the rules in `CLAUDE.md`: what was decided, by whom, and
why. Moved here word for word from `CLAUDE.md` on 2026-10-05 so that file
stays short. Read the matching section before changing anything it covers.
Keep adding to "Things learned the hard way".

## Versions and shape

- Target `compatibility {minimum: "14.365", verified: "14.367"}`. No shims for
  older cores. Node 24.
- Plain ES modules, no bundler, no jQuery. Sheets and the scoreboard are
  ApplicationV2 + HandlebarsApplicationMixin; every part renders exactly one root
  element. Sub-types are `TypeDataModel`s MERGED into `CONFIG.Actor.dataModels`
  (`Object.assign`, never `=`); there is no `template.json`, no Actor subclass
  and no claim on `CONFIG.Actor.documentClass`: what `PDActor._preUpdate` did
  (challenge clear on dying/leaving, stale-flip refusal) is a `preUpdateActor`
  hook in actor.js, which the client runs right after `_preUpdate` on the
  initiating client, re-cleaning the changes after it so the mutation lands
  and cancelling on `false` (client-backend.mjs 238-249) — the one difference
  is that `{noHook: true}` writes (core's ownership dialog) skip it, and none
  of those touch dead/onBoard/pdFlip. The type names are `TYPE_PC`/`TYPE_NPC`
  in constants.js; no `"character"`/`"npc"` literal appears outside that file,
  because the planned module build prefixes them (de-privileging done
  2026-09-28 as module Phase A — see the module plan in project memory).
- ONE SOURCE, TWO FLAVORS (module Phase B, 2026-09-28): `system.json` boots
  `module/penny-dreadful.js`, `module.json` (id `penny-dreadful-module`)
  boots `module/penny-dreadful-module.js`; each entry is one `boot()` call
  into boot.js. constants.js detects the running flavor from its own
  `import.meta.url` (a path under `modules/penny-dreadful-module/`) at
  module-evaluation time, so top-level consumers (the add dialog's label
  map, sheet PARTS, the data-model keys) need no boot choreography. Flavor
  differences live ONLY in constants.js: `NS` (the RUNNING package id —
  settings, keybindings, runtime-written flags, `RULES_PACK`),
  TYPE_PC/TYPE_NPC (core keys a module's sub-types `<module-id>.<subtype>`,
  labels `TYPES.Actor.penny-dreadful-module.*`), the TEMPLATES root, and
  `RELABEL_GM` (a guest module never touches a host's role labels).
  `CONTENT_NS` stays "penny-dreadful" in BOTH flavors: the journals' baked
  flags are shipped content, and they are read straight off `flags` because
  `getFlag` throws on a scope that is not an installed package. The gates
  cover both manifests (`check:manifest` runs the pair and cross-checks
  version, documentTypes, ids and entries; a module pack must NOT declare
  `system` or its journals lock to a host it never requires) and
  `npm run release` bumps both versions under one tag. GUEST MANNERS
  (Phase C, module flavor only, all behind `IS_MODULE`): the board
  follows the Director's world toggle `miniGameActive` — the
  scene-control coin STARTS a stopped game for a Director who can write
  world settings and otherwise reopens your own board (Alt+B too; it
  never ends the game, see the seventh review below), ready opens the
  board only when the toggle is on, and
  `onMiniGameToggled` opens/force-closes on every client; auto-create
  is on but acts ONLY WHILE THE MINI GAME RUNS (Dom, 2026-10-03: a guest
  never seeds actors because someone connected — starting the game is the
  opt-in, and then every connected player without a PC gets one, as does
  anyone connecting while it runs; `ensureCharacterFor` checks
  `miniGameActive()`);
  the one-shot reset deletes only messages carrying our flags — never
  `deleteAll` in a host campaign — with its own dialog body and tooltip
  keys (OneShotBodyModule*, NewOneShotModule, Controls.MiniGame). The
  workflow is repo-aware (`.github/workflows/main.yml` keys the flavor on
  `github.repository`; each repo ships only its own manifest and zip) and
  `npm run dev:smoke-module` proves the module inside an air-bladder host
  world (`pd-module-host`, created and junctioned by the script itself; it
  shuts down and restores `penny-dreadful-dev` around itself). Learned
  there: `game.shutDown()` pops a confirm when another user is connected —
  close the second context first or the evaluate hangs; and a world loaded
  with the module disabled logs one EXPECTED console error per leftover
  module-typed actor (core preserves it as invalid,
  `game.actors.invalidDocumentIds`). NOT distributed yet: only the second
  Gitea→GitHub mirror (Dom's step) remains.
- No `socket`. Every write is made by a client that already has permission:
  the owner writes the flip result, the Director writes everything else.
- The authority on any API claim is the shipped client at
  `C:\Users\domin\foundry\app\client\**`, then foundryvtt.com.

## Things learned the hard way

- THE BOARD IS THE SAME IN BOTH FLAVORS (Dom, 2026-10-03): a change to the
  board's behavior lands in the system and the module alike. The only
  differences are the ones the mini game itself makes (Start/End, the
  toggle opening and force-closing every board, the coin's start). So both
  boards close like any window: the X, Escape (core's dismiss closes every
  framed app, client-keybindings.mjs:755), or closing a popped-out browser
  window; the coin and Alt+B bring them back. Until 0.3.1 the system's board
  could not close (the X removed in `_renderFrame`, `close()` refusing,
  `pd-board-fixed` hiding it in CSS, a popped-out board reopening in the
  main window); none of that is left.
- THE HARD RULE ON DICE SO NICE: never required, never configured, never
  assumed. The manifest does not name it. `module/dice-hold.js` is the only
  CODE that mentions it (the How To recommends it in Dom's own words,
  `docs/how-to-*.md`, 2026-10-04), and everything there checks for it first: with it
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
  DELIBERATE (fifth and sixth reviews): everything is re-read AFTER the
  confirm (core deletes look ids up with `strict: true`, so a stale
  pre-dialog list can throw mid-reset); the spotlight is cleared FIRST,
  because the keeper's hooks fire on the bench and on the delete — left on
  an NPC it would hop onto a PC the next step deletes, and a second GM's
  keeper could write that hop after the reset's own clear (an Assistant
  Director cannot clear it; the keeper then walks it to "" through the
  delete, NPCs benched before the characters go so it never lands on one —
  an NPC is the Director's prep, never deleted); the chat is cleared
  LAST via `ChatMessage.deleteDocuments([], {deleteAll: true})` (core's
  `messages.flush()` would stack a second confirm; and clearing early
  turns a later failure into a half-reset); and `ensureCharacterFor` runs
  with `{force: true}`, because the clicking Director need not be
  `game.users.activeGM` and the designation guard would silently recreate
  nothing. ACCEPTED RISK (sixth review): `force` also gives up that
  guard's single-writer property — with two GMs online, a player
  connecting mid-reset, or both GMs confirming at once, can get two
  characters; the window is one create round trip, no socket-free fix
  keeps the common case working, and the recovery is deleting a row.
  Off-board actors live in the Actors tab; that is where "nothing is
  deleted" points.
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
  rule, `canFlipFor` in `flip.js`: the Director or the row's `ownerUserOf`,
  never another player with owner rights, and an NPC only the Director. The
  server cannot enforce it (no socket); a player could still write their own
  actor from the console, which the board shows.
- A CHARACTER'S NAME (PC or NPC) IS AT MOST 25 CHARACTERS — Dom's rule
  for all three Penny Dreadful repos (system, module, and the web table
  in `../penny-dreadful-table`), 2026-09-28. `NAME_MAX` / `clampName` in
  constants.js (characters, not UTF-16 units, trimmed). Our sheet's name
  field and the add dialog carry `maxlength`; the safety net is a
  `preCreateActor` (updateSource) and `preUpdateActor` (changes.name) hook
  pair in actor.js, so core's create dialog, the sidebar rename and the
  auto-created PC named after a long user name are cut too. OUR TYPES
  ONLY: the module smoke proves a host actor keeps a longer name. The
  create clamp also trims `prototypeToken.name` (core copied the full name
  there in `_initializeSource`, before the hook) when it equals the actor's
  name. An actor named before the rule keeps its name until its sheet is
  next saved (the sheet submits the whole form, name included). The inputs'
  `maxlength` counts UTF-16 units, so emoji stop typing early; clampName,
  counting characters, is the rule.
- OUR NEW ACTORS GO IN A "Penny Dreadful" FOLDER in the Actors tab (Dom,
  2026-10-03, both flavors; new actors only, nothing already in a world
  moves). `actorFolder`/`ensureActorFolder` in actor.js: the Actor folder
  flagged `flags[NS].actorFolder` (a rename keeps it), else a top-level
  Actor folder already named "Penny Dreadful", adopted as it is.
  `preCreateActor` files a new actor of ours that came with no folder,
  when the folder exists (core's create dialog deletes `folder` for the
  root, so root and unspecified are one case); with none yet, a
  `createActor` hook on the creating client makes it (Folder create needs
  ASSISTANT) and moves the actor in. Our creators (`ensureCharacterFor`,
  the add dialog) call `ensureActorFolder()` first so theirs is one write,
  and the in-flight creation is memoized: the mini game's start makes a PC
  for every connected player at once and must make ONE folder. A folder
  chosen at creation is kept, compendium actors are skipped, later moves
  are never touched. Guest manners: the module makes the folder only when
  it makes one of its own actors, never at ready, and never files a host
  actor.
- SEVENTH REVIEW (2026-09-28, the module work) — guest manners it added:
  - SCENE-CONTROL TOOLS ARE DEAD WITHOUT A READY CANVAS (client
    scene-controls.mjs:593 `if (!canvas.ready) return` before any tool
    runs): no active scene, or the canvas disabled, and the coin does
    nothing. So START/END lives in the board window's ⋮ header menu
    (`_getHeaderControls`, Director only — core rebuilds the menu on every
    open, so its Start/End label is always current; Alt+B opens the board
    with the game off) and in the setting, `config: true` in Configure
    Settings, both through `setMiniGame` (scoreboard.js). Dom (2026-10-03):
    a toolbar power button was too prominent — never put Start/End back on
    the toolbar. ENDING CONFIRMS (End / Cancel), and a cancelled End says
    "still running" — Enter, Escape and the X all cancel, and Dom once
    believed he had ended a game he had only cancelled. Starting does not
    confirm; the settings form is not confirmed (it is deliberate).
  - THE COIN NEVER ENDS THE GAME (Dom, 2026-10-03). It was a toggle, and a
    Director who closed their board with its X and clicked the coin to get
    it back was asked to end the game for everyone; Cancel left the board
    shut. It is a plain BUTTON now (`directorStarts` in scoreboard.js),
    decided at click time from the real setting: a module Director who may
    write world settings STARTS a stopped game with it (one click, no
    confirm); everyone else, and a Director while the game runs, gets
    their own board back. Its tooltip says which ("Start…" / "Open…") and
    is refreshed by `onMiniGameToggled`'s reset render. Ending is only in
    the ⋮ menu and Configure Settings. Never make it a toggle again.
  - THE HOW TO (`module/how-to.js`): opens by itself only the FIRST time
    a person joins (per-user `howToSeen`), then only if they ticked "Show
    this next time" (per-user `showHowTo`, UNTICKED by default — Dom: it
    came back on every F5); the board's ? button opens it any time. Both
    settings are `scope: "user"`, so they follow the person. SOURCE IS
    `docs/how-to-{system,module}.md` — Dom's to edit; since 2026-10-04 they
    are his "Dashboard" text, one body with a flavor's own intro and
    Director notes. LINKS in them: `[t](pd:rules)` and `[t](pd:odds)` open
    the shipped journals, `[t](#for-players)` jumps to a heading of the
    same guide (headings get ids `pd-howto-<slug>`). The importer writes
    them as `a.pd-link` carrying BOTH a `data-action` (the window's AppV2
    actions openRules/openOdds/scrollTo in how-to.js) and a `data-pd-*`
    (one delegated click handler in `registerJournalHooks`, rules.js, for
    the compendium copy) — not `@UUID`, because the pack is keyed by the
    running package and both flavors ship the same journal page. An
    unknown `pd:` link or a dangling `#` anchor fails the import. `npm run
    import:howto` (also chained into `import:rules`) generates BOTH the
    window's bodies (`templates/how-to/*.html`, each flavor its own
    guide) and a compendium journal, "Scoreboard Instructions", one
    page per guide (both flavors ship the same packs, so the journal
    carries both, named for where each applies); then `npm run
    build:packs` with Foundry stopped. Never edit the generated templates
    or YAML. Who sees it by itself: everyone in the system; in the module
    the Director at ready and a player only once the game opens their
    board — never while no game runs. Interface instructions, not game
    text.
  - A MODULE'S TRANSLATIONS MERGE AFTER THE SYSTEM'S (client
    localization.mjs:292-319), so any key the module shares with a host
    overwrites the host's. The bare `TYPES.Actor.character`/`npc` labels
    live in `lang/en-system.json`, which only system.json loads;
    manifest-check fails if the module ever declares a `*-system.json`,
    and ESLint's identical-keys rule is off for those files only.
  - The module's board showed its X (a CSS rule had hidden it too); since
    2026-10-03 both flavors' boards do.
  - The module never writes `user.character` (core would speak a host
    player's ordinary chat as the mini-game PC); the system still keeps
    the pointer in step.
  - Every actor hook of ours starts with `isOurs(actor)`.
  - The module stands down at init in a Penny Dreadful SYSTEM world, with
    a GM notice (`relationships.conflicts` is schema only in 14.365).
  - The one-shot confirm is whole-sentence keys, one plural choice per
    count, and promises fresh characters only while auto-create is on.
- A notice passes the KEY plus `{format: {...}}` to `ui.notifications.*`,
  never a string pre-formatted with `t()`: for a known key core escapes the
  format values and skips `cleanHTML` (notifications.mjs:108-122), where a
  pre-formatted message is sanitized instead and a player name like
  "Bob <the Bold>" loses its markup-looking part (sixth review).
