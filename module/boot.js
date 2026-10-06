/**
 * One boot for both flavors. The entry files (penny-dreadful.js for the
 * system, penny-dreadful-module.js for the module) are one call each: which
 * package is running is detected in constants.js from the file's own URL,
 * and everything that differs between the flavors lives in flags there
 * (IS_MODULE, RELABEL_GM, NS, the type keys).
 */
import { IS_MODULE, NS, RELABEL_GM, SYSTEM_ID, TEMPLATES, TYPE_NPC, TYPE_PC, log } from "./constants.js";
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
import { maybeShowHowTo } from "./how-to.js";

/**
 * The module flavor in a world that runs the Penny Dreadful SYSTEM would boot
 * a second copy of everything beside the system's own: two boards under one
 * application id, two coin tools on one key, every hook twice. Nothing in the
 * manifest can forbid the pairing (relationships.conflicts is schema only in
 * 14.365), so the module stands down at init and tells the GM why.
 */
const standDown = () => IS_MODULE && game.system?.id === SYSTEM_ID;

export const boot = () => {
  Hooks.once("init", () => {
    if (standDown()) {
      log("the Penny Dreadful system is running this world; the module stays off");
      Hooks.once("ready", () => {
        if (game.user.isGM) ui.notifications.warn("PD.Notify.ModuleInSystemWorld", { localize: true, permanent: true });
      });
      return;
    }
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
    if (standDown()) return;
    if (RELABEL_GM) relabelDirector();
  });

  Hooks.once("ready", async () => {
    if (standDown()) return;
    // Not "pd-player": that is the board's player-name class, and its styles
    // applied to the whole page broke the sidebar for every player.
    if (!game.user.isGM) document.body.classList.add("pd-client-player");
    // The system's board is always on; the module's follows the Director's
    // mini-game toggle (miniGameActive is simply true in the system flavor).
    if (miniGameActive()) await openScoreboard();
    // The How To at startup, while this user still wants it: everyone in
    // the system; in the module the Director, and a player only when the
    // game is already running (their board just opened) — a guest shows
    // players nothing while no game runs (onMiniGameToggled covers the rest).
    if (!IS_MODULE || game.user.isGM || miniGameActive()) await maybeShowHowTo();
    if (RELABEL_GM) await renameDirector();
    log("ready");
  });
};
