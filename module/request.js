import { NS, TEMPLATES, t } from "./constants.js";
import { ownerUserOf } from "./actor.js";
import { canFlipFor, flip, isFlipping } from "./flip.js";

/**
 * The Director's challenge, posted to chat as a card with a Flip button.
 *
 * The stored message holds only the request (whose row, which DL, the
 * challenge token) and an empty action area. What the card shows is decided
 * each time it is drawn, on each client: the Flip button for the Director and
 * the row's own player while the challenge is still the one this card asked
 * for, "waiting" for everyone else, and once it is over, whether the pennies
 * were flipped or the Director withdrew it. Nothing interactive is stored, so
 * an old card can never offer a stale flip. The card's class names are an
 * API like the flip card's: never give them a second meaning.
 */
export const postFlipRequest = async (actor) => {
  const { ds, issuedAt } = actor.system.challenge;
  if (ds === null) return null;
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.requestCard, { actorId: actor.id });
  // The name rides along, so a request for a row that was deleted later can
  // still say who flipped.
  return foundry.documents.ChatMessage.create({
    speaker: { alias: t("PD.Chat.RequestTitle", { name: actor.name, ds }) },
    content,
    flags: { [NS]: { request: { actorId: actor.id, name: actor.name, ds, issuedAt } } },
  });
};

/**
 * Where a request stands now: pending, flipping (on this client), flipped,
 * withdrawn, or ended. The last three are read from what was RECORDED, never
 * guessed from what the chat happens to hold. A flip is recorded twice: the
 * write that changes the pennies stamps the row's `challenge.resolved` with
 * the token it resolved, and the flipper then marks its own flip card
 * `applied` (flip.js). The first is there the instant the board changes;
 * the second outlives later challenges. Either one says flipped, and flipped
 * outranks withdrawn: the Director marks a request `withdrawn` before
 * clearing the row (challenge.js), and a flip that landed in between changed
 * the pennies all the same. Anything else (the row died or left by another
 * route, was deleted, or the record is gone) is simply no longer pending.
 */
const requestState = (message, request) => {
  const actor = game.actors.get(request.actorId) ?? null;
  const challenge = actor?.system.challenge;
  const current = !!actor && challenge.ds !== null && challenge.issuedAt === request.issuedAt && !actor.system.dead;
  if (current) return { state: isFlipping(actor.id) ? "flipping" : "pending", actor };
  const flipped = challenge?.resolved === request.issuedAt || game.messages.some((m) => {
    const f = m.getFlag(NS, "flip");
    return f?.applied && f.actorId === request.actorId && f.issuedAt === request.issuedAt;
  });
  if (flipped) return { state: "flipped", actor };
  if (message.getFlag(NS, "request")?.withdrawn) return { state: "withdrawn", actor };
  return { state: "ended", actor };
};

const statusLine = (icon, text) => {
  const p = document.createElement("p");
  p.className = "pd-request-status";
  const i = document.createElement("i");
  i.className = icon;
  p.append(i, " ", text);
  return p;
};

/** Fill one card's action area for this client. */
const decorate = (card, message) => {
  const request = message.getFlag(NS, "request");
  const area = card.querySelector(".pd-request-action");
  if (!request || !area) return;
  const { state, actor } = requestState(message, request);
  const name = actor?.name ?? request.name ?? "";
  area.replaceChildren();
  card.dataset.state = state;
  if (state === "pending" && canFlipFor(actor)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pd-request-flip";
    const i = document.createElement("i");
    i.className = "fa-solid fa-coins";
    button.append(i, " ", t("PD.Board.Flip", { ds: request.ds }));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      button.disabled = true;
      // Asked again at the click: the card may be older than the row's news.
      const now = requestState(message, request);
      if (now.state === "pending" && canFlipFor(now.actor)) flip(now.actor);
      else decorate(card, message);
    });
    area.append(button);
  } else if (state === "pending") {
    // A row with no player of its own (an NPC) is flipped by the Director.
    const owner = ownerUserOf(actor);
    const waiting = owner
      ? t("PD.Chat.RequestWaiting", { name: owner.name })
      : t("PD.Chat.RequestWaitingDirector");
    area.append(statusLine("fa-solid fa-hourglass-half", waiting));
  } else if (state === "flipping") {
    area.append(statusLine("fa-solid fa-spinner fa-spin", t("PD.Board.Flipping")));
  } else if (state === "flipped") {
    area.append(statusLine("fa-solid fa-check", t("PD.Chat.RequestFlipped", { name })));
  } else if (state === "withdrawn") {
    area.append(statusLine("fa-solid fa-ban", t("PD.Chat.RequestWithdrawn")));
  } else {
    area.append(statusLine("fa-solid fa-circle-minus", t("PD.Chat.RequestEnded")));
  }
};

/** Redraw the action area of every request card on screen (chat log, pop-outs, notifications). */
export const refreshRequestCards = (actorId = null) => {
  const docs = [document, ...[...(foundry.applications.detached?.windows?.values?.() ?? [])]
    .map((w) => w.window?.document).filter(Boolean)];
  for (const doc of docs) {
    for (const card of doc.querySelectorAll(".pd-request-card")) {
      if (actorId && card.dataset.actorId !== actorId) continue;
      const message = game.messages.get(card.closest("[data-message-id]")?.dataset.messageId);
      if (message) decorate(card, message);
    }
  }
};

/**
 * Mark the requests for the actor's current challenge as withdrawn. The
 * Director calls this before taking the challenge back or replacing it; a GM
 * may update any message, so no socket is needed.
 */
export const withdrawRequests = async (actor) => {
  const issuedAt = actor?.system.challenge.issuedAt;
  if (!game.user.isGM || issuedAt === null || issuedAt === undefined) return;
  const updates = game.messages
    .filter((m) => {
      const r = m.getFlag(NS, "request");
      return r && r.actorId === actor.id && r.issuedAt === issuedAt && !r.withdrawn;
    })
    .map((m) => ({ _id: m.id, [`flags.${NS}.request.withdrawn`]: true }));
  if (updates.length) await foundry.documents.ChatMessage.updateDocuments(updates);
};

export const registerRequestHooks = () => {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (!message.getFlag(NS, "request")) return;
    const card = html.querySelector(".pd-request-card");
    if (card) decorate(card, message);
  });
  // Anything about the row can change who may flip or whether it is still
  // asked: its challenge, its death, its owner. Or the row is gone.
  Hooks.on("updateActor", (actor) => refreshRequestCards(actor.id));
  Hooks.on("deleteActor", (actor) => refreshRequestCards(actor.id));
  // A player's name is on the "waiting" line; a user's role decides the Director.
  Hooks.on("updateUser", () => refreshRequestCards());
  // A flip card was marked applied, or a request withdrawn, or one deleted.
  const onMessage = (message) => {
    const actorId = message.getFlag(NS, "flip")?.actorId ?? message.getFlag(NS, "request")?.actorId;
    if (actorId) refreshRequestCards(actorId);
  };
  Hooks.on("updateChatMessage", onMessage);
  Hooks.on("deleteChatMessage", onMessage);
};
