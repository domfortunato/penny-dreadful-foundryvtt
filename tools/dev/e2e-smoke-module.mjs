#!/usr/bin/env node
/**
 * End-to-end smoke test for the MODULE flavor: Penny Dreadful as a mini game
 * inside an air-bladder host world, on the local Foundry (FOUNDRY_URL,
 * default http://localhost:30000; FOUNDRY_DATA names the data folder for the
 * module junction, default C:/Users/domin/foundry/data).
 *
 *   npm run dev:smoke-module
 *
 * The script owns its own preconditions: it junctions this repo into
 * Data/modules/penny-dreadful-module if missing, shuts down whatever world is
 * running (via game.shutDown() as the GM), creates the host world
 * "pd-module-host" (system air-bladder) if missing, launches it, and enables
 * the module in it. At the end it launches penny-dreadful-dev again, so the
 * ordinary dev:smoke finds the world it expects.
 *
 * What it proves (the guest-manners contract): the actor sub-types register
 * namespaced beside the host's; the board does NOT open until the Director's
 * mini-game toggle goes on, then opens on every client and closes everywhere
 * when it goes off; the module's board is an ordinary closable window and
 * Alt+B brings it back; Start/End live in the board's ⋮ menu (Director
 * only) and ending asks first; the coin starts a stopped game for the
 * Director and otherwise brings the board back — it never ends one; no character is
 * auto-created while the game is off, and starting it gives the connected
 * player one; the How To opens for the Director at startup and for a player
 * only once the game opens their board; a PC added from the board carries
 * the namespaced type, takes a DS and flips from the chat card; the one-shot
 * reset deletes only the mini game's own actors and messages — the host's
 * actor and chat message survive — and makes the connected player a fresh
 * PC (the game is running); the rules journal opens
 * from its own pack with the pd-journal styling (the content flag read); the
 * host's GM role label and account name are never touched; and disabling the
 * module leaves the world loadable.
 *
 * Playwright is resolved like e2e-smoke.mjs: PLAYWRIGHT_DIR, this repo,
 * ../air-bladder. Screenshots land in tools/dev/out/.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const candidates = [process.env.PLAYWRIGHT_DIR, ROOT, resolve(ROOT, "..", "air-bladder")].filter(Boolean);
const pwRoot = candidates.find((dir) => existsSync(join(dir, "node_modules", "playwright")));
if (!pwRoot) {
  console.error("playwright not found: set PLAYWRIGHT_DIR to a folder whose node_modules has it, or npm install playwright");
  process.exit(2);
}
const require = createRequire(join(pwRoot, "package.json"));
const { chromium } = require("playwright");

const URL = process.env.FOUNDRY_URL ?? "http://localhost:30000";
const DATA = process.env.FOUNDRY_DATA ?? "C:/Users/domin/foundry/data";
const MODULE_ID = "penny-dreadful-module";
const HOST_WORLD = "pd-module-host";
const HOST_SYSTEM = "air-bladder";
const DEV_WORLD = "penny-dreadful-dev";
const OUT = join(ROOT, "tools", "dev", "out");
mkdirSync(OUT, { recursive: true });
const VIEWPORT = { width: 1600, height: 1000 };
let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const check = (cond, m) => (cond ? ok(m) : fail(m));
const note = (m) => console.log(`  note  ${m}`);

/* ------------------------------------------------- server-side plumbing */

const status = async () => (await fetch(`${URL}/api/status`)).json();

