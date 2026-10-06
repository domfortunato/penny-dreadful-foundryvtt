import { IS_MODULE, MAX_DS, MAX_PENNIES, NS, TEMPLATES, TYPE_NPC, TYPE_PC, canSetWorld, t, warn } from "./constants.js";

/**
 * The board's size range and step: the dropdown's presets, 100% to 200% in
 * tens. 1 is the size the board was designed at; it starts a notch bigger.
 */
const SCALE_MIN = 1;
const SCALE_MAX = 2;
const SCALE_STEP = 0.1;
export const SCALE_DEFAULT = 1.1;
import { boardGroups, ownerUserOf } from "./actor.js";
import { addPenny, addToBoard, issueChallenge, removeFromBoard, removePenny } from "./challenge.js";
import { canFlipFor, flip, isFlipping } from "./flip.js";
import { clearCoinsEverywhere, coinsHeld, diceModuleAvailable, toggleHoldCoins } from "./dice-hold.js";

import { chanceOfSuccess, percent } from "./odds.js";
import { openOdds, openRules } from "./rules.js";
import { maybeShowHowTo, openHowTo } from "./how-to.js";
import { ensureCharacterFor } from "./players.js";
import { startNewOneShot } from "./director.js";
import { getSpotlight, nextSpotlight, setSpotlight } from "./spotlight.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The actor a clicked control belongs to. */
const actorFrom = (target) => game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);

/**
 * The scoreboard: everyone's pennies, on everyone's screen.
 *
 * A framed ApplicationV2 so players can drag it, pop it out into its own
 * browser window with core's Detach control, and close it. It does not
 * minimize (`window.minimizable`). It closes like any window, with its X,
 * Escape, or by closing a popped-out browser window, in BOTH flavors (Dom,
 * 2026-10-03: the board behaves the same in the system and the module; the
 * system's board was fixed open until then). The coins in the Token
 * controls and Alt+B bring it back.
 */
