import { NS, TYPE_NPC, TYPE_PC, canSetWorld, pluralKey, t, warn } from "./constants.js";
import { boardWindowOptions } from "./scoreboard.js";
import { ensureCharacterFor } from "./players.js";
import { setSpotlight } from "./spotlight.js";

const DEFAULT_GM_NAMES = ["gamemaster", "game master"];
const CLEARED = { ds: null, issuedBy: "", issuedAt: null };

/**
 * Reset the world for the next one-shot, behind one confirm: the spotlight
 * goes out, on-board NPCs are benched (an NPC is the Director's prep and is
 * kept), every character is deleted, the chat log is cleared, and a fresh
 * character is made for each connected player (the auto-create setting still
 * rules; `force` skips only the designated-GM check, because the Director
 * who clicked need not be `game.users.activeGM`). The order matters:
 * everything is re-read AFTER the confirm (a row deleted while the dialog
 * sat open would make the batch throw on its stale id — core looks each id
 * up with `strict: true`); the spotlight is cleared FIRST, because the
 * keeper's hooks fire on the bench (`onBoard` false) and on the delete — a
 * spotlight left on an NPC would hop onto a PC the next step deletes, and a
 * second GM's keeper could write that hop after this client's own clear;
 * with the spotlight already dark neither hook matches. (An Assistant
 * Director cannot write the setting; the keeper then walks the spotlight to
 * "" through the delete step instead, benched NPCs first so it never lands
 * on one.) The chat is cleared last, so a failure earlier leaves the log
 * intact, via the flush dialog's own yes-callback
 * (`deleteDocuments([], {deleteAll: true})`): `game.messages.flush()`
 * would ask again in a second dialog of its own.
 */
export const startNewOneShot = async () => {
  if (!game.user.isGM) return;
  const fmt = new Intl.NumberFormat(game.i18n.lang);
  const bodyKey = pluralKey(game.messages.size, {
    one: "PD.Dialog.OneShotBodyOne",
    other: "PD.Dialog.OneShotBody",
  });
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "PD.Dialog.OneShotTitle", icon: "fa-solid fa-clapperboard" },
    classes: ["penny-dreadful", "pd-dialog"],
    content: `<p>${t(bodyKey, {
      characters: fmt.format(game.actors.filter((a) => a.type === TYPE_PC).length),
      messages: fmt.format(game.messages.size),
    })}</p>`,
    rejectClose: false,
    renderOptions: boardWindowOptions(),
  });
  if (confirmed !== true) return;
  if (canSetWorld()) await setSpotlight("");
  const benched = game.actors
    .filter((a) => a.type === TYPE_NPC && a.system.onBoard)
    .map((a) => ({ _id: a.id, "system.onBoard": false, "system.challenge": { ...CLEARED } }));
  if (benched.length) await foundry.documents.Actor.updateDocuments(benched);
  const characters = game.actors.filter((a) => a.type === TYPE_PC).map((a) => a.id);
  if (characters.length) await foundry.documents.Actor.deleteDocuments(characters);
  await foundry.documents.ChatMessage.deleteDocuments([], { deleteAll: true });
  for (const user of game.users) {
    if (user.active) await ensureCharacterFor(user, { force: true });
  }
};

/**
 * The Gamemaster is The Director. Override the localized role labels at
 * `setup`, before any UI that reads them renders (Players list, User
 * Management, permission dialogs). Same shape as Air Bladder's Warden.
 */
export const relabelDirector = () => {
  foundry.utils.setProperty(game.i18n.translations, "USER.RoleGamemaster", t("PD.Director"));
  foundry.utils.setProperty(game.i18n.translations, "USER.RoleAssistant", t("PD.AssistantDirector"));
};

/**
 * Rename the default Gamemaster account to The Director, once. Only the
 * active GM writes. A `renamedFrom` flag marks the accounts this system
 * renamed, so a deliberately-named GM is never touched and a language switch
 * can re-apply the label. Idempotent: writes only when the names differ.
 */
export const renameDirector = async () => {
  if (!game.user.isGM) return;
  if (game.users.activeGM && game.users.activeGM !== game.user) return;
  const director = t("PD.Director");
  // Foundry enforces unique user names and rejects the update outright.
  const nameTaken = (name, self) => game.users.some((x) => x.id !== self.id && x.name === name);

  for (const u of game.users) {
    if (u.role !== CONST.USER_ROLES.GAMEMASTER) continue;
    const previous = u.getFlag(NS, "renamedFrom");
    const ours = previous !== undefined;
    try {
      if (!ours && !DEFAULT_GM_NAMES.includes(u.name.trim().toLowerCase())) continue;
      if (u.name === director || nameTaken(director, u)) continue;
      const original = u.name;
      await u.update({ name: director });
      if (!ours) await u.setFlag(NS, "renamedFrom", original);
    } catch (err) {
      warn(`could not rename user "${u.name}":`, err);
    }
  }
};