const setupPost = async (route, body) => {
  const r = await fetch(`${URL}/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });
  let json = null;
  try { json = await r.json(); } catch { /* redirects have no body */ }
  return { status: r.status, json };
};

const waitFor = async (test, ms, what) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await test().catch(() => false)) return true;
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`timed out waiting for ${what}`);
};

/* ------------------------------------------------- client-side plumbing */

function watchErrors(page, label) {
  const errors = [];
  const ignore = [
    /requires a screen resolution/i, /hardware acceleration/i, /WebGL/i, /THREE\./,
    // EXPECTED whenever the world loads with the module disabled and one of
    // its actors left behind: core preserves the document by marking it
    // invalid for the session, with one loud console error per document.
    // Stage 8 asserts the preservation; stage 1 may meet it on a rerun.
    /is not a valid type for the Actor Document class/,
  ];
  const ignored = (t) => ignore.some((re) => re.test(t));
  page.on("console", (m) => { if (m.type() === "error" && !ignored(m.text())) errors.push(`[${label}] ${m.text()}`); });
  page.on("pageerror", (e) => { const t = `[${label}] pageerror: ${e.message}`; if (!ignored(t)) errors.push(t); });
  return errors;
}

async function dismissChrome(page) {
  const decline = page.getByRole("button", { name: /Decline Sharing/i });
  if (await decline.count()) await decline.first().click().catch(() => {});
  await page.evaluate(() => {
    try { for (const t of globalThis.game?.tours?.contents ?? []) if (t.status === "in-progress") t.exit(); } catch {}
    document.querySelectorAll(".tour-overlay, .tour.active").forEach((e) => e.remove());
    try { ui.notifications?.clear?.(); } catch {}
    document.querySelectorAll("#notifications > li").forEach((e) => e.remove());
  }).catch(() => {});
}

async function joinAs(page, name) {
  await page.goto(`${URL}/join`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('select[name="userid"] option[value]:not([value=""])', { state: "attached", timeout: 30000 });
  const picked = await page.evaluate((name) => {
    const s = document.querySelector('select[name="userid"]');
    const opt = [...s.options].find((o) => o.value && (name === null || o.textContent.trim() === name));
    if (!opt) return null;
    s.value = opt.value;
    s.dispatchEvent(new Event("change", { bubbles: true }));
    return opt.textContent.trim();
  }, name);
  if (!picked) throw new Error(`joinAs: no user ${name ?? "(first)"} offered`);
  await page.locator('button[type="submit"][name="join"], form#join-game button[type="submit"]').first().click({ timeout: 15000 });
  await page.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
  await dismissChrome(page);
  return picked;
}

const boardRendered = (page) => page.evaluate(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered);

/** Drive the newest DialogV2 by DOM: actionability races with its animation. */
const clickDialogButton = async (page, action) => {
  await page.waitForFunction(() => document.querySelectorAll(".pd-dialog").length > 0, null, { timeout: 10000 });
  await page.evaluate((action) => {
    const d = [...document.querySelectorAll(".pd-dialog")].pop();
    d.querySelector(`button[data-action="${action}"]`)?.click();
  }, action);
};

const browser = await chromium.launch({ headless: true });
// 600s, not the system smoke's 360: this run launches two worlds and reloads
// the client twice on top of the checks themselves.
const watchdog = setTimeout(async () => { console.error("  FAIL  probe exceeded 600s"); await browser.close().catch(() => {}); process.exit(1); }, 600000);
watchdog.unref();

try {
  /* ------------------------------------------ stage 0: world and module */
  console.log("Stage 0: the host world");

  const junction = join(DATA, "Data", "modules", MODULE_ID);
  if (!existsSync(junction)) {
    symlinkSync(ROOT, junction, "junction");
    note(`junctioned ${junction} -> ${ROOT}`);
  }

  let st = await status();
  if (st.active && st.world !== HOST_WORLD) {
    // Whatever world is up, its first user is a GM with no password here.
    note(`shutting down the running world via its GM`);
    const ctx = await browser.newContext({ viewport: VIEWPORT });
    const page = await ctx.newPage();
    await joinAs(page, null);
    // Fire, never await: with another user connected (Dom testing, say)
    // game.shutDown() pops a confirm, so answer it a beat later.
    await page.evaluate(() => { game.shutDown(); }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      document.querySelector('.application.dialog button[data-action="yes"]')?.click();
    }).catch(() => {});
    await ctx.close();
    await waitFor(async () => !(await status()).active, 60000, "the server to return to setup");
    st = await status();
  }
  if (!st.active) {
    const created = await setupPost("create", { action: "createWorld", id: HOST_WORLD, title: "PD Module Host", system: HOST_SYSTEM });
    if (created.json?.error && !/already exists/i.test(created.json.error)) {
      throw new Error(`createWorld failed: ${created.json.error}`);
    }
    note(created.json?.error ? `world ${HOST_WORLD} already exists` : `world ${HOST_WORLD} created`);
    await setupPost("setup", { action: "launchWorld", world: HOST_WORLD });
    await waitFor(async () => (await status()).active, 90000, `${HOST_WORLD} to launch`);
  }
  check((await status()).world === HOST_WORLD || (await status()).active, `the host world is up`);

  /* ------------------------------------------------ stage 1: GM joins */
  const gmCtx = await browser.newContext({ viewport: VIEWPORT });
  const gm = await gmCtx.newPage();
  const gmErrors = watchErrors(gm, "GM");
  const gmName = await joinAs(gm, null);
  console.log(`\nStage 1: joined "${gmName}" in ${HOST_WORLD}`);

  const enabled = await gm.evaluate((id) => game.modules.get(id)?.active === true, MODULE_ID);
  if (!enabled) {
    await gm.evaluate(async (id) => {
      const cfg = { ...game.settings.get("core", "moduleConfiguration"), [id]: true };
      await game.settings.set("core", "moduleConfiguration", cfg);
    }, MODULE_ID);
    await gm.reload({ waitUntil: "networkidle" });
    await gm.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
    await dismissChrome(gm);
    note("module enabled in the host world (reloaded)");
  }
  check(await gm.evaluate((id) => game.modules.get(id)?.active === true, MODULE_ID), "the module is active");

  // The Director sees the module's own How To at startup (re-armed first: a
  // crashed run may have left this user's "Show next time" off).
  if (!(await gm.evaluate((id) => game.settings.get(id, "showHowTo"), MODULE_ID))) {
    await gm.evaluate((id) => game.settings.set(id, "showHowTo", true), MODULE_ID);
    await gm.reload({ waitUntil: "networkidle" });
    await gm.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
    await dismissChrome(gm);
  }
  await gm.waitForFunction(() => !!foundry.applications.instances.get("pd-how-to")?.rendered, null, { timeout: 10000 })
    .then(() => ok("the How To opened at startup for the Director")).catch(() => fail("the How To opened at startup for the Director"));
  const guide = await gm.evaluate(() => [...document.querySelectorAll("#pd-how-to .pd-how-to-body h2")].map((h) => h.textContent.trim()));
  check(guide.includes("The Mini Game") && guide.includes("For Players"), `the module's own How To (${guide.join(" / ")})`);
  await gm.evaluate(() => document.querySelector("#pd-how-to .pd-how-to-close")?.click());

  // Deterministic start: a previous run leaves the toggle on, a benched NPC,
  // keepsakes and Bob behind. Bob may stay; the rest goes. Auto-create is
  // pinned to its new default, ON (it acts only while the game runs).
  await gm.evaluate(async (id) => {
    await game.settings.set(id, "miniGameActive", false);
    await game.settings.set(id, "autoCreateCharacters", true);
    const actors = game.actors
      .filter((a) => a.type.startsWith(`${id}.`) || a.name === "Host Keepsake")
      .map((a) => a.id);
    if (actors.length) await foundry.documents.Actor.deleteDocuments(actors);
    const msgs = game.messages.filter((m) => !!m.flags?.[id] || /host campaign was here/.test(m.content)).map((m) => m.id);
    if (msgs.length) await foundry.documents.ChatMessage.deleteDocuments(msgs);
  }, MODULE_ID);
  await gm.waitForTimeout(1000);

  /* ---------------------------------------- stage 2: a guest, unpacked */
  console.log("\nStage 2: namespaced types, dormant board");
  const s2 = await gm.evaluate((id) => ({
    system: game.system.id,
    types: game.documentTypes.Actor.filter((t) => t.startsWith(id)),
    models: Object.keys(CONFIG.Actor.dataModels).filter((t) => t.startsWith(id)),
    hostModels: Object.keys(CONFIG.Actor.dataModels).filter((t) => !t.startsWith(id) && t !== "base").length,
    pcLabel: game.i18n.localize(`TYPES.Actor.${id}.character`),
    boardOpen: !!foundry.applications.instances.get("pd-scoreboard")?.rendered,
    autoCreateDefault: game.settings.settings.get(`${id}.autoCreateCharacters`)?.default,
    miniGame: game.settings.get(id, "miniGameActive"),
    gmLabel: game.i18n.localize("USER.RoleGamemaster"),
    pack: !!game.packs.get(`${id}.rules`),
    packSize: game.packs.get(`${id}.rules`)?.index.size ?? 0,
    howToJournal: !!game.packs.get(`${id}.rules`)?.index.find((e) => e.name === "How to Play Penny Dreadful"),
  }), MODULE_ID);
  check(s2.system === HOST_SYSTEM, `the host system is ${s2.system}`);
  check(s2.types.length === 2 && s2.models.length === 2, `both sub-types registered namespaced (${s2.types.join(", ")})`);
  check(s2.hostModels > 0, `the host's own data models survive the merge (${s2.hostModels} of them)`);
  check(s2.pcLabel === "Character (Penny Dreadful)", `the PC type label localizes (${s2.pcLabel})`);
  check(s2.boardOpen === false, "the board stays closed while the mini game is off");
  check(s2.autoCreateDefault === true, "auto-create defaults ON in the module (it acts only while the game runs)");
  check(s2.miniGame === false, "the mini-game toggle starts off");
  check(s2.gmLabel !== "The Director", `the host's GM role label is untouched (${s2.gmLabel})`);
  check(s2.pack && s2.packSize === 3 && s2.howToJournal,
    `the rules pack is ${MODULE_ID}.rules with ${s2.packSize} entries, the How To among them`);

  // The host's own furniture, which the one-shot must not touch.
  const hostBaseline = await gm.evaluate(async (id) => {
    const hostType = game.documentTypes.Actor.find((t) => t !== "base" && !t.startsWith(id));
    const actor = await foundry.documents.Actor.create({ name: "Host Keepsake", type: hostType });
    const msg = await foundry.documents.ChatMessage.create({ content: "The host campaign was here." });
    return { hostType, actorId: actor.id, msgId: msg.id };
  }, MODULE_ID);
  ok(`host keepsakes created (a "${hostBaseline.hostType}" actor and a chat message)`);

  // Dom's rule — a character's name is at most 25 characters — holds for
  // OUR types, and a guest never trims a host actor's name.
  const nameCap = await gm.evaluate(async ({ id, hostType }) => {
    const long = "Bartholomew Montgomery-Smythe"; // 29
    const npc = await foundry.documents.Actor.create({ name: long, type: `${id}.npc` });
    const ours = npc.name;
    const token = npc.prototypeToken.name;
    await npc.update({ name: `${long} the Third` });
    const renamed = npc.name;
    const host = await foundry.documents.Actor.create({ name: long, type: hostType });
    const hosts = host.name;
    await foundry.documents.Actor.deleteDocuments([npc.id, host.id]);
    return { ours, token, renamed, hosts };
  }, { id: MODULE_ID, hostType: hostBaseline.hostType });
  check(nameCap.ours === "Bartholomew Montgomery-Sm" && nameCap.renamed === "Bartholomew Montgomery-Sm",
    `our characters' names are cut to 25 on create and rename (${nameCap.ours} / ${nameCap.renamed})`);
  check(nameCap.token === "Bartholomew Montgomery-Sm", `the prototype token's name is cut with it (${nameCap.token})`);
  check(nameCap.hosts === "Bartholomew Montgomery-Smythe", `a host actor keeps its full name (${nameCap.hosts})`);

  // Guest manners (seventh review): the host's own type labels survive our
  // lang file, and the mini-game switch is reachable without a canvas.
  const manners = await gm.evaluate((id) => ({
    hostPc: game.i18n.localize("TYPES.Actor.character"),
    hostNpc: game.i18n.localize("TYPES.Actor.npc"),
    settingShown: game.settings.settings.get(`${id}.miniGameActive`)?.config === true,
  }), MODULE_ID);
  check(manners.hostPc === "Player Character" && manners.hostNpc === "Non-Player Character",
    `the host's own actor type labels are untouched (${manners.hostPc} / ${manners.hostNpc})`);
  check(manners.settingShown, "the mini-game switch is in Configure Settings (the coin is dead without a canvas)");

  await gm.evaluate(async () => {
    if (!game.users.getName("Bob")) await foundry.documents.User.create({ name: "Bob", role: 1 });
  });

  /* --------------------------------------------- stage 3: player joins */
  const bobCtx = await browser.newContext({ viewport: VIEWPORT });
  const bob = await bobCtx.newPage();
  const bobErrors = watchErrors(bob, "Bob");
  await joinAs(bob, "Bob");
  console.log("\nStage 3: Bob joins; nothing is seeded for him");
  await gm.waitForTimeout(2000);
  check(await gm.evaluate((id) => !game.actors.find((a) => a.type === `${id}.character`), MODULE_ID),
    "no character was auto-created for the connecting player while the game is off");
  check(!(await bob.evaluate(() => !!foundry.applications.instances.get("pd-how-to")?.rendered)),
    "a player is shown no How To while no game runs");
  // Arm Bob's own "Show next time" (a per-user setting only he can write),
  // so the start below shows him the How To.
  await bob.evaluate((id) => game.settings.set(id, "showHowTo", true), MODULE_ID);

  // The Director's ⋮ header menu, by real clicks: open it, click the entry.
  const menuEntries = async (page) => {
    await page.click('#pd-scoreboard .header-control[data-action="toggleControls"]');
    await page.waitForSelector("#context-menu .context-item", { timeout: 5000 });
    return page.$$eval("#context-menu .context-item", (els) => els.map((e) => e.textContent.trim()));
  };
  const clickMenu = (page, label) => page.click(`#context-menu .context-item:has-text("${label}")`);
  const dialogButton = (page, action) => page.evaluate((a) => {
    [...document.querySelectorAll(".pd-dialog")].pop()?.querySelector(`button[data-action="${a}"]`)?.click();
  }, action);
  const gameOn = (id) => gm.evaluate((m) => game.settings.get(m, "miniGameActive"), id);

  /* ------------------------------------------------ stage 4: the toggle */
  console.log("\nStage 4: the mini-game toggle");
  const tool = await gm.evaluate(() => ui.controls?.controls?.tokens?.tools?.pdScoreboard ?? null);
  if (tool) {
    check(tool.button === true && !tool.toggle && tool.title === "PD.Controls.MiniGame",
      `with the game off, the Director's coin is a button that offers to start it (${tool.title})`);
  } else note("no scene controls without a canvas; the game is started from the board, as a Director would");

  // No canvas needed: Alt+B opens the Director's own board while the game is
  // off, and the board's ⋮ menu starts the game for everyone. No toolbar
  // power button any more (Dom: too prominent).
  await gm.keyboard.press("Alt+KeyB");
  await gm.waitForFunction(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 10000 })
    .then(() => ok("with the game off, Alt+B opens the Director's own board")).catch(() => fail("with the game off, Alt+B opens the Director's own board"));
  check(!(await gm.evaluate(() => !!document.querySelector('#pd-scoreboard [data-action="toggleMiniGame"]'))),
    "the board's toolbar carries no power button");
  check(!(await boardRendered(bob)), "Bob's board stays shut until the game starts");
  const offMenu = await menuEntries(gm);
  check(offMenu.includes("Start the Penny Dreadful Mini Game"), `the ⋮ menu offers Start (${offMenu.join(" / ")})`);
  await clickMenu(gm, "Start the Penny Dreadful Mini Game");
  await gm.waitForFunction((id) => game.settings.get(id, "miniGameActive") === true, MODULE_ID, { timeout: 10000 })
    .then(() => ok("Start from the ⋮ menu started the mini game, no confirm")).catch(() => fail("Start from the ⋮ menu started the mini game, no confirm"));
  await gm.waitForFunction(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 10000 })
    .then(() => ok("toggle on: the board is open for the Director")).catch(() => fail("toggle on: the board is open for the Director"));
  await bob.waitForFunction(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 10000 })
    .then(() => ok("toggle on: the board opened for Bob")).catch(() => fail("toggle on: the board opened for Bob"));
  await bob.waitForFunction(() => !!foundry.applications.instances.get("pd-how-to")?.rendered, null, { timeout: 10000 })
    .then(() => ok("Bob sees the How To the first time the game opens his board")).catch(() => fail("Bob sees the How To the first time the game opens his board"));
  await bob.evaluate(() => document.querySelector("#pd-how-to .pd-how-to-close")?.click());
  await gm.waitForFunction((id) => {
    const bob = game.users.getName("Bob");
    return game.actors.some((a) => a.type === `${id}.character` && a.ownership[bob.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
  }, MODULE_ID, { timeout: 15000 })
    .then(() => ok("starting the game gave the connected player Bob a PC")).catch(() => fail("starting the game gave the connected player Bob a PC"));
  const toolOn = await gm.evaluate(() => ui.controls?.controls?.tokens?.tools?.pdScoreboard?.title ?? null);
  if (toolOn !== null) check(toolOn === "PD.Controls.ScoreboardModule", `with the game on, the coin offers the board, not an end (${toolOn})`);
  const bobEntries = await bob.evaluate(() => (foundry.applications.instances.get("pd-scoreboard")?._getHeaderControls() ?? []).map((c) => c.label));
  check(!bobEntries.some((l) => /MiniGame/.test(l)), `a player's ⋮ menu has no Start/End (${bobEntries.join(" / ")})`);

  const closeX = await gm.evaluate(() => {
    const x = document.getElementById("pd-scoreboard")?.querySelector('.header-control[data-action="close"]');
    if (!x) return null;
    const r = x.getBoundingClientRect();
    return { display: getComputedStyle(x).display, width: r.width, height: r.height };
  });
  check(closeX && closeX.display !== "none" && closeX.width > 0 && closeX.height > 0,
    `the module's board shows its close button (${JSON.stringify(closeX)})`);
  await bob.evaluate(() => foundry.applications.instances.get("pd-scoreboard").close());
  await bob.waitForTimeout(500);
  check(!(await boardRendered(bob)), "Bob can close his board");
  check(await boardRendered(gm), "the Director's board stays open");
  await bob.keyboard.press("Alt+KeyB");
  await bob.waitForFunction(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 5000 })
    .then(() => ok("Alt+B brings Bob's board back")).catch(() => fail("Alt+B brings Bob's board back"));

  // Ending asks first. Cancel changes nothing; End closes every board.
  const onMenu = await menuEntries(gm);
  check(onMenu.includes("End the Penny Dreadful Mini Game"), `with the game on, the ⋮ menu offers End (${onMenu.join(" / ")})`);
  await clickMenu(gm, "End the Penny Dreadful Mini Game");
  await gm.waitForFunction(() => !!document.querySelector('.pd-dialog button[data-action="no"]'), null, { timeout: 5000 })
    .then(() => ok("End asks first")).catch(() => fail("End asks first"));
  const endBody = await gm.evaluate(() => [...document.querySelectorAll(".pd-dialog")].pop()?.querySelector(".window-content")?.textContent ?? "");
  check(/will close/.test(endBody) && /Nothing is deleted/.test(endBody), `the end confirm says what will happen (${endBody.replace(/\s+/g, " ").trim().slice(0, 90)})`);
  await dialogButton(gm, "no");
  await gm.waitForTimeout(800);
  check((await gameOn(MODULE_ID)) === true && (await boardRendered(bob)), "Cancel keeps the game on and Bob's board open");
  check(await gm.evaluate(() => /still running/.test(document.querySelector("#notifications")?.textContent ?? "")),
    "a cancelled End says the game is still running");
  await menuEntries(gm);
  await clickMenu(gm, "End the Penny Dreadful Mini Game");
  await gm.waitForFunction(() => !!document.querySelector('.pd-dialog button[data-action="yes"]'), null, { timeout: 5000 });
  await dialogButton(gm, "yes");
  await gm.waitForFunction(() => !foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 10000 })
    .then(() => ok("End: the board closed for the Director")).catch(() => fail("End: the board closed for the Director"));
  await bob.waitForFunction(() => !foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 10000 })
    .then(() => ok("End: the board closed for Bob")).catch(() => fail("End: the board closed for Bob"));
  // Restart with the coin where there is one: with the game off, the
  // Director's coin STARTS it — one click, no confirm.
  if (await gm.evaluate(() => !!document.querySelector('#scene-controls button.tool[data-tool="pdScoreboard"]'))) {
    await gm.click('#scene-controls button.tool[data-tool="pdScoreboard"]');
    await gm.waitForFunction((id) => game.settings.get(id, "miniGameActive") === true, MODULE_ID, { timeout: 10000 })
      .then(() => ok("with the game off, the Director's coin starts it, no confirm")).catch(() => fail("with the game off, the Director's coin starts it, no confirm"));
  } else {
    await gm.evaluate((id) => game.settings.set(id, "miniGameActive", true), MODULE_ID);
  }
  await gm.waitForFunction(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 10000 });
  await bob.waitForFunction(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 10000 })
    .then(() => ok("…and Bob's board opens again")).catch(() => fail("…and Bob's board opens again"));

  // Dom's report: closing the board with its X, then clicking the coin to
  // get it back, asked to END the game — and Cancel left the board shut.
  // The coin never ends the game: it brings the board back.
  const coin = '#scene-controls button.tool[data-tool="pdScoreboard"]';
  if (await gm.evaluate((sel) => !!document.querySelector(sel), coin)) {
    await gm.click('#pd-scoreboard .header-control[data-action="close"]');
    await gm.waitForFunction(() => !foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 5000 })
      .then(() => ok("the Director's X closes their own board")).catch(() => fail("the Director's X closes their own board"));
    await gm.click(coin);
    await gm.waitForFunction(() => !!foundry.applications.instances.get("pd-scoreboard")?.rendered, null, { timeout: 5000 })
      .then(() => ok("with the game running, the coin brings the board back")).catch(() => fail("with the game running, the coin brings the board back"));
    check(!(await gm.evaluate(() => !!document.querySelector(".pd-dialog"))) && (await gameOn(MODULE_ID)) === true,
      "…with no end confirm, and the game still running");
  } else note("no coin on screen without a canvas; Alt+B brings the board back");

  /* ----------------------------------------- stage 5: a PC, a DS, a flip */
  console.log("\nStage 5: play a beat of the game");
  await gm.evaluate(() => document.querySelector('#pd-scoreboard button[data-action="addCharacter"]').click());
  await gm.waitForFunction(() => document.querySelectorAll(".pd-dialog").length > 0, null, { timeout: 10000 });
  await gm.evaluate(() => {
    const d = [...document.querySelectorAll(".pd-dialog")].pop();
    const input = d.querySelector('input[name="newName"]');
    input.value = "Module Smoke PC";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await clickDialogButton(gm, "add");
  await gm.waitForFunction((id) => {
    const a = game.actors.getName("Module Smoke PC");
    return a?.type === `${id}.character` && a.system.onBoard === true
      && !!document.querySelector(`#pd-scoreboard tr[data-actor-id="${a.id}"]`);
  }, MODULE_ID, { timeout: 10000 })
    .then(() => ok("a PC added from the board carries the namespaced type and a row"))
    .catch(() => fail("a PC added from the board carries the namespaced type and a row"));

  const pcId = await gm.evaluate(() => game.actors.getName("Module Smoke PC")?.id ?? null);

  // Handing a PC to a player must not make it their HOST primary character
  // (core would speak their ordinary host chat as it). The module's own
  // assignPlayer, imported from its URL — the same instance the board uses.
  const pointer = await gm.evaluate(async ({ id, pcId }) => {
    const { assignPlayer } = await import(`/modules/${id}/module/players.js`);
    const bob = game.users.getName("Bob");
    const before = bob.character?.id ?? null;
    await assignPlayer(game.actors.get(pcId), bob.id);
    return {
      before,
      after: game.users.getName("Bob").character?.id ?? null,
      owner: game.actors.get(pcId).ownership[bob.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
    };
  }, { id: MODULE_ID, pcId });
  check(pointer.owner, "the Director handed the PC to Bob");
  check(pointer.after === pointer.before, `Bob's host primary character is untouched (${pointer.before} → ${pointer.after})`);
  await gm.evaluate((id) => {
    document.querySelector(`#pd-scoreboard tr[data-actor-id="${id}"] button[data-action="issueChallenge"][data-ds="1"]`).click();
  }, pcId);
  await gm.waitForFunction((id) => game.actors.get(id)?.system.challenge.ds === 1, pcId, { timeout: 10000 })
    .then(() => ok("the Director asked for a DS 1")).catch(() => fail("the Director asked for a DS 1"));
  await gm.waitForFunction(() => !!document.querySelector("#chat .pd-request-flip, #chat-log .pd-request-flip"), null, { timeout: 10000 })
    .then(() => ok("the ask landed in the host's chat as a card with a Flip button"))
    .catch(() => fail("the ask landed in the host's chat as a card with a Flip button"));
  await gm.evaluate(() => [...document.querySelectorAll(".pd-request-flip")].pop().click());
  await gm.waitForFunction((id) => {
    const c = game.actors.get(id)?.system.challenge;
    return c && c.ds === null && c.resolved !== null;
  }, pcId, { timeout: 20000 })
    .then(() => ok("the flip resolved and the row records it")).catch(() => fail("the flip resolved and the row records it"));

  await gm.evaluate(() => document.querySelector('#pd-scoreboard button[data-action="addNpc"]').click());
  await gm.waitForFunction(() => document.querySelectorAll(".pd-dialog").length > 0, null, { timeout: 10000 });
  await gm.evaluate(() => {
    const d = [...document.querySelectorAll(".pd-dialog")].pop();
    const input = d.querySelector('input[name="newName"]');
    input.value = "Module Smoke NPC";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await clickDialogButton(gm, "add");
  await gm.waitForFunction((id) => game.actors.getName("Module Smoke NPC")?.type === `${id}.npc`, MODULE_ID, { timeout: 10000 })
    .then(() => ok("an NPC added from the board carries the namespaced type"))
    .catch(() => fail("an NPC added from the board carries the namespaced type"));

  // The tab tags OUR actors only. A host actor wearing "(PC-PD)" was Dom's
  // first field report from this very world: the old check read "not our
  // NPC" as "our PC".
  const tags = await gm.evaluate(async () => {
    ui.sidebar.expand();
    ui.sidebar.changeTab("actors", "primary");
    await new Promise((r) => setTimeout(r, 800));
    const names = [...document.querySelectorAll("#actors li.directory-item.entry")]
      .map((li) => li.querySelector(".entry-name")?.textContent.replace(/\s+/g, " ").trim());
    ui.sidebar.changeTab("chat", "primary");
    return {
      pc: names.find((n) => n?.startsWith("Module Smoke PC")),
      npc: names.find((n) => n?.startsWith("Module Smoke NPC")),
      host: names.find((n) => n?.startsWith("Host Keepsake")),
    };
  });
  check(tags.pc?.endsWith("(PC-PD)") && tags.npc?.endsWith("(NPC-PD)") && tags.host === "Host Keepsake",
    `the Actors tab tags only the mini game's actors (${JSON.stringify(tags)})`);

  await gm.screenshot({ path: join(OUT, "module-board.png") });
  note("screenshot: tools/dev/out/module-board.png");

  /* -------------------------------- stage 6: the one-shot spares the host */
  console.log("\nStage 6: the one-shot reset is a guest");
  const before = await gm.evaluate(() => game.messages.size);
  await gm.evaluate(() => document.querySelector('#pd-scoreboard button[data-action="newOneShot"]').click());
  await gm.waitForFunction(() => !!document.querySelector('.pd-dialog button[data-action="yes"]'), null, { timeout: 10000 });
  const resetText = await gm.evaluate(() => [...document.querySelectorAll(".pd-dialog")].pop()?.querySelector(".window-content")?.textContent ?? "");
  check(/fresh character is created/.test(resetText) && /host campaign/.test(resetText),
    `with the game running and auto-create on, the reset promises fresh PCs and spares the host (${resetText.replace(/\s+/g, " ").trim().slice(0, 120)})`);
  await clickDialogButton(gm, "yes");
  // ONE settle wait folding every end-state condition: the chat clear lands
  // after the actor writes, so a wait on the actors alone reads the message
  // counts mid-reset (the system smoke learned the same the hard way).
  await gm.waitForFunction((args) => {
    const [id, hostActorId] = args;
    return !game.actors.getName("Module Smoke PC")
      && !!game.actors.get(hostActorId)
      && game.actors.getName("Module Smoke NPC")?.system.onBoard === false
      && game.messages.filter((m) => !!m.flags?.[id]).length === 0;
  }, [MODULE_ID, hostBaseline.actorId], { timeout: 30000 })
    .then(() => ok("the reset deleted the PC, benched the NPC and spared the host's actor"))
    .catch(() => fail("the reset deleted the PC, benched the NPC and spared the host's actor"));
  // The fresh PC for the connected player lands last, after the chat clear.
  await gm.waitForFunction((id) => game.actors.filter((a) => a.type === `${id}.character`).length === 1, MODULE_ID, { timeout: 15000 })
    .catch(() => {});
  const after = await gm.evaluate((args) => {
    const [id, msgId] = args;
    return {
      hostMsg: !!game.messages.get(msgId),
      pdMsgs: game.messages.filter((m) => !!m.flags?.[id]).length,
      spotlight: game.settings.get(id, "spotlightActorId"),
      freshPcs: game.actors.filter((a) => a.type === `${id}.character`).length,
      bobsFresh: game.actors.some((a) => a.type === `${id}.character`
        && a.ownership[game.users.getName("Bob")?.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER),
      total: game.messages.size,
    };
  }, [MODULE_ID, hostBaseline.msgId]);
  check(after.hostMsg, "the host's chat message survived the reset");
  check(after.pdMsgs === 0, "every mini-game message is gone");
  check(after.spotlight === "", "the spotlight went out");
  check(after.freshPcs === 1 && after.bobsFresh, `the connected player got one fresh PC (${after.freshPcs} PCs, Bob's: ${after.bobsFresh})`);
  note(`chat went from ${before} to ${after.total} messages`);

  /* ----------------------------------------- stage 7: the rules journal */
  console.log("\nStage 7: the shipped journals");
  await gm.evaluate(() => document.querySelector('#pd-scoreboard button[data-action="openRules"]').click());
  // Wait for the class, not just any journal element: the render hook that
  // applies pd-journal races a selector on the bare sheet.
  await gm.waitForFunction(() => !!document.querySelector(".pd-journal"), null, { timeout: 15000 })
    .then(() => ok("the rules journal opens from the module's pack with pd-journal styling (the baked content flag is read)"))
    .catch(() => fail("the rules journal opens from the module's pack with pd-journal styling (the baked content flag is read)"));

  /* ------------------------------------- stage 8: disable leaves it whole */
  console.log("\nStage 8: disabling the module");
  const npcId = await gm.evaluate(() => game.actors.getName("Module Smoke NPC")?.id ?? null);
  await gm.evaluate(async (id) => {
    const cfg = { ...game.settings.get("core", "moduleConfiguration"), [id]: false };
    await game.settings.set("core", "moduleConfiguration", cfg);
  }, MODULE_ID);
  await gm.reload({ waitUntil: "networkidle" });
  await gm.waitForFunction(() => globalThis.game?.ready === true, null, { timeout: 90000 });
  await dismissChrome(gm);
  const s8 = await gm.evaluate((args) => {
    const [id, hostActorId, npcId] = args;
    return {
      active: game.modules.get(id)?.active === true,
      hostActor: !!game.actors.get(hostActorId),
      board: !!document.getElementById("pd-scoreboard"),
      npcKept: !!npcId && game.actors.invalidDocumentIds.has(npcId),
    };
  }, [MODULE_ID, hostBaseline.actorId, npcId]);
  check(!s8.active && s8.hostActor && !s8.board, "disabled, the world loads and the host's actor is still there");
  check(s8.npcKept, "the mini game's leftover NPC is preserved, locked as invalid (core's behavior, the recorded caveat)");

  /* ------------------------------------------------------------- errors */
  console.log("");
  check(gmErrors.length === 0 && bobErrors.length === 0,
    `no console errors on either client${gmErrors.length || bobErrors.length ? `:\n    ${[...gmErrors, ...bobErrors].join("\n    ")}` : ""}`);

  /* -------------------------------------------------- restore dev world */
  // Bob first: game.shutDown() pops a confirm while another user is
  // connected, and an unanswered dialog hangs the evaluate forever.
  await bobCtx.close().catch(() => {});
  await gm.waitForTimeout(2000);
  await gm.evaluate(() => { game.shutDown(); }).catch(() => {});
  await gm.waitForTimeout(1500);
  await gm.evaluate(() => {
    document.querySelector('.application.dialog button[data-action="yes"]')?.click();
  }).catch(() => {});
  await waitFor(async () => !(await status()).active, 60000, "the host world to shut down").catch(() => {});
  // The launch can race the teardown; ask again until the world is up.
  let restored = false;
  for (let i = 0; i < 4 && !restored; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    await setupPost("setup", { action: "launchWorld", world: DEV_WORLD }).catch(() => {});
    restored = await waitFor(async () => (await status()).active, 30000, "").catch(() => false);
  }
  note(restored ? `${DEV_WORLD} relaunched` : `relaunch ${DEV_WORLD} by hand`);
} catch (err) {
  fail(`aborted: ${err.message}`);
} finally {
  await browser.close().catch(() => {});
}

console.log(`\n${failures ? `PROBE FAILED (${failures})` : "Probe passed."}`);
process.exit(failures ? 1 : 0);