export class PDScoreboard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pd-scoreboard",
    classes: ["penny-dreadful", "pd-scoreboard"],
    tag: "div",
    window: {
      title: "PD.Board.Title",
      icon: "fa-solid fa-coins",
      frame: true,
      positioned: true,
      minimizable: false,
      resizable: false,
    },
    position: { width: "auto", height: "auto" },
    actions: {
      issueChallenge: PDScoreboard.#onIssueChallenge,
      addPenny: PDScoreboard.#onAddPenny,
      removePenny: PDScoreboard.#onRemovePenny,
      flip: PDScoreboard.#onFlip,
      spotlight: PDScoreboard.#onSpotlight,
      nextSpotlight: PDScoreboard.#onNextSpotlight,
      openRules: PDScoreboard.#onOpenRules,
      openOdds: PDScoreboard.#onOpenOdds,
      openHowTo: PDScoreboard.#onOpenHowTo,
      holdCoins: PDScoreboard.#onHoldCoins,
      clearCoins: PDScoreboard.#onClearCoins,
      addCharacter: PDScoreboard.#onAddCharacter,
      addNpc: PDScoreboard.#onAddNpc,
      removeFromBoard: PDScoreboard.#onRemoveFromBoard,
      newOneShot: PDScoreboard.#onNewOneShot,
      toggleMiniGame: PDScoreboard.#onToggleMiniGame,
      openSheet: PDScoreboard.#onOpenSheet,
    },
  };

  static PARTS = {
    board: { template: TEMPLATES.scoreboard },
  };

  /* --------------------------------------------------------- header menu */

  /**
   * The module Director's Start/End lives in the window's ⋮ header menu —
   * out of sight during play (Dom: a toolbar power button was too
   * prominent). Core rebuilds the menu each time it opens
   * (application.mjs `onOpen`) and localizes the label, so the entry always
   * says what a click will do. Ending asks first (setMiniGame).
   * @override
   */
  _getHeaderControls() {
    const controls = super._getHeaderControls();
    if (IS_MODULE && game.user.isGM && canSetWorld()) {
      const on = miniGameActive();
      controls.push({
        action: "toggleMiniGame",
        icon: on ? "fa-solid fa-power-off" : "fa-solid fa-play",
        label: on ? "PD.Board.MiniGameEnd" : "PD.Board.MiniGameStart",
      });
    }
    return controls;
  }

  /* ------------------------------------------------------------ position */

  #savePosition = foundry.utils.debounce((position) => {
    game.settings.set(NS, "scoreboardPosition", position).catch((err) => warn("could not save the board position:", err));
  }, 300);

  /** @override */
  _onPosition(position) {
    super._onPosition?.(position);
    if (this.window.windowId) return;
    if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
      this.#savePosition({ left: position.left, top: position.top });
    }
  }

  /* ---------------------------------------------------------------- scale */

  static get scale() {
    try {
      const v = Number(game.settings.get(NS, "scoreboardScale"));
      return Number.isFinite(v) ? Math.clamp(v, SCALE_MIN, SCALE_MAX) : SCALE_DEFAULT;
    } catch {
      return SCALE_DEFAULT;
    }
  }

  static async setScale(value) {
    const next = Math.round(Math.clamp(value, SCALE_MIN, SCALE_MAX) * 10) / 10;
    if (next === PDScoreboard.scale) return;
    await game.settings.set(NS, "scoreboardScale", next);
  }

  /**
   * The one unit every size in the stylesheet is a multiple of. Set on the
   * window element so the header scales with the content.
   * @override
   */
  async _onRender(context, options) {
    await super._onRender?.(context, options);
    this.element.style.setProperty("--pd-scale", String(PDScoreboard.scale));
    // The size dropdown. A `change`, not a click, so it cannot be an AppV2
    // action; the part is rebuilt on every render, so the fresh element gets
    // its own listener and nothing stacks.
    this.element.querySelector("select.pd-zoom-select")?.addEventListener("change", (event) => {
      PDScoreboard.setScale(Number(event.target.value) / 100)
        .catch((err) => warn("could not set the board size:", err));
    });
    // The element just changed size. In the main window, put it back inside the
    // viewport if it grew past an edge. Popped out, it is its window's primary app,
    // and core pinned max-width/height inline at detach time: only `_refit` clears
    // those and resizes the browser window, so without it the board never grows.
    // But `_refit` sizes the window to the board alone, so it runs only while
    // the board IS alone there: with a sheet, journal or dialog open beside it,
    // the window keeps the size the player gave it, as core's chat pop-out does.
    requestAnimationFrame(() => {
      if (!this.rendered) return;
      if (this.window.windowId !== this.id) {
        this.setPosition({ left: this.position.left, top: this.position.top });
        return;
      }
      const hosted = foundry.applications.detached.windows.get(this.window.windowId)?.applications;
      if (!hosted || hosted.size <= 1) this._refit();
    });
  }

  /* ------------------------------------------------------------- context */

  /** @override */
  async _prepareContext() {
    const spotlightId = getSpotlight();
    const isDirector = game.user.isGM;
    const { characters, npcs } = boardGroups();
    // Two labelled sections: the PCs, then the NPCs beneath their divider.
    const rows = [];
    if (characters.length) {
      rows.push({ section: true, id: "pcs", label: t("PD.Board.Pcs") });
      for (const actor of characters) rows.push(this.#row(actor, spotlightId));
    }
    if (npcs.length) {
      rows.push({ section: true, id: "npcs", label: t("PD.Board.Npcs") });
      for (const actor of npcs) rows.push(this.#row(actor, spotlightId));
    }
    const scale = PDScoreboard.scale;
    return {
      isDirector,
      // The module's one-shot reset touches only its own messages, and its
      // tooltip must not promise the host's chat log.
      oneShotTooltip: IS_MODULE ? "PD.Board.NewOneShotModule" : "PD.Board.NewOneShot",
      // The spotlight is a world setting: its controls show only to a Director who may write it.
      canSpotlight: isDirector && canSetWorld(),
      // Only when Dice So Nice happens to be active; never required.
      // Hold and clear write world settings, so they show only to a Director who may.
      diceModule: diceModuleAvailable() && canSetWorld(),
      holdCoins: coinsHeld(),
      rows,
      hasRows: rows.length > 0,
      // name, the widest hand of pennies, the dead, the actions
      columns: MAX_PENNIES + 3,
      // The size dropdown's presets, with the client's current one marked.
      // The label goes through the same Intl percent as the odds, so a
      // French client is not shown "62,3 %" beside "110%".
      scaleOptions: Array.from({ length: Math.round((SCALE_MAX - SCALE_MIN) / SCALE_STEP) + 1 }, (_, i) => {
        const value = Math.round((SCALE_MIN + i * SCALE_STEP) * 100);
        return { percent: value, label: percent(value / 100, game.i18n.lang), selected: value === Math.round(scale * 100) };
      }),
    };
  }

  #row(actor, spotlightId) {
    const sys = actor.system;
    const ds = sys.challenge.ds;
    const owner = ownerUserOf(actor);
    // The name is an Edit button only for whoever the row belongs to: the
    // one rule, canFlipFor. `isOwner` would leak the button to anyone with
    // owner rights (a default grant), and to players on NPC rows.
    const canEdit = canFlipFor(actor);
    const flipping = isFlipping(actor.id);
    return {
      id: actor.id,
      name: actor.name,
      isNpc: actor.type === TYPE_NPC,
      playerName: owner?.name ?? null,
      playerActive: !!owner?.active,
      playerSameAsName: !!owner && owner.name === actor.name,
      // A smaller hand shows fewer slots; its actions cell takes up the rest of the width.
      pennies: Array.from({ length: sys.maxPennies }, (_, i) => ({ n: i + 1, filled: i < sys.pennies })),
      penniesCount: sys.pennies,
      actionsSpan: 1 + MAX_PENNIES - sys.maxPennies,
      atMax: sys.atMax,
      dead: sys.dead,
      ds,
      pending: ds !== null,
      // The odds of the pending challenge, and of each DL the Director could ask for.
      chance: ds !== null ? percent(chanceOfSuccess(sys.pennies, ds), game.i18n.lang) : null,
      canEdit,
      canFlip: ds !== null && canEdit && !sys.dead && !flipping,
      flipping,
      spotlight: actor.id === spotlightId,
      // A DL above the row's pennies is out of reach and its pill is disabled,
      // except the pending one: clicking that is how the Director withdraws.
      dsOptions: Array.from({ length: MAX_DS }, (_, i) => {
        const n = i + 1;
        return {
          n,
          active: n === ds,
          impossible: n > sys.pennies,
          disabled: sys.dead || (n > sys.pennies && n !== ds),
          chance: percent(chanceOfSuccess(sys.pennies, n), game.i18n.lang),
        };
      }),
    };
  }

  /* ------------------------------------------------------------- actions */

  static async #onIssueChallenge(event, target) {
    const actor = actorFrom(target);
    if (actor) await issueChallenge(actor, Number(target.dataset.ds));
  }

  static async #onAddPenny(event, target) {
    const actor = actorFrom(target);
    if (actor) await addPenny(actor);
  }

  static async #onRemovePenny(event, target) {
    const actor = actorFrom(target);
    if (actor) await removePenny(actor);
  }

  static async #onFlip(event, target) {
    const actor = actorFrom(target);
    if (actor) await flip(actor);
  }

  static async #onSpotlight(event, target) {
    const actor = actorFrom(target);
    if (!actor || !canSetWorld()) return;
    await setSpotlight(getSpotlight() === actor.id ? "" : actor.id);
  }

  static async #onNextSpotlight() {
    if (canSetWorld()) await nextSpotlight();
  }

  static async #onOpenRules() {
    await openRules();
  }

  static async #onOpenHowTo() {
    await openHowTo();
  }

  static async #onOpenOdds() {
    await openOdds();
  }

  static async #onHoldCoins() {
    await toggleHoldCoins();
  }

  static async #onClearCoins() {
    await clearCoinsEverywhere();
  }

  static async #onAddCharacter() {
    await addToBoard(TYPE_PC);
  }

  static async #onAddNpc() {
    await addToBoard(TYPE_NPC);
  }

  static async #onRemoveFromBoard(event, target) {
    const actor = actorFrom(target);
    if (actor) await removeFromBoard(actor);
  }

  static async #onNewOneShot() {
    await startNewOneShot();
  }

  static async #onToggleMiniGame() {
    await setMiniGame(!miniGameActive());
  }

  static #onOpenSheet(event, target) {
    const actor = actorFrom(target);
    if (canFlipFor(actor)) renderFromBoard(actor.sheet);
  }
}

