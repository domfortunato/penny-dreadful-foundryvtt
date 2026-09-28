/**
 * Penny Dreadful for Foundry VTT. Hook wiring only; everything else lives in
 * the module it is named after.
 */
import { SYSTEM_ID, TEMPLATES, TYPE_NPC, TYPE_PC, log } from "./constants.js";
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
import { openScoreboard, registerSceneControl, registerScoreboardHooks } from "./scoreboard.js";

Hooks.once("init", () => {
  log("init");
  // Merge, never replace: the system owns the whole map today, but the
  // planned module build registers beside a host system's models, and the
  // stock Actor class serves both (`preUpdateActor` in actor.js carries
  // what the PDActor subclass used to).
  Object.assign(CONFIG.Actor.dataModels, ACTOR_DATA_MODELS);
  foundry.documents.collections.Actors.registerSheet(SYSTEM_ID, PDActorSheet, {
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

// After every package's init, before any UI that reads role labels.
Hooks.once("setup", () => {
  relabelDirector();
});

Hooks.once("ready", async () => {
  // Not "pd-player": that is the board's player-name class, and its styles
  // applied to the whole page broke the sidebar for every player.
  if (!game.user.isGM) document.body.classList.add("pd-client-player");
  await openScoreboard();
  await renameDirector();
  log("ready");
});
