import { MAX_DS, MAX_PENNIES, NS, TEMPLATES, canSetWorld, t, warn } from "./constants.js";

/**
 * The board's size range and step: the dropdown's presets, 100% to 200% in
 * tens. 1 is the size the board was designed at; it starts a notch bigger.
 */
const SCALE_MIN = 1;
const SCALE_MAX = 2;
const SCALE_STEP = 0.1;
export const SCALE_DEFAULT = 1.1;
import { boardGroups } from "./actor.js";
import { addPenny, addToBoard, issueChallenge, removeFromBoard, removePenny } from "./challenge.js";
import { canFlipFor, flip, isFlipping } from "./flip.js";
import { clearCoinsEverywhere, coinsHeld, diceModuleAvailable, toggleHoldCoins } from "./dice-hold.js";

import { chanceOfSuccess, percent } from "./odds.js";
import { openOdds, openRules } from "./rules.js";
import { startNewOneShot } from "./director.js";
import { getSpotlight, nextSpotlight, setSpotlight } from "./spotlight.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** The actor a clicked control belongs to. */
const actorFrom = (target) => game.actors.get(target.closest("[data-actor-id]")?.dataset.actorId);

/**
 * The scoreboard: everyone's pennies, on everyone's screen, all the time.
 *
 * A framed ApplicationV2 so players can drag it, and pop it out into its own
 * browser window with core's Detach control, and nothing else: it does not
 * minimize (`window.minimizable`), and it does not close. Core hard-codes the
 * close button into the frame (`_renderFrame`) and Escape closes every framed
 * app, so the button is removed after the frame renders, `close()` is a no-op
 * unless forced, and the stylesheet hides the control as well. Closing a
 * popped-out window brings the board back to the main one.
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
      holdCoins: PDScoreboard.#onHoldCoins,
      clearCoins: PDScoreboard.#onClearCoins,
      addCharacter: PDScoreboard.#onAddCharacter,
      addNpc: PDScoreboard.#onAddNpc,
      removeFromBoard: PDScoreboard.#onRemoveFromBoard,
      newOneShot: PDScoreboard.#onNewOneShot,
      openSheet: PDScoreboard.#onOpenSheet,
    },
  };

  static PARTS = {
    board: { template: TEMPLATES.scoreboard },
  };

  /* ------------------------------------------------------------ no close */

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    frame.querySelector('button[data-action="close"]')?.remove();
    return frame;
  }

  /**
   * The board does not close. Escape, the (removed) X and any stray caller get
   * `this` back unchanged. Two exceptions: `{force: true}`, which nothing in
   * the system uses; and the detached-window manager, which calls `close()`
   * on every app in a popped-out browser window the user has just closed.
   * That one must succeed, or the board would linger in a dead document, so
   * it closes and then comes straight back in the main window.
   * @override
   */
  async close(options = {}) {
    if (options.closeKey) return this;
    const detached = !!this.window.windowId;
    if (!options.force && !detached) return this;
    const result = await super.close(options);
    if (detached && !options.force) {
      setTimeout(() => openScoreboard().catch((err) => warn("could not bring the board back:", err)), 150);
    }
    return result;
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
    const owner = actor.ownerUser;
    // The name is an Edit button only for whoever the row belongs to: the
    // one rule, canFlipFor. `isOwner` would leak the button to anyone with
    // owner rights (a default grant), and to players on NPC rows.
    const canEdit = canFlipFor(actor);
    const flipping = isFlipping(actor.id);
    return {
      id: actor.id,
      name: actor.name,
      isNpc: actor.type === "npc",
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
      // The odds of the pending challenge, and of each DS the Director could ask for.
      chance: ds !== null ? percent(chanceOfSuccess(sys.pennies, ds), game.i18n.lang) : null,
      canEdit,
      canFlip: ds !== null && canEdit && !sys.dead && !flipping,
      flipping,
      spotlight: actor.id === spotlightId,
      dsOptions: Array.from({ length: MAX_DS }, (_, i) => ({
        n: i + 1, active: i + 1 === ds, chance: percent(chanceOfSuccess(sys.pennies, i + 1), game.i18n.lang),
      })),
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
    await addToBoard("character");
  }

  static async #onAddNpc() {
    await addToBoard("npc");
  }

  static async #onRemoveFromBoard(event, target) {
    const actor = actorFrom(target);
    if (actor) await removeFromBoard(actor);
  }

  static async #onNewOneShot() {
    await startNewOneShot();
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
 * A toolbar button under Token controls, for a board that was somehow lost.
 * `tools` is a record keyed by name; `visible` is read once at first render.
 */
export const registerSceneControl = () => {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tools = controls?.tokens?.tools;
    if (!tools) return;
    tools.pdScoreboard = {
      name: "pdScoreboard",
      title: "PD.Controls.Scoreboard",
      icon: "fa-solid fa-coins",
      order: Object.keys(tools).length,
      button: true,
      visible: true,
      onChange: () => {
        openScoreboard().catch((err) => warn("the scoreboard failed to open:", err));
      },
    };
  });
};
