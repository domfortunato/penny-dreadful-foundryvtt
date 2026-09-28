/**
 * Penny Dreadful, the SYSTEM flavor's entry. Which flavor is running is
 * detected in constants.js from this folder's own path, so booting is all
 * there is to do; the shared wiring lives in boot.js.
 */
import { boot } from "./boot.js";

boot();
