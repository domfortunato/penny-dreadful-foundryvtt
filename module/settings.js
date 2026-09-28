import { MAX_PENNIES, NPC_MAX_PENNIES_DEFAULT, NPC_MAX_PENNIES_MIN, NS, TYPE_NPC } from "./constants.js";
import { SCALE_DEFAULT, openScoreboard, rerenderScoreboard } from "./scoreboard.js";
import { onCoinsCleared, onHoldChanged } from "./dice-hold.js";

export const registerSettings = () => {
  // Whose turn it is. World-scoped so every client highlights the same row;
  // only the Director can write it (players lack SETTINGS_MODIFY).
  game.settings.register(NS, "spotlightActorId", {
    scope: "world", config: false, type: String, default: "",
    onChange: () => rerenderScoreboard(),
  });
  game.settings.register(NS, "autoCreateCharacters", {
    name: "PD.Settings.AutoCreate.label",
    hint: "PD.Settings.AutoCreate.hint",
    scope: "world", config: true, type: Boolean, default: true,
  });
  // The most pennies any NPC can hold, and the hand a failure kills it with.
  // One number for every NPC. Changing it re-derives every NPC at once, so
  // the board, the sheets and the next flip all use the new hand.
  game.settings.register(NS, "npcMaxPennies", {
    name: "PD.Settings.NpcMaxPennies.label",
    hint: "PD.Settings.NpcMaxPennies.hint",
    // A NumberField, not `type: Number` with a `range`: core validates a field
    // on every write, so nothing (the console included) can store an 11.
    scope: "world", config: true,
    type: new foundry.data.fields.NumberField({
      nullable: false, integer: true, min: NPC_MAX_PENNIES_MIN, max: MAX_PENNIES, step: 1,
      initial: NPC_MAX_PENNIES_DEFAULT,
    }),
    onChange: () => {
      for (const actor of game.actors) {
        if (actor.type !== TYPE_NPC) continue;
        actor.reset();
        if (actor.sheet?.rendered) actor.sheet.render();
      }
      rerenderScoreboard();
    },
  });
  // The Director's "hold the coins" (only offered when Dice So Nice happens
  // to be active, see dice-hold.js): every screen keeps each flip's coins
  // until the Director clears them. World-scoped, Director-written.
  game.settings.register(NS, "holdCoins", {
    scope: "world", config: false, type: Boolean, default: false,
    onChange: (held) => {
      onHoldChanged(held);
      rerenderScoreboard();
    },
  });
  // Bumped by the Director to clear held coins from every screen.
  game.settings.register(NS, "coinsCleared", {
    scope: "world", config: false, type: String, default: "",
    onChange: () => onCoinsCleared(),
  });
  // Where this client left the board.
  game.settings.register(NS, "scoreboardPosition", {
    scope: "client", config: false, type: Object, default: {},
  });
  // How big this client wants the board. Everything on it is sized from
  // this one number, so fonts, pennies and buttons grow together. The board
  // starts a notch over its design size; a client that has picked keeps it.
  game.settings.register(NS, "scoreboardScale", {
    scope: "client", config: false, type: Number, default: SCALE_DEFAULT,
    onChange: () => rerenderScoreboard(),
  });
};

export const registerKeybindings = () => {
  game.keybindings.register(NS, "openScoreboard", {
    name: "PD.Keybind.Scoreboard",
    editable: [{ key: "KeyB", modifiers: ["Alt"] }],
    onDown: () => {
      openScoreboard();
      return true;
    },
  });
};
