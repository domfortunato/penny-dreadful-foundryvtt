import { NS, TEMPLATES, TYPE_PC, pluralKey, t, warn } from "./constants.js";
import { ownerUserOf } from "./actor.js";
import { awaitDiceAnimation } from "./dice-hold.js";
import { refreshRequestCards } from "./request.js";
import { rerenderScoreboard } from "./scoreboard.js";

const CLEARED = { ds: null, issuedBy: "", issuedAt: null };

/**
 * Whose row is this: the Director, and the row's own player (its explicit
 * owner, `ownerUserOf`). Nobody flips for another player, even with owner
 * rights on their actor, and an NPC is the Director's alone. The board's
 * Flip button, the chat card's and `flip` itself all ask this — and so does
 * the row's name/Edit button, which is the same question, so it stays one
 * rule rather than growing a twin.
 */
export const canFlipFor = (actor, user = game.user) =>
  !!actor && (user.isGM || ownerUserOf(actor)?.id === user.id);

/** Actor ids with a flip in flight on THIS client. */
const flipping = new Set();
export const isFlipping = (actorId) => flipping.has(actorId);

// The outcome is a one-word badge and, on a failure, the sentence after it.
// Explicit keys, so the i18n gate can see them.
const OUTCOME_TEXT = {
  success: () => ({ badge: t("PD.Chat.Success"), detail: "" }),
  fail: (data) => ({ badge: t("PD.Chat.Failure"), detail: t("PD.Chat.FailDetail", data) }),
  death: (data) => ({ badge: t("PD.Chat.Failure"), detail: t("PD.Chat.DeathDetail", data) }),
};

/**
 * The one mechanic. Flip every penny the actor holds against the pending DL,
 * show the coins, then write the result.
 *
 * The roll is `{n}dc`: Foundry's Coin term, result 1 = heads, so the total is
 * the number of heads. The roll rides on the chat message as any roll does;
 * the system animates nothing itself and requires no module. If Dice So
 * Nice happens to be active, the board waits for its coins to land first
 * (`dice-hold.js`); without it the board changes at once.
 *
 * The Director and the row's player may both press Flip. Both roll, but the
 * write carries the challenge token (`issuedAt`) it was rolled against and
 * the `preUpdateActor` hook (actor.js) refuses one that is stale on the
 * writer's client, so a
 * flip that lost the race by any visible margin costs a chat card and never a
 * penny. Two writes inside the same round trip can still both land; the
 * Director's minus fixes the rare double.
 *
 * The write that changes the pennies also records the challenge token it
 * resolved (`challenge.resolved`), which is how the chat request reads
 * "flipped" the moment the board changes. The flipper then marks its own flip
 * card `applied` too, so the request still reads "flipped" after later
 * challenges have moved `resolved` on. A result that could not be written
 * says so to the flipper; a card that could not be marked is only logged.
 */
export const flip = async (actor) => {
  if (!actor || !game.actors.has(actor.id)) return;
  const challenge = actor.system.challenge;
  if (challenge.ds === null) return ui.notifications.warn("PD.Notify.NoChallenge", { format: { name: actor.name } });
  if (!canFlipFor(actor)) return ui.notifications.warn("PD.Notify.NotOwner", { format: { name: actor.name } });
  if (actor.system.dead) return ui.notifications.warn("PD.Notify.Dead", { format: { name: actor.name } });
  if (flipping.has(actor.id)) return;
  flipping.add(actor.id);
  rerenderScoreboard();
  refreshRequestCards(actor.id);
  let message = null;
  let written = false;
  try {
    const token = challenge.issuedAt;
    const ds = challenge.ds;
    const n = actor.system.pennies;
    const max = actor.system.maxPennies;

    const roll = new foundry.dice.Roll(`${n}dc`);
    await roll.evaluate();

    const heads = roll.total;
    const success = heads >= ds;
    const outcome = success ? "success" : (n >= max ? "death" : "fail");
    const penniesAfter = success ? n : Math.min(n + 1, max);
    const coins = roll.dice.flatMap((die) => die.results.map((r) => ({ heads: r.result === 1 })));

    const { badge, detail } = OUTCOME_TEXT[outcome]({ name: actor.name, pennies: penniesAfter });
    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.flipCard, {
      name: actor.name,
      n, ds, heads, coins, outcome, penniesAfter, badge, detail,
      tally: t(pluralKey(heads, { one: "PD.Chat.HeadsOne", other: "PD.Chat.Heads" }), { heads, ds }),
    });
    // The card's title is the whole statement, "Alice flips 3 pennies against
    // DL 2", in place of the speaker's name: the name alone followed by the
    // same sentence read twice. A character keeps its actor link; an NPC
    // speaks by that sentence alone, so nothing that filters messages by who
    // owns the speaker applies to it.
    const title = t(pluralKey(n, { one: "PD.Chat.FlavorOne", other: "PD.Chat.Flavor" }), { name: actor.name, n, ds });
    const speaker = actor.type === TYPE_PC
      ? { ...foundry.documents.ChatMessage.getSpeaker({ actor }), alias: title }
      : { alias: title };
    message = await roll.toMessage({
      speaker,
      content,
      flags: { [NS]: { flip: { actorId: actor.id, ds, heads, pennies: n, outcome, issuedAt: token } } },
    }, { messageMode: "public" });

    await awaitDiceAnimation(message?.id);

    // Someone else resolved it, or the Director withdrew it, while the coins flew.
    if (actor.system.challenge.issuedAt !== token) return;
    // A failure adds a penny to the hand as it is NOW, not as it was when the
    // coins were thrown: the Director's plus or minus during the flight stands.
    const update = { "system.challenge": { ...CLEARED, resolved: token } };
    if (!success) {
      const now = actor.system.pennies;
      if (now >= actor.system.maxPennies) update["system.dead"] = true;
      else update["system.pennies"] = now + 1;
    }
    written = !!(await actor.update(update, { pdFlip: { issuedAt: token, outcome } }));
  } catch (err) {
    warn("the flip failed:", err);
    // The coins are in chat for everyone; the board never heard. Say so, to
    // the flipper: the Director checks the pennies, a player asks them to.
    if (message) {
      const key = game.user.isGM ? "PD.Notify.FlipNotRecordedDirector" : "PD.Notify.FlipNotRecorded";
      ui.notifications.error(key, { format: { name: actor.name } });
    }
  } finally {
    flipping.delete(actor.id);
    rerenderScoreboard();
    refreshRequestCards(actor.id);
  }
  // The board has the result; this is only the card's own record of it, and a
  // card deleted while the coins flew is no reason to doubt the board.
  if (written && message) {
    try {
      await message.setFlag(NS, "flip.applied", true);
    } catch (err) {
      warn("could not mark the flip card as applied:", err);
    }
  }
};
