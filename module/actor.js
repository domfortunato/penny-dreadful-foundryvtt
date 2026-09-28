import { TYPE_NPC, TYPE_PC, clampName, t } from "./constants.js";

const CLEARED = { ds: null, issuedBy: "", issuedAt: null };

const isOurs = (actor) => actor?.type === TYPE_PC || actor?.type === TYPE_NPC;

/**
 * The player whose row this is: the first non-GM user with an explicit OWNER
 * entry, or null. `ownership.default` is ignored on purpose. A default grant
 * makes an actor everyone's, which is not the same as being one player's
 * character. Who may flip is `canFlipFor` in flip.js: the Director or this user.
 */
export const ownerUserOf = (actor) => {
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  return game.users.find((u) => !u.isGM && actor.ownership[u.id] === OWNER) ?? null;
};

/**
 * A flip result carries the challenge token it was rolled against. If the
 * challenge on record has moved on (another owner resolved it, or the
 * Director withdrew it while the coins were in the air) the write is refused.
 * The check runs on the writing client against the data that client has, so
 * it stops a flip that lost the race by any visible margin; two owners
 * writing within the same round trip can still both land.
 *
 * A row that dies or leaves the board by any other route (the sheet, the
 * console) drops its pending challenge here, so no Flip button or chat
 * request is left pointing at it.
 *
 * A hook, not an Actor subclass: `CONFIG.Actor.documentClass` belongs to the
 * system, and the planned module build has no claim on it. The client runs
 * `preUpdateActor` right after `_preUpdate` on the initiating client, cleans
 * the changes again afterwards (so the mutation lands), and a `false` return
 * cancels the write (client-backend.mjs 238-249). The one difference: an
 * update made with `{noHook: true}` (core's ownership dialog is the only one
 * we meet) skips hooks — none of those touch dead, onBoard or pdFlip.
 */
export const registerActorHooks = () => {
  // NAME_MAX, for OUR types only: a host system's actors are never touched.
  // Covers every route a name arrives by — our sheet and add dialog, the
  // auto-created PC named after its player, core's create dialog and the
  // sidebar rename. preCreate may change the source; a preUpdate hook's
  // changes are re-cleaned after it, so the trimmed name is what is written.
  Hooks.on("preCreateActor", (actor) => {
    if (!isOurs(actor)) return;
    const name = clampName(actor.name);
    if (!name || name === actor.name) return;
    // Core copied the full name into the prototype token before this hook
    // ran (Actor#_initializeSource, and again in Actor#_preCreate), so a
    // token dragged out later would wear the long name. Trim it too — but
    // only when it IS the actor's name, never a token name chosen apart.
    const update = { name };
    if (actor.prototypeToken?.name === actor.name) update["prototypeToken.name"] = name;
    actor.updateSource(update);
  });
  Hooks.on("preUpdateActor", (actor, changes) => {
    if (!isOurs(actor) || typeof changes.name !== "string") return;
    const name = clampName(changes.name);
    if (name && name !== changes.name) changes.name = name;
  });
  Hooks.on("preUpdateActor", (actor, changes, options, userId) => {
    // Our types only: a host system's actor has no system.challenge (this
    // threw on one with a system.dead field), and is never ours to touch.
    if (!isOurs(actor)) return;
    const dying = foundry.utils.getProperty(changes, "system.dead") === true;
    const leaving = foundry.utils.getProperty(changes, "system.onBoard") === false;
    const touchesChallenge = foundry.utils.hasProperty(changes, "system.challenge");
    if ((dying || leaving) && !touchesChallenge && actor.system.challenge.ds !== null) {
      foundry.utils.setProperty(changes, "system.challenge", { ...CLEARED });
    }
    const flip = options.pdFlip;
    if (flip && actor.system.challenge.issuedAt !== flip.issuedAt) {
      if (userId === game.user.id) {
        ui.notifications.info("PD.Notify.AlreadyResolved", { format: { name: actor.name } });
      }
      return false;
    }
  });
};

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
    if (actor.type === TYPE_PC) characters.push(actor);
    else if (actor.type === TYPE_NPC) npcs.push(actor);
  }
  return { characters: characters.sort(byName), npcs: npcs.sort(byName) };
};

/** Board order, flat: every character, then every NPC. */
export const boardActors = () => {
  const { characters, npcs } = boardGroups();
  return [...characters, ...npcs];
};

/** The tag for OUR types and nobody else's: another package's actor (a host
 * system's, another module's) gets none, which is the whole point of the
 * check — "everything that is not our NPC" once meant "our PC" and tagged a
 * host world's every actor (PC-PD). */
const typeTagKey = (actor) => {
  if (actor?.type === TYPE_PC) return "PD.Directory.PcTag";
  if (actor?.type === TYPE_NPC) return "PD.Directory.NpcTag";
  return null;
};

/**
 * The Actors tab tells our PCs from our NPCs: each of the game's own entries
 * gets its type's tag, "(PC-PD)" or "(NPC-PD)"; any other package's actor is
 * left alone. Pure render decoration, redrawn by the hook on every render of
 * the tab (popped out included) — the stored name never carries it, so the
 * board, the chat cards and the dialogs stay clean.
 */
export const registerDirectoryHooks = () => {
  Hooks.on("renderActorDirectory", (app, html) => {
    for (const li of html.querySelectorAll("li.directory-item.entry[data-entry-id]")) {
      const actor = game.actors.get(li.dataset.entryId);
      const key = typeTagKey(actor);
      const name = li.querySelector(".entry-name");
      if (!key || !name || name.querySelector(".pd-type-tag")) continue;
      const tag = document.createElement("span");
      tag.className = "pd-type-tag";
      tag.textContent = t(key);
      // The gap is the stylesheet's margin, not a hard-coded space.
      name.append(tag);
    }
  });
};
