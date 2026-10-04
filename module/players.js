import { IS_MODULE, NS, TYPE_PC, warn } from "./constants.js";
import { ensureActorFolder, ownerUserOf } from "./actor.js";
// A cycle (scoreboard → players → scoreboard), safe: both are only called at run time.
import { miniGameActive } from "./scoreboard.js";

const creating = new Set();

/**
 * Every player gets a row without anyone creating one: when a non-GM user
 * connects and owns no character, the ONE active GM client creates an actor
 * named after them and hands them ownership. Existing characters are found
 * by ownership, never by name. `force` skips the designated-GM check for an
 * explicit Director action (the one-shot reset): whoever clicked must be
 * the client that recreates, or a non-designated GM's reset would delete
 * every row and rebuild none. The auto-create setting still rules.
 *
 * In the MODULE it acts only while the mini game is running (Dom,
 * 2026-10-03): a guest adds nothing to a host campaign until the Director
 * starts the game — then every connected player without a PC gets one
 * (onMiniGameToggled), and so does anyone who connects while it runs.
 */
export const ensureCharacterFor = async (user, { force = false } = {}) => {
  if (!user || user.isGM) return;
  if (!force && game.users.activeGM !== game.user) return;
  if (!game.settings.get(NS, "autoCreateCharacters")) return;
  if (IS_MODULE && !miniGameActive()) return;
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  // An explicit entry, not `ownership.default`: a character everyone may edit is
  // nobody's own row, and must not stop this player getting one.
  if (game.actors.some((a) => a.type === TYPE_PC && a.ownership[user.id] === OWNER)) return;
  if (creating.has(user.id)) return;
  creating.add(user.id);
  try {
    // The Penny Dreadful folder first (it may not exist yet), so the new PC
    // is filed by preCreateActor in the same write.
    await ensureActorFolder();
    const actor = await foundry.documents.Actor.create({
      name: user.name,
      type: TYPE_PC,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [user.id]: OWNER },
    });
    // The system keeps core's "primary character" in step. The module never
    // writes it: in a host campaign it would make a mini-game PC the
    // player's own, and core would speak their host chat as it.
    if (actor && !IS_MODULE && !user.character) await user.update({ character: actor.id });
    ui.notifications.info("PD.Notify.CharacterCreated", { format: { player: user.name } });
  } catch (err) {
    warn(`could not create a character for ${user.name}:`, err);
  } finally {
    creating.delete(user.id);
  }
};

/**
 * Make this character userId's, or nobody's (""). One player per row: any
 * other player's explicit OWNER entry is removed; lower grants and the
 * Director's own entry are left alone. Foundry's "primary character" pointer
 * (`user.character`) follows, so the core player list agrees with the board:
 * the new player gains it if they had none, and anyone whose pointer named
 * this actor loses it. A player may own several characters; each row shows
 * their name.
 */
export const assignPlayer = async (actor, userId) => {
  if (!game.user.isGM || actor?.type !== TYPE_PC) return;
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const chosen = userId ? game.users.get(userId) : null;
  if (userId && (!chosen || chosen.isGM)) return;
  if ((ownerUserOf(actor)?.id ?? null) === (chosen?.id ?? null)) return;
  // The whole ownership object is replaced: a partial update cannot remove
  // an entry. {diff: false, recursive: false} scopes the replacement to the
  // keys present in the update, here only `ownership`. (Core's own
  // ownership dialog does the same job through its _replace() operator.)
  const ownership = foundry.utils.deepClone(actor._source.ownership);
  for (const u of game.users) {
    if (!u.isGM && u !== chosen && ownership[u.id] === OWNER) delete ownership[u.id];
  }
  if (chosen) ownership[chosen.id] = OWNER;
  await actor.update({ ownership }, { diff: false, recursive: false });
  // The pointer is the system's to keep in step; a guest module leaves the
  // host players' primary characters alone (see ensureCharacterFor).
  if (IS_MODULE) return;
  // One batch, so concurrent assignments cannot interleave the pointers.
  const updates = [];
  for (const u of game.users) {
    if (u.isGM) continue;
    if (u === chosen) {
      if (!u.character) updates.push({ _id: u.id, character: actor.id });
    } else if (u._source.character === actor.id) {
      updates.push({ _id: u.id, character: null });
    }
  }
  if (updates.length) await foundry.documents.User.updateDocuments(updates);
};

export const registerPlayerHooks = () => {
  Hooks.on("userConnected", (user, active) => {
    if (active) ensureCharacterFor(user);
  });
  Hooks.once("ready", () => {
    for (const user of game.users) if (user.active) ensureCharacterFor(user);
  });
};
