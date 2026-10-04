import { IS_MODULE, MAX_PENNIES, NPC_MAX_PENNIES_DEFAULT, NPC_MAX_PENNIES_MIN, NS, TYPE_NPC } from "./constants.js";
import { SCALE_DEFAULT, onMiniGameToggled, openScoreboard, rerenderScoreboard } from "./scoreboard.js";
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
    // On in both flavors. In the module it acts only while the mini game is
    // running (ensureCharacterFor), so a guest still seeds nothing into a
    // host campaign because a player connected — the Director starting the
    // game is the opt-in (Dom, 2026-10-03). The hint says which.
    hint: IS_MODULE ? "PD.Settings.AutoCreate.hintModule" : "PD.Settings.AutoCreate.hint",
    scope: "world", config: true, type: Boolean, default: true,
  });
  // The How To window (how-to.js) opens by itself the FIRST time a person
  // joins (`howToSeen`), and after that only if they ticked "Show this next
  // time" (`showHowTo`, unticked by default — Dom: a How To at every F5 was
  // too much). Both per USER, not per browser (client-settings.mjs: a
  // "user" setting is stored with the user), so they follow a person to any
  // machine; `showHowTo` is in Configure Settings too.
  game.settings.register(NS, "showHowTo", {
    name: "PD.Settings.ShowHowTo.label",
    hint: "PD.Settings.ShowHowTo.hint",
    scope: "user", config: true, type: Boolean, default: false,
  });
  game.settings.register(NS, "howToSeen", {
    scope: "user", config: false, type: Boolean, default: false,
  });
  if (IS_MODULE) {
    // The Director's mini-game toggle: on opens the board on every client,
    // off closes it everywhere. World-scoped and Director-written like the
    // spotlight; the system flavor has no such setting — its board is
    // always on. Flipped from the scene-control coin, the board's power
    // button (setMiniGame in scoreboard.js) — and shown here in Configure
    // Settings, because the coin is dead while no canvas is ready.
    game.settings.register(NS, "miniGameActive", {
      name: "PD.Settings.MiniGame.label",
      hint: "PD.Settings.MiniGame.hint",
      scope: "world", config: true, type: Boolean, default: false,
      onChange: (active) => onMiniGameToggled(active),
    });
  }
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
