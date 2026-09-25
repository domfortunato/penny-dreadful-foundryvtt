import { NS, t, warn } from "./constants.js";

const creating = new Set();

/**
 * Every player gets a row without anyone creating one: when a non-GM user
 * connects and owns no character, the ONE active GM client creates an actor
 * named after them and hands them ownership. Existing characters are found
 * by ownership, never by name.
 */
export const ensureCharacterFor = async (user) => {
  if (!user || user.isGM) return;
  if (game.users.activeGM !== game.user) return;
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
    ui.notifications.info(t("PD.Notify.CharacterCreated", { player: user.name }));
  } catch (err) {
    warn(`could not create a character for ${user.name}:`, err);
  } finally {
    creating.delete(user.id);
  }
};

export const registerPlayerHooks = () => {
  Hooks.on("userConnected", (user, active) => {
    if (active) ensureCharacterFor(user);
  });
  Hooks.once("ready", () => {
    for (const user of game.users) if (user.active) ensureCharacterFor(user);
  });
};
