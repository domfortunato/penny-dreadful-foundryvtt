/**
 * One boot for both flavors. The entry files (penny-dreadful.js for the
 * system, penny-dreadful-module.js for the module) are one call each: which
 * package is running is detected in constants.js from the file's own URL,
 * and everything that differs between the flavors lives in flags there
 * (RELABEL_GM today; the mini-game toggle arrives in the next phase).
 */
import { IS_MODULE, NS, RELABEL_GM, TEMPLATES, TYPE_NPC, TYPE_PC, log } from "./constants.js";
import { ACTOR_DATA_MODELS } from "./data-models.js";
import { registerActorHooks, registerDirectoryHooks } from "./actor.js";
import { PDActorSheet } from "./sheet.js";
import { registerKeybindings, registerSettings } from "./settings.js";

import { relabelDirector, renameDirector } from "./director.js";
import { registerSpotlightHooks } from "./spotlight.js";
import { registerRequestHooks } from "./request.js";
import { registerDiceHoldHooks } from "./dice-hold.js";
import { registerPlayerHooks } from "./players.js";
import { registerChatHooks } from "./chat.js";
import { registerJournalHooks } from "./rules.js";
import { miniGameActive, openScoreboard, registerSceneControl, registerScoreboardHooks } from "./scoreboard.js";

export const boot = () => {
  Hooks.once("init", () => {
    log("init");
    // Merge, never replace: the system owns the whole map today, but the
    // module build registers beside a host system's models, and the stock
    // Actor class serves both (`preUpdateActor` in actor.js carries what
    // the PDActor subclass used to).
    Object.assign(CONFIG.Actor.dataModels, ACTOR_DATA_MODELS);
    foundry.documents.collections.Actors.registerSheet(NS, PDActorSheet, {
      types: [TYPE_PC, TYPE_NPC],
      makeDefault: true,
      label: "PD.Sheet.Label",
    });

    registerSettings();
    registerKeybindings();
    registerScoreboardHooks();
    registerSceneControl();
    registerChatHooks();
    registerSpotlightHooks();
    registerRequestHooks();
    registerDiceHoldHooks();
    registerPlayerHooks();
    registerJournalHooks();
    registerDirectoryHooks();
    registerActorHooks();

    foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES));
  });

  // After every package's init, before any UI that reads role labels. The
  // module flavor never relabels: a guest does not rename the host's GM.
  Hooks.once("setup", () => {
    if (RELABEL_GM) relabelDirector();
  });

  Hooks.once("ready", async () => {
    // Not "pd-player": that is the board's player-name class, and its styles
    // applied to the whole page broke the sidebar for every player.
    if (!game.user.isGM) document.body.classList.add("pd-client-player");
    // The system's board is always on; the module's follows the Director's
    // mini-game toggle (miniGameActive is simply true in the system flavor).
    if (miniGameActive()) await openScoreboard();
    if (RELABEL_GM) await renameDirector();
    log("ready");
  });
};
