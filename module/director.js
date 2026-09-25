import { NS, t, warn } from "./constants.js";

const DEFAULT_GM_NAMES = ["gamemaster", "game master"];

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
