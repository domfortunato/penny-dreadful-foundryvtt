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
  // Withdrawing the pending DS comes first and is always allowed, even when
  // the pennies have since dropped below it: the pill is the undo.
  if (actor.system.challenge.ds === ds) return clearChallenge(actor);
  // A DS above the row's pennies cannot be met (Dom's ruling): never ask it.
  if (ds > actor.system.pennies) {
    return ui.notifications.warn(t("PD.Notify.DsOverPennies", { name: actor.name, ds }));
  }
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

/**
 * The add dialog's text, per type. The flow is the same for both; only the
 * words differ. Full keys, written out, so the i18n gate can see them.
 */
const ADD_LABELS = {
  character: {
    title: "PD.Dialog.AddCharacterTitle",
    pick: "PD.Dialog.AddCharacterPick",
    none: "PD.Dialog.AddCharacterNone",
    create: "PD.Dialog.AddCharacterNew",
  },
  npc: {
    title: "PD.Dialog.AddNpcTitle",
    pick: "PD.Dialog.AddNpcPick",
    none: "PD.Dialog.AddNpcNone",
    create: "PD.Dialog.AddNpcNew",
  },
};

/**
 * Put an existing off-board actor of this type on the board, or create one by
 * name and put it there. A new character starts with no player; the Director
 * hands it to one through Foundry's ownership dialog, as usual.
 */
export const addToBoard = async (type) => {
  const labels = ADD_LABELS[type];
  if (!isDirector() || !labels) return;
  // A candidate names its player, so a returning character is no surprise;
  // same convention as the board, which hides a player named like the row.
  const candidates = game.actors
    .filter((a) => a.type === type && !a.system.onBoard)
    .sort(byName)
    .map((a) => {
      const player = a.ownerUser;
      return {
        id: a.id,
        label: player && player.name !== a.name
          ? t("PD.Dialog.AddCandidate", { name: a.name, player: player.name })
          : a.name,
      };
    });
  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.addActor, { candidates, labels });
  const result = await foundry.applications.api.DialogV2.wait({
    window: { title: labels.title, icon: "fa-solid fa-user-plus" },
    classes: ["penny-dreadful", "pd-dialog"],
    content,
    rejectClose: false,
    renderOptions: boardWindowOptions(),
    buttons: [
      {
        action: "add", label: "PD.Dialog.Add", icon: "fa-solid fa-plus", default: true,
        callback: (event, button) => ({
          id: button.form.elements.actor?.value ?? "",
          name: (button.form.elements.newName?.value ?? "").trim(),
        }),
      },
      { action: "cancel", label: "PD.Dialog.Cancel" },
    ],
  });
  if (!result || typeof result !== "object") return;
  if (result.name) {
    await foundry.documents.Actor.create({ name: result.name, type, system: { onBoard: true } });
    return;
  }
  const actor = game.actors.get(result.id);
  if (actor) await actor.update({ "system.onBoard": true });
};

/**
 * Take a row off the board, character or NPC; its pending challenge is
 * withdrawn with it. Guarded by a confirm — the button is one click among
 * many on the row — whose body speaks in the future tense (a choice, not a
 * done deal, on Dom's reading of the first draft) and says the actor is
 * kept, because a red remove control reads as delete. The buttons are
 * Remove and Cancel, and core's confirm makes the no-button the default,
 * so Enter never removes.
 */
export const removeFromBoard = async (actor) => {
  if (!isDirector() || !actor) return;
  const confirmed = await foundry.applications.api.DialogV2.confirm({
    window: {
      title: actor.type === "npc" ? "PD.Dialog.RemoveNpcTitle" : "PD.Dialog.RemovePcTitle",
      icon: "fa-solid fa-user-slash",
    },
    classes: ["penny-dreadful", "pd-dialog"],
    // Escaped: localize does not escape, this string is parsed as HTML, and
    // a player can rename their own character to anything.
    content: `<p>${t("PD.Dialog.RemoveBody", { name: foundry.utils.escapeHTML(actor.name) })}</p>`,
    yes: { label: "PD.Dialog.Remove", icon: "fa-solid fa-user-slash" },
    no: { label: "PD.Dialog.Cancel" },
    rejectClose: false,
    renderOptions: boardWindowOptions(),
  });
  if (confirmed !== true) return;
  await withdrawRequests(actor);
  await actor.update({ "system.onBoard": false, "system.challenge": CLEARED });
};
