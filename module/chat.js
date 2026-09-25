import { NS } from "./constants.js";
import { openScoreboard } from "./scoreboard.js";

export const registerChatHooks = () => {
  // `/scoreboard` (or `/board`) brings the board back if it was ever lost.
  Hooks.on("chatMessage", (log, message) => {
    if (!/^\/(scoreboard|board)\b/i.test(String(message).trim())) return true;
    openScoreboard();
    return false;
  });
  // Flip cards and flip requests get a class for the stylesheet; their content
  // is stored, not rebuilt (a request's button is added by module/request.js).
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (message.getFlag(NS, "flip") || message.getFlag(NS, "request")) html.classList.add("pd-chat");
  });
};