/* ------------------------------------------------------------- singleton */

let scoreboard = null;

/** Show the board, at the position this client last left it. */
export const openScoreboard = async () => {
  scoreboard ??= new PDScoreboard();
  const options = { force: true };
  let saved = {};
  try {
    saved = game.settings.get(NS, "scoreboardPosition") ?? {};
  } catch {
    saved = {};
  }
  if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
    options.position = { left: saved.left, top: saved.top };
  }
  return scoreboard.render(options);
};

/**
 * Is the mini game on? Module flavor only: the Director's world toggle that
 * opens the board on every client and closes it everywhere when it ends. The
 * system flavor has no such setting — there the game is always on.
 */
export const miniGameActive = () => {
  if (!IS_MODULE) return true;
  try {
    return game.settings.get(NS, "miniGameActive") === true;
  } catch {
    return false;
  }
};

/**
 * Start or end the mini game (module flavor, a Director who may write world
 * settings). The entry in the board's ⋮ header menu starts and ends it (the
 * board opens with Alt+B at any time, canvas or not — the scene-control coin
 * is dead whenever the canvas is not ready); the coin can START it but never
 * ends it; Configure Settings writes the setting directly (the settings form
 * is deliberate enough).
 *
 * ENDING ASKS FIRST (Dom, 2026-10-03): it closes every player's board
 * mid-scene. A choice, in the house style — future tense, End / Cancel,
 * and core's confirm makes Cancel the default so Enter never ends it.
 * Starting just opens boards, so it does not ask. Resolves true when the
 * game changed state.
 */
