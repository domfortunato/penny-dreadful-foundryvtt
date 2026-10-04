import { NS, TEMPLATES, warn } from "./constants.js";
// Cycles (how-to → rules → scoreboard → how-to), safe: all called at run time.
import { openOdds, openRules } from "./rules.js";
import { renderFromBoard } from "./scoreboard.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** A per-user How To setting (settings.js), false when unreadable. */
const setting = (key) => {
  try {
    return game.settings.get(NS, key) === true;
  } catch {
    return false;
  }
};

/** Open by itself? The first time this person ever joins, or every time if they asked to. */
const wanted = () => !setting("howToSeen") || setting("showHowTo");

/**
 * How to play at this table: what the Director and the players do, and what
 * the board's buttons are. The body is GENERATED from docs/how-to-*.md
 * (tools/import/how-to.mjs) — edit the markdown, never the template — so
 * each flavor shows its own: the module's adds starting and ending the mini
 * game. It opens by itself the first time a person joins; the footer's
 * "Show this next time" (unticked by default) writes the per-user setting
 * that brings it back at every startup; it is
 * a `change`, not a click, so it cannot be an AppV2 action and is wired in
 * `_onRender`, as the board's size dropdown is.
 */
export class PDHowTo extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "pd-how-to",
    classes: ["penny-dreadful", "pd-how-to"],
    tag: "div",
    window: {
      title: "PD.HowTo.Title",
      icon: "fa-solid fa-circle-question",
      resizable: true,
    },
    position: { width: 640, height: 720 },
    actions: {
      closeHowTo: PDHowTo.#onClose,
      // The guide's links (tools/import/how-to.mjs writes them): the rules,
      // the odds, and a jump to one of its own headings.
      openRules: () => openRules(),
      openOdds: () => openOdds(),
      scrollTo: PDHowTo.#onScrollTo,
    },
  };

  static PARTS = {
    content: { template: TEMPLATES.howTo, scrollable: [""] },
    footer: { template: TEMPLATES.howToFooter },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.showNextTime = setting("showHowTo");
    return context;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender?.(context, options);
    this.element.querySelector("input.pd-how-to-again")?.addEventListener("change", (event) => {
      game.settings.set(NS, "showHowTo", event.target.checked)
        .catch((err) => warn("could not save the How To preference:", err));
    });
  }

  static #onClose() {
    this.close();
  }

  static #onScrollTo(event, target) {
    this.element.querySelector(`#${target.dataset.pdScroll}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

let howTo = null;
let shownThisSession = false;

/** Open the How To (the board's ? button). Follows a popped-out board. */
export const openHowTo = () => {
  howTo ??= new PDHowTo();
  return renderFromBoard(howTo);
};

/**
 * The showing by itself: the first time this person ever joins, then only
 * if they ticked "Show this next time" — at most once a session either way
 * (a refresh is a new session). Showing it marks it seen. boot.js decides
 * WHEN by flavor: in the system at ready for everyone; in the module the
 * Director at ready, a player once the mini game has opened their board
 * (onMiniGameToggled) — never while no game runs.
 */
export const maybeShowHowTo = async () => {
  if (shownThisSession || !wanted()) return;
  shownThisSession = true;
  if (!setting("howToSeen")) {
    game.settings.set(NS, "howToSeen", true).catch((err) => warn("could not record the How To as seen:", err));
  }
  await openHowTo();
};
