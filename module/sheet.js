import { TEMPLATES, warn } from "./constants.js";
import { assignPlayer } from "./players.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * The smallest sheet that lets the Director (or an owner) fix a row by hand.
 * The game has no character sheet; this is a form, not a sheet.
 */
export class PDActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["penny-dreadful", "pd-sheet"],
    position: { width: 380, height: "auto" },
    window: { resizable: false, icon: "fa-solid fa-coins" },
    form: { submitOnChange: true, closeOnSubmit: false },
  };

  static PARTS = {
    sheet: { template: TEMPLATES.actorSheet },
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    context.isNpc = actor.type === "npc";
    context.isDirector = game.user.isGM;
    context.playerName = actor.ownerUser?.name ?? null;
    context.system = actor.system;
    context.maxPennies = actor.system.maxPennies;
    // The Director's Player dropdown: every player, the row's own marked.
    context.players = game.users
      .filter((u) => !u.isGM)
      .map((u) => ({ id: u.id, name: u.name, selected: u.id === actor.ownerUser?.id }))
      .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    return context;
  }

  /**
   * The Player dropdown is ownership, not a document field: it must never
   * reach validate() or update(). It is pulled out here, before the form
   * data is validated, and applied by `assignPlayer` as its own write.
   * @override
   */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    this.#pendingPlayer = data.pdPlayer;
    delete data.pdPlayer;
    return data;
  }

  #pendingPlayer;

  /**
   * The form shows the hand as prepared, folded to the NPC limit, and a change
   * to any field submits the whole form. An untouched folded count would then
   * overwrite the stored one, and raising the limit again would no longer give
   * the pennies back. So a pennies value equal to the folded one, over a stored
   * count that differs, is left out of the update.
   * @override
   */
  _prepareSubmitData(event, form, formData, updateData) {
    const submitData = super._prepareSubmitData(event, form, formData, updateData);
    const chosen = this.#pendingPlayer;
    this.#pendingPlayer = undefined;
    if (chosen !== undefined && game.user.isGM) {
      assignPlayer(this.document, chosen).catch((err) => warn("could not assign the player:", err));
    }
    const folded = this.document.system.pennies;
    const stored = this.document._source.system.pennies;
    if (stored !== folded && submitData.system?.pennies === folded) delete submitData.system.pennies;
    return submitData;
  }
}