export const setMiniGame = async (active) => {
  if (!IS_MODULE || !canSetWorld() || miniGameActive() === active) return false;
  if (!active) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "PD.Dialog.EndMiniGameTitle", icon: "fa-solid fa-power-off" },
      classes: ["penny-dreadful", "pd-dialog"],
      content: `<p>${t("PD.Dialog.EndMiniGameBody")}</p>`,
      yes: { label: "PD.Dialog.EndMiniGame", icon: "fa-solid fa-power-off" },
      no: { label: "PD.Dialog.Cancel" },
      rejectClose: false,
      renderOptions: boardWindowOptions(),
    });
    if (confirmed !== true) {
      // Enter, Escape and the dialog's X all cancel (by design), so a
      // Director can miss that nothing happened — say so (Dom thought he
      // had ended a game that was still running).
      ui.notifications.info("PD.Notify.MiniGameStillRunning", { localize: true });
      return false;
    }
  }
  await game.settings.set(NS, "miniGameActive", active);
  return true;
};

/**
 * The setting's onChange, on every client: the board follows it, and the
 * coin's tooltip is re-read (a reset render re-runs getSceneControlButtons:
 * "Start…" for a Director while the game is off, "Open…" otherwise).
 *
 * On start, in the module the game is now "on" for everyone at the table:
 * every connected player without a PC gets one (ensureCharacterFor keeps it
 * to the one designated GM, and honours the auto-create setting), and a
 * player sees the How To the first time their board opens (not before — a
 * guest shows nothing while no game is running).
 */
