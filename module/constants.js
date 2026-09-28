/** Names every module shares. */
export const SYSTEM_ID = "penny-dreadful";
export const MODULE_ID = "penny-dreadful-module";
/**
 * Which package is running this copy of the code. The same source ships two
 * ways — the system, and the module that runs the game as a mini game inside
 * another system's world — and the file's own URL says which folder Foundry
 * served it from. Resolved while the modules are still being evaluated, so
 * everything computed from it at the top level of any module (template
 * paths, the data-model keys, the add dialog's label map) is right from the
 * start, with no boot ordering to get wrong.
 */
export const IS_MODULE = import.meta.url.includes(`/modules/${MODULE_ID}/`);
/**
 * The RUNNING package's id: settings, keybindings, runtime-written flags
 * (chat cards) and the pack collection key are all namespaced by whoever is
 * actually installed.
 */
export const NS = IS_MODULE ? MODULE_ID : SYSTEM_ID;
/**
 * The namespace baked into shipped CONTENT: the journals' flags, written at
 * build time by tools/import/. Both flavors ship the same built packs, so a
 * flag reader uses this name even when the module is running — and reads
 * `doc.flags` directly, because `getFlag` refuses a scope that is not an
 * installed package.
 */
export const CONTENT_NS = SYSTEM_ID;
/**
 * The Gamemaster→Director relabel and account rename are the system's voice.
 * The module is a guest in someone's campaign and never touches the host's
 * role labels; its cards still say "The Director", which is the game talking.
 */
export const RELABEL_GM = !IS_MODULE;
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
 * registered. Bare names in the system build; core keys a module's sub-types
 * as `<module-id>.<subtype>`, which is why no literal appears outside this
 * file.
 */
export const TYPE_PC = IS_MODULE ? `${MODULE_ID}.character` : "character";
export const TYPE_NPC = IS_MODULE ? `${MODULE_ID}.npc` : "npc";

const ROOT = IS_MODULE ? `modules/${MODULE_ID}` : `systems/${SYSTEM_ID}`;
export const TEMPLATES = {
  scoreboard: `${ROOT}/templates/scoreboard.html`,
  actorSheet: `${ROOT}/templates/actor-sheet.html`,
  flipCard: `${ROOT}/templates/chat/flip-card.html`,
  requestCard: `${ROOT}/templates/chat/flip-request.html`,
  addActor: `${ROOT}/templates/dialog/add-actor.html`,
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
