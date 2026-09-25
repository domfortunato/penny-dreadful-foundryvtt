#!/usr/bin/env node
/**
 * Pop-out check against a running world on FOUNDRY_URL: the board's header menu
 * offers Detach and no close button; detaching moves the board into a popped-out
 * browser window with the system stylesheet; zooming in grows the popped-out
 * window with the board; a sheet and the rules journal opened from it appear in
 * the popped-out window, not behind it in the main one; closing that window from inside
 * (the way a real window close fires unload) brings the board back to the main
 * workspace. Playwright resolves as in e2e-smoke.mjs.
 *
 *   npm run dev:detach
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const candidates = [process.env.PLAYWRIGHT_DIR, ROOT, resolve(ROOT, "..", "air-bladder")].filter(Boolean);
const pwRoot = candidates.find((dir) => existsSync(join(dir, "node_modules", "playwright")));
if (!pwRoot) { console.error("playwright not found: set PLAYWRIGHT_DIR or npm install playwright"); process.exit(2); }
const require = createRequire(join(pwRoot, "package.json"));
const { chromium } = require("playwright");
const URL = process.env.FOUNDRY_URL ?? "http://localhost:30000";
const OUT = join(ROOT, "tools", "dev", "out");
mkdirSync(OUT, { recursive: true });
let failures = 0;
const check = (c, m) => { if (c) console.log("  ok    " + m); else { failures++; console.error("  FAIL  " + m); } };
const browser = await chromium.launch({ headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${URL}/join`, { waitUntil: "networkidle" });
  await page.waitForSelector('select[name="userid"] option[value]:not([value=""])', { state: "attached" });
  await page.evaluate(() => { const s = document.querySelector('select[name="userid"]'); s.value = [...s.options].find((o) => o.textContent.trim() === "The Director").value; s.dispatchEvent(new Event("change", { bubbles: true })); });
  await page.locator('button[type="submit"][name="join"], form#join-game button[type="submit"]').first().click();
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { document.querySelectorAll("#notifications > li").forEach((e) => e.remove()); });

  const controls = await page.evaluate(() => {
    const app = foundry.applications.instances.get("pd-scoreboard");
    return { toggleVisible: !document.querySelector('#pd-scoreboard button[data-action="toggleControls"]')?.classList.contains("hidden"),
      entries: [...app._headerControlButtons()].map((c) => c.action), close: !!document.querySelector('#pd-scoreboard button[data-action="close"]') };
  });
  console.log(JSON.stringify(controls));
  check(controls.toggleVisible && controls.entries.includes("detach"), "header menu offers Detach");
  check(!controls.close, "still no close button");

  // A sheet opened from the board in the main window stays there when the board pops out.
  await page.click("#pd-scoreboard button.pd-name-btn");
  await page.waitForTimeout(1000);

  // Detach through the API the menu entry calls.
  const popupPromise = ctx.waitForEvent("page", { timeout: 15000 });
  await page.evaluate(() => foundry.applications.instances.get("pd-scoreboard").detachWindow());
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  console.log("popup url:", popup.url());
  popup.on("pageerror", (e) => errors.push("popup: " + e.message));
  await popup.waitForSelector("#pd-scoreboard", { timeout: 20000 }).catch(() => console.log("  note  board not found in popup within 20s"));
  await popup.waitForTimeout(800);
  const inPopup = await popup.evaluate(() => ({ board: !!document.getElementById("pd-scoreboard"), rows: document.querySelectorAll("#pd-scoreboard tr.pd-row").length,
    styled: document.getElementById("pd-scoreboard") ? getComputedStyle(document.getElementById("pd-scoreboard")).backdropFilter : null, close: !!document.querySelector('#pd-scoreboard button[data-action="close"]:not([hidden])') }));
  const inMain = await page.evaluate(() => !!document.getElementById("pd-scoreboard"));
  console.log("popup:", JSON.stringify(inPopup), "main still has board:", inMain);
  check(inPopup.board && !inMain, "board moved into the popped-out window");
  const sheetStayed = await page.evaluate(() => [...foundry.applications.instances.values()]
    .some((a) => a.rendered && a.document?.documentName === "Actor" && a.element.ownerDocument === document));
  check(sheetStayed, "a sheet opened while the board was in the main window stays there");
  await page.evaluate(async () => { for (const a of [...foundry.applications.instances.values()]) if (a.rendered && a.document?.documentName === "Actor") await a.close(); });
  check(inPopup.styled && inPopup.styled !== "none", "system stylesheet applies in the popup");
  await popup.screenshot({ path: `${OUT}/detached.png` });

  // Zoom in from the popup: the board must ask its window to grow. Headless
  // Chromium reports the popup's own size as the screen, which caps any resize
  // at the current size, so the screen is enlarged and resizeTo recorded.
  await page.evaluate(() => game.settings.set("penny-dreadful", "scoreboardScale", 1));
  await popup.waitForTimeout(800);
  await popup.evaluate(() => {
    for (const [k, v] of [["width", 3000], ["height", 2000], ["availWidth", 3000], ["availHeight", 2000]]) {
      Object.defineProperty(window.screen, k, { configurable: true, get: () => v });
    }
    globalThis.__pdResize = [];
    const orig = window.resizeTo.bind(window);
    window.resizeTo = (w, h) => { globalThis.__pdResize.push([w, h]); return orig(w, h); };
  });
  const small = await popup.evaluate(() => document.getElementById("pd-scoreboard").getBoundingClientRect().width);
  await popup.click('#pd-scoreboard button[data-action="zoomIn"]');
  await popup.click('#pd-scoreboard button[data-action="zoomIn"]');
  await popup.waitForTimeout(1200);
  const zoom = await popup.evaluate(() => ({ resizes: globalThis.__pdResize, style: document.getElementById("pd-scoreboard").getAttribute("style") }));
  console.log("zoom:", JSON.stringify({ small, ...zoom }));
  const widest = Math.max(0, ...zoom.resizes.map(([w]) => w));
  check(widest > small, `popped-out board asks its window to grow when zoomed in (${Math.round(small)} -> ${widest})`);
  await page.evaluate(() => game.settings.set("penny-dreadful", "scoreboardScale", 1));
  await popup.waitForTimeout(800);

  // Windows the board opens land in the board's window.
  const inPopupDoc = (docName) => popup.evaluate((d) => [...foundry.applications.instances.values()]
    .some((a) => a.rendered && a.document?.documentName === d && a.element.ownerDocument === document), docName);
  await popup.click("#pd-scoreboard button.pd-name-btn");
  await popup.waitForTimeout(1200);
  check(await inPopupDoc("Actor"), "a sheet opened from the popped-out board appears in its window");
  await popup.click('#pd-scoreboard button[data-action="openRules"]');
  await popup.waitForTimeout(1500);
  check(await inPopupDoc("JournalEntry"), "the rules opened from the popped-out board appear in its window");
  // With the journal beside it, a board redraw leaves the window's size alone.
  await popup.evaluate(() => { globalThis.__pdResize = []; });
  await page.evaluate(() => foundry.applications.instances.get("pd-scoreboard").render());
  await popup.waitForTimeout(1000);
  const resizes = await popup.evaluate(() => globalThis.__pdResize.length);
  check(resizes === 0, `a board redraw beside a journal does not resize the window (${resizes} resizes)`);
  await page.evaluate(async () => {
    for (const a of [...foundry.applications.instances.values()]) {
      if (["Actor", "JournalEntry"].includes(a.document?.documentName) && a.rendered) await a.close();
    }
  });
  await popup.waitForTimeout(500);

  // Instrument close() on the app, then close the popped-out window.
  await page.evaluate(() => { const app = foundry.applications.instances.get("pd-scoreboard"); globalThis.__pd = { closeCalls: [] }; const orig = app.close.bind(app); app.close = (o) => { globalThis.__pd.closeCalls.push(JSON.stringify(o ?? null)); return orig(o).then((r) => { globalThis.__pd.closeResolved = true; return r; }, (e) => { globalThis.__pd.closeError = String(e); throw e; }); }; });
  await popup.evaluate(() => window.close()).catch(() => {});
  await page.waitForTimeout(3500);
  const state = await page.evaluate(() => { const app = foundry.applications.instances.get("pd-scoreboard"); return { ...globalThis.__pd, rendered: app?.rendered, windowId: app?.window?.windowId ?? null, detachedWindows: foundry.applications.detached.windows.size, inMainDom: !!document.getElementById("pd-scoreboard"), instance: !!app }; });
  console.log("after popup close:", JSON.stringify(state));
  await page.waitForFunction(() => { const el = document.getElementById("pd-scoreboard"); const app = foundry.applications.instances.get("pd-scoreboard"); return !!el && app?.rendered && !app.window.windowId; }, null, { timeout: 15000 })
    .then(() => check(true, "board came back to the main window after the popup closed")).catch(() => check(false, "board did not come back"));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/reattached.png` });
  check(errors.length === 0, `no page errors (${errors.length})`);
  for (const e of errors) console.log("   err:", e.slice(0, 200));
} finally { await browser.close(); }
console.log(failures ? `DETACH TEST FAILED (${failures})` : "Detach test passed.");
