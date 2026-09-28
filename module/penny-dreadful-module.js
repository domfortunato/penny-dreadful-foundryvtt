/**
 * Penny Dreadful, the MODULE flavor's entry: the same game as a mini game
 * inside another system's world. Which flavor is running is detected in
 * constants.js from this folder's own path, so booting is all there is to
 * do; the shared wiring lives in boot.js, and what a guest must not touch
 * (the host's role labels) is switched off there.
 */
import { boot } from "./boot.js";

boot();
