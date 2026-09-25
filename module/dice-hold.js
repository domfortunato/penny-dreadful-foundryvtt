import { NS, canSetWorld, warn } from "./constants.js";

/**
 * OPTIONAL use of Dice So Nice. THE HARD RULE: the module is never required,
 * never configured, never assumed. Everything here checks for it first and
 * does nothing without it; the system's manifest does not name it.
 *
 * What it adds when the module happens to be active: the board waits for the
 * coins to land before it changes, and the Director gets "hold the coins",
 * which keeps each flip's coins on every screen until the Director clears
 * them. Hold and clear are the world settings `holdCoins` and
 * `coinsCleared`; the module's own timer is what would have hidden the
 * coins, so holding means cancelling it on every client.
 */

/** Active in this world. (`game.dice3d` itself arrives at the module's own ready hook, after the board's first render.) */
export const diceModuleAvailable = () => game.modules.get("dice-so-nice")?.active === true;

const dice3d = () => (diceModuleAvailable() ? game.dice3d : undefined);

export const coinsHeld = () => {
  try {
    return game.settings.get(NS, "holdCoins") === true;
  } catch {
    return false;
  }
};

/**
 * Wait for this client's animation of a message, if there is one. Races the
 * module against a cap so a stuck throw never holds a flip hostage; resolves
 * at once when the module is absent.
 * @returns {Promise<boolean>} true when an animation completed
 */
export const awaitDiceAnimation = async (messageId, { timeoutMs = 5000 } = {}) => {
  const d = dice3d();
  const wait = d?.waitFor3DAnimationByMessageID;
  if (!messageId || typeof wait !== "function") return false;
  let timer = null;
  try {
    return await Promise.race([
      Promise.resolve(wait.call(d, messageId)).then(() => true),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } catch (err) {
    warn("waiting on the dice animation failed:", err);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/* ------------------------------------------------------------ hold/clear */

let keepTimer = null;

/** Undo the module's pending hide on this client: its timer, its fades, its hidden canvas. */
const cancelHide = () => {
  const d = dice3d();
  if (!d) return;
  try {
    if (d.timeoutHandle) {
      clearTimeout(d.timeoutHandle);
      d.timeoutHandle = null;
    }
    d._cancelCanvasFade?.();
    d.box?.cancelFade?.();
    if (d.canvas) {
      d.canvas.style.display = "";
      d.canvas.style.opacity = "";
    }
  } catch (err) {
    warn("could not hold the coins:", err);
  }
};

/**
 * Keep the coins that just landed. The module schedules its hide around the
 * time its animation completes, and its own hide delay is a per-user setting
 * (2 s by default), so keep cancelling for a good while after.
 */
const keepOnScreen = () => {
  clearInterval(keepTimer);
  cancelHide();
  let ticks = 0;
  keepTimer = setInterval(() => {
    cancelHide();
    if (++ticks >= 60) {
      clearInterval(keepTimer);
      keepTimer = null;
    }
  }, 200);
};

/** Take the coins off this screen the way the module does when it is done with them. */
export const clearHeldCoins = () => {
  clearInterval(keepTimer);
  keepTimer = null;
  const d = dice3d();
  if (!d?.box) return;
  try {
    if (d.box.persistentDiceList?.length > 0) d.box.fadeOutEphemeral?.(600);
    else if (typeof d._fadeOutCanvas === "function") d._fadeOutCanvas(600, () => d.box.clearAll?.());
    else {
      d.box.clearAll?.();
      if (d.canvas) d.canvas.style.display = "none";
    }
  } catch (err) {
    warn("could not clear the coins:", err);
  }
};

/* --------------------------------------------------------------- actions */

export const toggleHoldCoins = async () => {
  if (!canSetWorld()) return;
  await game.settings.set(NS, "holdCoins", !coinsHeld());
};

/** The Director clears the coins from every screen. */
export const clearCoinsEverywhere = async () => {
  if (!canSetWorld()) return;
  await game.settings.set(NS, "coinsCleared", String(Date.now()));
};

/* ----------------------------------------------------------------- hooks */

export const onHoldChanged = (held) => {
  if (!held) clearHeldCoins();
};

export const onCoinsCleared = () => clearHeldCoins();

export const registerDiceHoldHooks = () => {
  // Every client keeps its own copy of the coins; each one cancels its own
  // hide. The system's hook runs before the module's (the system loads
  // first), so the wait is deferred until the module has claimed the message.
  Hooks.on("createChatMessage", (message) => {
    if (!message.getFlag(NS, "flip") || !coinsHeld() || !diceModuleAvailable()) return;
    setTimeout(() => {
      awaitDiceAnimation(message.id).then(() => {
        if (coinsHeld()) keepOnScreen();
      }).catch((err) => warn("could not hold the coins:", err));
    }, 100);
  });
};
