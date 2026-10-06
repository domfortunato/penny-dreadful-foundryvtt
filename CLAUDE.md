# Penny Dreadful — working notes

A Foundry VTT **14** system (id `penny-dreadful`) for Daniel Fitzpatrick's Penny
Dreadful. One mechanic: flip your pennies. Read `README.md` for what it does and
`docs/player-facing-rules.md` for the whole game.

**`docs/decisions.md` holds the long form** of every rule below: what was
decided, by whom and why, with the core file and line behind it. Read its
section before changing anything a rule here covers, and add new lessons there,
with a one-line rule here.

## Versions and shape

- Target `compatibility {minimum: "14.365", verified: "14.368"}`. No shims for
  older cores. Node 24.
- Plain ES modules, no bundler, no jQuery. Sheets and the scoreboard are
  ApplicationV2 + HandlebarsApplicationMixin; every part renders one root element.
- Sub-types are `TypeDataModel`s merged into `CONFIG.Actor.dataModels`
  (`Object.assign`, never `=`). No `template.json`, no Actor subclass; the old
  `_preUpdate` work is a `preUpdateActor` hook in actor.js.
- No `"character"`/`"npc"` literal outside constants.js: use `TYPE_PC`/`TYPE_NPC`.
- ONE SOURCE, TWO FLAVORS: `system.json` (id `penny-dreadful`) and
  `module.json` (id `penny-dreadful-module`), each booting one `boot()` call.
  Flavor differences live ONLY in constants.js (`IS_MODULE`, `NS`,
  TYPE_PC/TYPE_NPC, TEMPLATES, `RELABEL_GM`). `CONTENT_NS` stays
  "penny-dreadful" in both; read those flags straight off `flags`.
- Module guest manners, all behind `IS_MODULE`: the board follows the world
  toggle `miniGameActive`; auto-create acts only while the mini-game runs; the
  one-shot reset deletes only our own chat messages; never write
  `user.character`; never touch a host's role labels or actors; every actor
  hook starts with `isOurs(actor)`; stand down in a Penny Dreadful SYSTEM world.
- No `socket`. Every write is made by a client that already has permission:
  the owner writes the flip result, the Director writes everything else.
- The authority on any API claim is the shipped client at
  `C:\Users\domin\foundry\app\client\**`, then foundryvtt.com.

## Rules of the repo

- **No AI-generated user-facing text** (Foundry's AI policy too). Dom writes it;
  Claude only proofreads, or builds a fix from Dom's own words with his approval.
  - Rules journal: `docs/player-facing-rules.md` → `npm run import:rules`.
  - UI strings: `docs/ui-strings.md` → `npm run import:strings` → `lang/en.json`.
  - How To: `docs/how-to-{system,module}.md` → `npm run import:howto`.
  - Never edit the generated YAML, templates or en.json by hand.
- `src/packs/` is the source of truth; `packs/` is built and gitignored. Stop
  Foundry before `npm run build:packs`.
- `npm run check` before every push: syntax, manifest, i18n and lint gates.
- Tests: `npm run dev:smoke` (system, Director + a player), `dev:smoke-module`
  (module in the `pd-module-host` world), `dev:detach` (pop-out round trip).
  Playwright is borrowed from `../air-bladder`; see each script's header.
- Licensing is two regimes (`LICENSE.txt`): game text CC BY-SA 4.0, code MIT.
- The odds journal (`tools/import/odds.mjs`) and the board's tooltips share
  `module/odds.js`; `npm run import:rules` regenerates both journals.

## Git flow

- `dev` holds all work; `master` is the released state. No hotfixes.
- History before 0.1.0 lives in the private Gitea repo
  `fortunato/penny-dreadful-history` (never mirrored). Look there before
  changing something whose reason is not recorded.
- `origin` is Gitea (`fortunato/penny-dreadful`, private); it push-mirrors to
  `penny-dreadful-foundryvtt` and `penny-dreadful-module-foundryvtt` on GitHub.
  The workstation has no GitHub push credentials, on purpose.
- Releases: `RELEASE.md`. Never tag or release on GitHub. After every release
  merge `master` back into `dev`.

## Servers

- CT 125 dev :30000: a git clone of `dev`, deployed with
  `scripts/deploy-system.sh 125 penny-dreadful --yes` from `c:\Users\domin\code\foundry`.
  Never run git as root there; never click "Update System".
- CT 125 test :30001: installed from the manifest; updated in Setup after a release.
- Local 14.365 :30000: junctions for both flavors into this folder.

## Rules learned the hard way (details in `docs/decisions.md`)

- The board is the same in both flavors; only the mini-game's own Start/End
  differs. Both boards close like any window; the coin and Alt+B reopen them.
- Dice So Nice: never required, configured or assumed; only `dice-hold.js`
  mentions it, and it checks first. Never add a system-drawn coin overlay.
- Chat-card class names are an API: never give a shipped class a new meaning.
- NPCs hold `npcMaxPennies` (5–10) at most; PCs ten. Every writer reads
  `system.maxPennies`, never the constant.
- A popped-out board sizes its window (`_refit`); windows it opens go through
  `renderFromBoard` / `boardWindowOptions`.
- World-setting writes are gated on `canSetWorld` (`SETTINGS_MODIFY`), not `isGM`.
- The DS is fixed at 1–5. A DS above the row's current pennies can't be asked,
  except clicking the pending one to withdraw it.
- A NumberField clamps; it does not reject. Writers clamp anyway.
- Never give `<body>` a class the stylesheet uses (`pd-client-player`).
- Board membership is `system.onBoard`; removing a row deletes nothing and confirms first.
- "(PC-PD)"/"(NPC-PD)" tags are render-time decoration, never written to names.
- The one-shot reset's order and guards are deliberate; read its section first.
- A player is assigned on the sheet (`assignPlayer`), never in core's ownership dialog.
- A challenge is asked in chat; its states are recorded, never guessed.
  `canFlipFor` is the one rule for who may flip.
- Names are at most 25 characters (`NAME_MAX` / `clampName`), our types only.
- New actors of ours go in the "Penny Dreadful" folder (`ensureActorFolder`).
- Scene-control tools do nothing without a ready canvas, so Start/End lives in
  the board's ⋮ menu and in Configure Settings. Never put it on the toolbar.
  The coin never ends the game; ending confirms.
- The How To opens by itself the first time only; its links are `pd:` and `#` links.
- Module translations merge after the system's: bare TYPES labels live in
  `lang/en-system.json`, which only the system loads.
- Notices pass the KEY plus `{format}` (or `{localize: true}` when there is nothing
  to fill in; 14.368 shows a bare key raw), never a string pre-formatted with `t()`.
