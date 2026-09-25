import { MAX_DS, TEMPLATES, t } from "./constants.js";
import { boardWindowOptions } from "./scoreboard.js";
import { postFlipRequest, withdrawRequests } from "./request.js";
import { getSpotlight, setSpotlight } from "./spotlight.js";

const CLEARED = { ds: null, issuedBy: "", issuedAt: null };
const isDirector = () => game.user.isGM;
const byName = (a, b) => a.name.localeCompare(b.name, game.i18n.lang);

/** Take the challenge back; its chat request says "withdrawn". */
export const clearChallenge = async (actor) => {
  await withdrawRequests(actor);
  return actor.update({ "system.challenge": CLEARED });
};

/**
 * The Director asks for a flip: the challenge on the row, and a card in chat
 * with a Flip button. Clicking the DS that is already pending withdraws it,
 * which is the Director's undo; the card then says so.
 */
export const issueChallenge = async (actor, ds) => {
  if (!isDirector() || !actor) return;
  if (actor.system.dead) return ui.notifications.warn(t("PD.Notify.Dead", { name: actor.name }));
  ds = Math.clamp(Math.round(Number(ds)), 1, MAX_DS);
  if (actor.system.challenge.ds === ds) return clearChallenge(actor);
  // A new DS over a pending one replaces it: the old request is withdrawn.
  await withdrawRequests(actor);
  await actor.update({ "system.challenge": { ds, issuedBy: game.user.id, issuedAt: Date.now() } });
  // The ask goes to chat, where the player (or the Director) flips from the card.
  await postFlipRequest(actor);
  if (getSpotlight() !== actor.id) await setSpotlight(actor.id);
};

export const addPenny = async (actor) => {
  if (!isDirector() || !actor) return;
  const n = actor.system.pennies;
  if (n >= actor.system.maxPennies) return;
  await actor.update({ "system.pennies": n + 1 });
};

/** Take a penny away; on a dead row the first press revives instead. */
export const removePenny = async (actor) => {
  if (!isDirector() || !actor) return;
  if (actor.system.dead) return actor.update({ "system.dead": false });
  const n = actor.system.pennies;
  if (n <= 1) return;
  await actor.update({ "system.pennies": n - 1 });
};

/** Put an existing NPC on the board, or create one by name and put it there. */
export const addNpc = async () => {
  if (!isDirector()) return;
  const candidates = game.actors.filter((a) => a.type === "npc" && !a.system.onBoard).sort(byName);
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.addNpc, { candidates });
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: "PD.Dialog.AddNpcTitle", icon: "fa-solid fa-user-plus" },
    classes: ["penny-dreadful", "pd-dialog"],
    content,
    rejectClose: false,
    renderOptions: boardWindowOptions(),
    buttons: [
      {
        action: "add", label: "PD.Dialog.Add", icon: "fa-solid fa-plus", default: true,
        callback: (event, button) => ({
          id: button.form.elements.npc?.value ?? "",
          name: (button.form.elements.newName?.value ?? "").trim(),
        }),
      },
      { action: "cancel", label: "PD.Dialog.Cancel" },
    ],
  });
  if (!result || typeof result !== "object") return;
  if (result.name) {
    await foundry.documents.Actor.create({ name: result.name, type: "npc", system: { onBoard: true } });
    return;
  }
  const actor = game.actors.get(result.id);
  if (actor) await actor.update({ "system.onBoard": true });
};

export const removeNpc = async (actor) => {
  if (!isDirector() || actor?.type !== "npc") return;
  await withdrawRequests(actor);
  await actor.update({ "system.onBoard": false, "system.challenge": CLEARED });
};
