import { t } from "./constants.js";

const CLEARED = { ds: null, issuedBy: "", issuedAt: null };

export class PDActor extends foundry.documents.Actor {
  /**
   * The player whose row this is: the first non-GM user with an explicit OWNER
   * entry, or null. `ownership.default` is ignored on purpose. A default grant
   * makes an actor everyone's, which is not the same as being one player's
   * character. Who may flip is `canFlipFor` in flip.js: the Director or this user.
   */
  get ownerUser() {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    return game.users.find((u) => !u.isGM && this.ownership[u.id] === OWNER) ?? null;
  }

  get isOnBoard() {
    return this.system.onBoard === true;
  }

  /**
   * A flip result carries the challenge token it was rolled against. If the
   * challenge on record has moved on (another owner resolved it, or the
   * Director withdrew it while the coins were in the air) the write is refused.
   * The check runs on the writing client against the data that client has, so
   * it stops a flip that lost the race by any visible margin; two owners
   * writing within the same round trip can still both land.
   *
   * A row that dies or leaves the board by any other route (the sheet, the
   * console) drops its pending challenge here, so no Flip button or chat request is
   * left pointing at it.
   * @override
   */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    const dying = foundry.utils.getProperty(changes, "system.dead") === true;
    const leaving = foundry.utils.getProperty(changes, "system.onBoard") === false;
    const touchesChallenge = foundry.utils.hasProperty(changes, "system.challenge");
    if ((dying || leaving) && !touchesChallenge && this.system.challenge.ds !== null) {
      foundry.utils.setProperty(changes, "system.challenge", { ...CLEARED });
    }
    const flip = options.pdFlip;
    if (flip && this.system.challenge.issuedAt !== flip.issuedAt) {
      if (user.isSelf) ui.notifications.info("PD.Notify.AlreadyResolved", { format: { name: this.name } });
      return false;
    }
    return allowed;
  }
}

const byName = (a, b) => a.name.localeCompare(b.name, game.i18n.lang);

/**
 * The board's two sections, each sorted by name: the characters on the board
 * (they start there; the Director can take one off and put it back), and the
 * NPCs the Director has put on it.
 */
export const boardGroups = () => {
  const characters = [];
  const npcs = [];
  for (const actor of game.actors) {
    if (!actor.system.onBoard) continue;
    if (actor.type === "character") characters.push(actor);
    else if (actor.type === "npc") npcs.push(actor);
  }
  return { characters: characters.sort(byName), npcs: npcs.sort(byName) };
};

/** Board order, flat: every character, then every NPC. */
export const boardActors = () => {
  const { characters, npcs } = boardGroups();
  return [...characters, ...npcs];
};

/**
 * The Actors tab tells PCs from NPCs: every entry gets its type's tag,
 * "(PC-PD)" or "(NPC-PD)". Pure render decoration, redrawn by the hook on
 * every render of the tab (popped out included) — the stored name never
 * carries it, so the board, the chat cards and the dialogs stay clean.
 */
export const registerDirectoryHooks = () => {
  Hooks.on("renderActorDirectory", (app, html) => {
    for (const li of html.querySelectorAll("li.directory-item.entry[data-entry-id]")) {
      const actor = game.actors.get(li.dataset.entryId);
      const name = li.querySelector(".entry-name");
      if (!actor || !name || name.querySelector(".pd-type-tag")) continue;
      const tag = document.createElement("span");
      tag.className = "pd-type-tag";
      tag.textContent = t(actor.type === "npc" ? "PD.Directory.NpcTag" : "PD.Directory.PcTag");
      // The gap is the stylesheet's margin, not a hard-coded space.
      name.append(tag);
    }
  });
};
