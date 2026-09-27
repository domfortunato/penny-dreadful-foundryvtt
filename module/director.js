import { NS, canSetWorld, t, warn } from "./constants.js";
import { boardWindowOptions } from "./scoreboard.js";
import { ensureCharacterFor } from "./players.js";
import { setSpotlight } from "./spotlight.js";

const DEFAULT_GM_NAMES = ["gamemaster", "game master"];
const CLEARED = { ds: null, issuedBy: "", issuedAt: null };

/**
 * Reset the world for the next one-shot, behind one confirm: every character
 * is deleted, the chat log is cleared, on-board NPCs are benched (an NPC is
 * the Director's prep and is kept), the spotlight goes out, and a fresh
 * character is made for each connected player (the auto-create setting still
 * rules). The chat is cleared with the flush dialog's own yes-callback
 * (`deleteDocuments([], {deleteAll: true})`): `game.messages.flush()` would
 * ask again in a second dialog of its own.
 */
export const startNewOneShot = async () => {
  if (!game.user.isGM) return;
  const characters = game.actors.filter((a) => a.type === "character");
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: { title: "PD.Dialog.OneShotTitle", icon: "fa-solid fa-clapperboard" },
    classes: ["penny-dreadful", "pd-dialog"],
    content: `<p>${t("PD.Dialog.OneShotBody", { characters: characters.length, messages: game.messages.size })}</p>`,
    rejectClose: false,
    renderOptions: boardWindowOptions(),
  });
  if (confirmed !== true) return;
  await foundry.documents.ChatMessage.deleteDocuments([], { deleteAll: true });
  await foundry.documents.Actor.deleteDocuments(characters.map((a) => a.id));
  const benched = game.actors
    .filter((a) => a.type === "npc" && a.system.onBoard)
    .map((a) => ({ _id: a.id, "system.onBoard": false, "system.challenge": { ...CLEARED } }));
  if (benched.length) await foundry.documents.Actor.updateDocuments(benched);
  if (canSetWorld()) await setSpotlight("");
  for (const user of game.users) {
    if (user.active) await ensureCharacterFor(user);
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
