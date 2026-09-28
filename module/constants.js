/** Names every module shares. */
export const SYSTEM_ID = "penny-dreadful";
export const NS = SYSTEM_ID;
export const MAX_PENNIES = 10;
/**
 * An NPC's hand: the Director's world setting `npcMaxPennies`, from the
 * smallest to the largest hand, five by default. An NPC dies on a failure
 * with this many.
 */
export const NPC_MAX_PENNIES_MIN = 5;
export const NPC_MAX_PENNIES_DEFAULT = 5;
/** The Difficulty Score runs from 1 to 5, as the rules say. Fixed; not a setting. */
export const MAX_DS = 5;
/**
 * The two actor sub-types, everywhere a type is compared, created or
 * registered. Bare names in the system build; the planned module build
 * prefixes them with its package id, which is why no literal appears
 * outside this file.
 */
export const TYPE_PC = "character";
export const TYPE_NPC = "npc";

export const TEMPLATES = {
  scoreboard: `systems/${SYSTEM_ID}/templates/scoreboard.html`,
  actorSheet: `systems/${SYSTEM_ID}/templates/actor-sheet.html`,
  flipCard: `systems/${SYSTEM_ID}/templates/chat/flip-card.html`,
  requestCard: `systems/${SYSTEM_ID}/templates/chat/flip-request.html`,
  addActor: `systems/${SYSTEM_ID}/templates/dialog/add-actor.html`,
};

/**
 * May this user write world settings? The spotlight and the coin hold live in
 * world settings, and the server checks this permission, not the GM flag: an
 * Assistant GM is a GM without it unless the Director grants it.
 */
export const canSetWorld = () => game.user.can("SETTINGS_MODIFY");

/**
 * The key for a count, chosen by the language's plural rules. The keys are
 * written out at each call site so the i18n gate can see them; a language
 * with more categories than one/other falls back to `other`.
 */
export const pluralKey = (n, keys) => keys[game.i18n.pluralRules.select(n)] ?? keys.other;

/** Localize, or format when data is given. */
export const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

export const log = (...args) => console.log("Penny Dreadful |", ...args);
export const warn = (...args) => console.warn("Penny Dreadful |", ...args);
