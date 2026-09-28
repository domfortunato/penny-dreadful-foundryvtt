import { NS, warn } from "./constants.js";

const creating = new Set();

/**
 * Every player gets a row without anyone creating one: when a non-GM user
 * connects and owns no character, the ONE active GM client creates an actor
 * named after them and hands them ownership. Existing characters are found
 * by ownership, never by name. `force` skips the designated-GM check for an
 * explicit Director action (the one-shot reset): whoever clicked must be
 * the client that recreates, or a non-designated GM's reset would delete
 * every row and rebuild none. The auto-create setting still rules.
 */
export const ensureCharacterFor = async (user, { force = false } = {}) => {
  if (!user || user.isGM) return;
  if (!force && game.users.activeGM !== game.user) return;
  if (!game.settings.get(NS, "autoCreateCharacters")) return;
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  // An explicit entry, not `ownership.default`: a character everyone may edit is
  // nobody's own row, and must not stop this player getting one.
  if (game.actors.some((a) => a.type === "character" && a.ownership[user.id] === OWNER)) return;
  if (creating.has(user.id)) return;
  creating.add(user.id);
  try {
    const actor = await foundry.documents.Actor.create({
      name: user.name,
      type: "character",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE, [user.id]: OWNER },
    });
    if (actor && !user.character) await user.update({ character: actor.id });
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
  if (!game.user.isGM || actor?.type !== "character") return;
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const chosen = userId ? game.users.get(userId) : null;
  if (userId && (!chosen || chosen.isGM)) return;
  if ((actor.ownerUser?.id ?? null) === (chosen?.id ?? null)) return;
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
