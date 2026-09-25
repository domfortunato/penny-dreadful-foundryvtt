import { NS, canSetWorld, warn } from "./constants.js";
import { boardActors } from "./actor.js";

/** The row whose turn it is, as an actor id, or "". */
export const getSpotlight = () => {
  try {
    return game.settings.get(NS, "spotlightActorId") || "";
  } catch {
    return "";
  }
};

export const setSpotlight = async (id) => {
  if (!canSetWorld()) return;
  const next = id ?? "";
  if (getSpotlight() === next) return;
  await game.settings.set(NS, "spotlightActorId", next);
};

/** Move the spotlight to the next living row in board order, or clear it. */
export const nextSpotlight = async () => {
  const order = boardActors();
  const start = order.findIndex((a) => a.id === getSpotlight());
  for (let k = 1; k <= order.length; k++) {
    const candidate = order[(start + k) % order.length];
    if (!candidate.system.dead) return setSpotlight(candidate.id);
  }
  return setSpotlight("");
};

/** The one connected client that moves the spotlight: a GM who may write world settings. */
const isSpotlightKeeper = () =>
  game.users.getDesignatedUser((u) => u.active && u.isGM && u.can("SETTINGS_MODIFY")) === game.user;

const advance = () => nextSpotlight().catch((err) => warn("could not move the spotlight:", err));

/**
 * Auto-advance. Players cannot write world settings, so ONE designated GM
 * client moves the spotlight when it sees a flip resolve on the spotlit row,
 * or that row die, leave the board, or be deleted.
 */
export const registerSpotlightHooks = () => {
  Hooks.on("updateActor", (actor, changes, options) => {
    if (!isSpotlightKeeper() || getSpotlight() !== actor.id) return;
    const sys = changes.system ?? {};
    if (options.pdFlip || sys.onBoard === false || sys.dead === true) advance();
  });
  Hooks.on("deleteActor", (actor) => {
    if (isSpotlightKeeper() && getSpotlight() === actor.id) advance();
  });
};