export const onMiniGameToggled = (active) => {
  if (active) {
    openScoreboard()
      .then(() => maybeShowHowTo())
      .catch((err) => warn("the scoreboard failed to open:", err));
    for (const user of game.users) {
      if (user.active) ensureCharacterFor(user).catch((err) => warn("auto-create failed:", err));
    }
  } else if (scoreboard?.rendered) {
    scoreboard.close({ force: true }).catch((err) => warn("the scoreboard failed to close:", err));
  }
  ui.controls?.render({ reset: true });
};

/** Redraw soon. Debounced: a flip touches several documents in a row. */
export const rerenderScoreboard = foundry.utils.debounce(() => {
  if (scoreboard?.rendered) scoreboard.render();
}, 50);

/**
 * Open a window the board asked for (a sheet, a journal) where the board is.
 * Popped out, it opens as the board's child in the board's window; a plain
 * render would put it in the main window, out of sight. In the main window it
 * is an ordinary window: a child would follow the board into a later pop-out.
 */
export const renderFromBoard = (app, options = {}) => {
  if (scoreboard?.rendered && scoreboard.window.windowId) return scoreboard.renderChild(app, options);
  return app.render({ force: true, ...options });
};

/** Render options that put a dialog in the board's window when it is popped out. */
export const boardWindowOptions = () => {
  const windowId = scoreboard?.rendered ? scoreboard.window.windowId : null;
  return windowId ? { window: { windowId } } : {};
};

/** Everything the rows are made of: actors, their owners, who is online. */
export const registerScoreboardHooks = () => {
  const hooks = ["createActor", "updateActor", "deleteActor", "createUser", "updateUser", "deleteUser", "userConnected"];
  for (const hook of hooks) Hooks.on(hook, () => rerenderScoreboard());
};

/**
 * The coin, a button under Token controls: it gets you a board, and in the
 * module it starts a stopped game for the Director (see directorStarts
 * below). It never ends one. Scene-control tools only work while the
 * canvas is ready — Alt+B and the board's ⋮ menu work without one.
 */
export const registerSceneControl = () => {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tools = controls?.tokens?.tools;
    if (!tools) return;
    // In a host campaign the tool must say WHOSE board this is (Dom's
    // ruling: the tooltip names Penny Dreadful); in our own system the
    // plain "Scoreboard" is the whole world's one board. The title is read
    // here, so onMiniGameToggled re-renders the controls on every change.
    tools.pdScoreboard = {
      name: "pdScoreboard",
      icon: "fa-solid fa-coins",
      order: Object.keys(tools).length,
      visible: true,
      button: true,
      title: directorStarts() ? "PD.Controls.MiniGame"
        : IS_MODULE ? "PD.Controls.ScoreboardModule" : "PD.Controls.Scoreboard",
      // Decided at click time, from the REAL game state.
      onChange: () => {
        const opening = directorStarts() ? setMiniGame(true) : openScoreboard();
        opening.catch((err) => warn("the coin failed:", err));
      },
    };
  });
};

/**
 * THE COIN NEVER ENDS THE GAME (Dom, 2026-10-03). It was a toggle; then a
 * Director who closed their board with its X and clicked the coin to get it
 * back was asked to end the game for everyone — and Cancel left the board
 * shut. Now it always gets you a board: for a module Director who may write
 * world settings, while the game is off it STARTS it (one click, no confirm,
 * boards open everywhere); otherwise — a player, the system, or a game
 * already running — it opens your own board. Ending lives only in the
 * board's ⋮ menu (and Configure Settings), behind its confirm.
 */
const directorStarts = () => IS_MODULE && game.user.isGM && canSetWorld() && !miniGameActive();
