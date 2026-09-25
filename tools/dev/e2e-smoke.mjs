#!/usr/bin/env node
/**
 * End-to-end smoke test against a running Foundry world on FOUNDRY_URL
 * (default http://localhost:30000) that has this system loaded, with or
 * without Dice So Nice (it is never required; the hold checks run only when
 * it is active). Two browser contexts: the Director and a player, Alice.
 *
 *   npm run dev:smoke
 *   FOUNDRY_URL=http://192.168.30.125:30000 npm run dev:smoke
 *
 * What it proves: the Director relabel and rename; the board renders for both
 * users with no close control and survives Escape and close(); the book and
 * percent buttons open the rules and the odds; Alice's
 * character is auto-created; a DS lands in chat as a card with a Flip button
 * (for Alice and the Director only; no dialog); the flip resolves and
 * the board follows; a forced ten-penny failure marks death; minus revives;
 * an NPC sits in its own section, dies on a forced five-penny failure and is
 * removed. Creates users Alice and
 * Bob if missing and resets Alice's row each run.
 *
 * Playwright is not a dependency of this repo. The script resolves it from
 * PLAYWRIGHT_DIR, else this repo's node_modules, else ../air-bladder, which
 * has it installed. Screenshots land in tools/dev/out/.
 */
import { createRequire } from "node:module";
import { existsSync, mkdirSync } from "node:fs";
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
const OUT = join(ROOT, "tools", "dev", "out");
mkdirSync(OUT, { recursive: true });
const VIEWPORT = { width: 1600, height: 1000 };
let failures = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => { failures++; console.error(`  FAIL  ${m}`); };
const check = (cond, m) => (cond ? ok(m) : fail(m));

function watchErrors(page, label) {
  const errors = [];
  const ignore = [/requires a screen resolution/i, /hardware acceleration/i, /WebGL/i, /THREE\./];
  page.on("console", (m) => { if (m.type() === "error" && !ignore.some((re) => re.test(m.text()))) errors.push(`[${label}] ${m.text()}`); });
  page.on("pageerror", (e) => { const t = `[${label}] pageerror: ${e.message}`; if (!ignore.some((re) => re.test(t))) errors.push(t); });
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

const browser = await chromium.launch({ headless: true });
const watchdog = setTimeout(async () => { console.error("  FAIL  probe exceeded 240s"); await browser.close().catch(() => {}); process.exit(1); }, 240000);
watchdog.unref();

try {
  /* ---------------------------------------------------------- stage 1: GM */
  const gmCtx = await browser.newContext({ viewport: VIEWPORT });
  const gm = await gmCtx.newPage();
  const gmErrors = watchErrors(gm, "GM");
  const gmName = await joinAs(gm, null);
  console.log(`\nStage 1: joined as "${gmName}"`);

  await gm.waitForTimeout(1500);
  // Dice So Nice is never required. When it happens to be active, the hold cycle is exercised too.
  const dsn = await gm.evaluate(() => game.modules.get("dice-so-nice")?.active === true && !!game.dice3d);
  console.log(`  note  Dice So Nice ${dsn ? "active: the hold cycle will be exercised" : "absent: the board must show no hold button"}`);
  await gm.evaluate(async () => {
    await game.settings.set("penny-dreadful", "holdCoins", false);
    await game.settings.set("penny-dreadful", "npcMaxPennies", 5);
  });

  const s1 = await gm.evaluate(() => {
    const app = foundry.applications.instances.get("pd-scoreboard");
    const el = document.getElementById("pd-scoreboard");
    return {
      system: game.system.id,
      user: game.user.name,
      roleLabel: game.i18n.localize("USER.RoleGamemaster"),
      assistantLabel: game.i18n.localize("USER.RoleAssistant"),
      gmUserNames: game.users.filter((u) => u.isGM).map((u) => u.name),
      boardRendered: !!app?.rendered,
      boardInDom: !!el,
      closeButton: !!el?.querySelector('.header-control[data-action="close"]'),
      minimizable: app?.options.window.minimizable,
      rows: [...(el?.querySelectorAll("tr.pd-row") ?? [])].length,
      holdButton: !!el?.querySelector('button[data-action="holdCoins"]'),
      rulesPack: !!game.packs.get("penny-dreadful.rules"),
      rulesIndex: game.packs.get("penny-dreadful.rules")?.index.size,
      sceneTool: !!ui.controls?.controls?.tokens?.tools?.pdScoreboard,
    };
  });
  console.log(JSON.stringify(s1, null, 2));
  check(s1.system === "penny-dreadful", "world runs penny-dreadful");
  check(s1.roleLabel === "The Director", `GM role label is "${s1.roleLabel}"`);
  check(s1.gmUserNames.includes("The Director"), `GM user renamed: ${s1.gmUserNames.join(", ")}`);
  check(s1.boardRendered && s1.boardInDom, "scoreboard rendered and in the DOM");
  check(!s1.closeButton, "scoreboard has no close button");
  check(s1.minimizable === false, "scoreboard is not minimizable");
  check(s1.rulesPack && s1.rulesIndex === 2, `rules pack present with ${s1.rulesIndex} entries (rules and odds)`);
  check(s1.holdButton === dsn, dsn ? "hold button offered with the dice module active" : "no hold button without the dice module");
  check(s1.sceneTool, "scene-control button registered");

  // Escape must not close it; close() must be a no-op.
  await gm.keyboard.press("Escape");
  await gm.waitForTimeout(300);
  const afterEsc = await gm.evaluate(async () => {
    const app = foundry.applications.instances.get("pd-scoreboard");
    await app.close();
    return app.rendered && !!document.getElementById("pd-scoreboard");
  });
  check(afterEsc, "Escape and close() leave the board on screen");
  // Core opens the main menu on an Escape that closed nothing; put it away.
  await gm.evaluate(() => ui.menu?.close?.());
  await gm.waitForTimeout(400);

  // Book button opens the rules journal.
  await gm.click('#pd-scoreboard button[data-action="openRules"]');
  await gm.waitForTimeout(1500);
  const rules = await gm.evaluate(() => {
    const app = [...foundry.applications.instances.values()].find((a) => a.document?.documentName === "JournalEntry" && a.rendered);
    const header = app?.element.querySelector(".journal-header");
    return { open: !!app, flagged: app?.element.classList.contains("pd-journal"),
      headerHidden: !header || getComputedStyle(header).display === "none",
      pageHeadings: app?.element.querySelectorAll(".journal-entry-page > header h1, .journal-entry-page .journal-page-header h1").length ?? 0 };
  });
  check(rules.open, "book button opened the rules journal");
  check(rules.flagged && rules.headerHidden, `rules journal hides the repeated name field (${JSON.stringify(rules)})`);
  check(rules.pageHeadings >= 1, `rules pages keep their headings (${rules.pageHeadings})`);
  await gm.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.document?.documentName === "JournalEntry") a.close(); });
  await gm.waitForTimeout(500);

  // Percent button opens the odds table.
  await gm.click('#pd-scoreboard button[data-action="openOdds"]');
  await gm.waitForTimeout(1500);
  const odds = await gm.evaluate(() => {
    const app = [...foundry.applications.instances.values()].find((a) => a.document?.documentName === "JournalEntry" && a.rendered);
    const rows = [...(app?.element?.querySelectorAll("table tbody tr") ?? [])].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
    const header = app?.element.querySelector(".journal-header");
    return { name: app?.document?.name, cells: rows.flat().length - rows.length,
      tenVsFive: rows[9]?.[5], columns: rows[0]?.length, oneVsTwo: rows[0]?.[2],
      recommended: !!app?.element.querySelector(".pd-recommended, .pd-recommended-note") || /recommended/i.test(app?.element.textContent ?? ""),
      headerHidden: !header || getComputedStyle(header).display === "none",
      collapsed: !app?.element.classList.contains("expanded"),
      pageHeading: !!app?.element.querySelector(".journal-entry-page h1") };
  });
  check(odds.name === "Odds of Success" && odds.cells === 50 && odds.columns === 6 && odds.tenVsFive === "62.3%",
    `percent button opened "${odds.name}" (${odds.cells} cells, DS 1-5, 10 vs DS 5 = ${odds.tenVsFive})`);
  check(!odds.recommended, "the odds journal has no recommended line or highlighted column");
  check(odds.oneVsTwo === "\u2014", `an impossible flip shows a dash (${odds.oneVsTwo})`);
  check(odds.headerHidden && odds.collapsed && !odds.pageHeading, `odds journal shows its name once (${JSON.stringify(odds)})`);
  await gm.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.document?.documentName === "JournalEntry") a.close(); });

  // Players for stage 2.
  await gm.evaluate(async () => {
    for (const name of ["Alice", "Bob"]) {
      if (!game.users.getName(name)) await foundry.documents.User.create({ name, role: CONST.USER_ROLES.PLAYER });
    }
  });
  await gm.screenshot({ path: `${OUT}/gm-1.png` });

  /* ------------------------------------------------------- stage 2: Alice */
  const alCtx = await browser.newContext({ viewport: VIEWPORT });
  const al = await alCtx.newPage();
  const alErrors = watchErrors(al, "Alice");
  await joinAs(al, "Alice");
  console.log("\nStage 2: joined as Alice");

  // Auto-created character appears (the GM client creates it on userConnected).
  await gm.waitForFunction(() => game.actors.some((a) => a.type === "character" && a.name === "Alice"), null, { timeout: 20000 })
    .then(() => ok("GM client auto-created Alice's character")).catch(() => fail("no character auto-created for Alice"));
  // Deterministic start for re-runs: one penny, alive, no challenge.
  await gm.evaluate(async () => {
    const a = game.actors.find((x) => x.type === "character" && x.name === "Alice");
    if (a) await a.update({ "system.pennies": 1, "system.dead": false, "system.challenge": { ds: null, issuedBy: "", issuedAt: null } });
    for (const n of game.actors.filter((x) => x.name === "The Killer")) await n.delete();
  });
  await al.waitForTimeout(1500);
  const s2 = await al.evaluate(() => {
    const el = document.getElementById("pd-scoreboard");
    const actor = game.actors.find((a) => a.name === "Alice");
    return {
      roleLabel: game.i18n.localize("USER.RoleGamemaster"),
      boardInDom: !!el,
      closeButton: !!el?.querySelector('.header-control[data-action="close"]'),
      rows: [...(el?.querySelectorAll("tr.pd-row") ?? [])].map((r) => r.querySelector(".pd-name")?.textContent.trim().replace(/\s+/g, " ")),
      directorControls: !!el?.querySelector('button[data-action="issueChallenge"]'),
      owns: actor?.isOwner,
      pennies: actor?.system.pennies,
      playerClass: document.body.classList.contains("pd-client-player"),
    };
  });
  console.log(JSON.stringify(s2, null, 2));
  check(s2.boardInDom && !s2.closeButton, "Alice sees the board without a close button");
  check(s2.rows.some((r) => r.includes("Alice")), "Alice's row is on her board");
  check(!s2.directorControls, "Alice sees no Director controls");
  check(s2.owns === true && s2.pennies === 1, "Alice owns her character with 1 penny");
  check(s2.playerClass, "player body class applied");
  // The page layout is the system's to leave alone: a board class once matched
  // <body> on players' clients, turned its flex layout to block, and the chat
  // log vanished while the hotbar jumped to the top.
  const chat = await al.evaluate(async () => {
    ui.sidebar.expand();
    ui.sidebar.changeTab("chat", "primary");
    await new Promise((r) => setTimeout(r, 800));
    const log = document.querySelector("#chat .chat-log")?.getBoundingClientRect();
    return { body: getComputedStyle(document.body).display, logHeight: Math.round(log?.height ?? 0) };
  });
  check(chat.body === "flex" && chat.logHeight > 100, `Alice can see the chat log (${JSON.stringify(chat)})`);
  const names = await al.evaluate(() => {
    const scale = Number(game.settings.get("penny-dreadful", "scoreboardScale")) || 1;
    const own = document.querySelector("#pd-scoreboard .pd-name-btn");
    return { own: own ? parseFloat(getComputedStyle(own).fontSize) : 0, want: 22 * scale };
  });
  check(Math.abs(names.own - names.want) < 0.5, `Alice's own name is full size (${names.own}px, want ${names.want}px)`);

  // Director issues DS 1 to Alice.
  const aliceId = await gm.evaluate(() => game.actors.find((a) => a.name === "Alice")?.id);
  await gm.click(`#pd-scoreboard tr[data-actor-id="${aliceId}"] button[data-action="issueChallenge"][data-ds="1"]`);
  // The ask is a chat card, never a dialog on the canvas.
  const lastCard = (page) => page.evaluate(() => {
    const cards = [...document.querySelectorAll("#chat .pd-request-card")];
    const card = cards[cards.length - 1];
    return card ? { state: card.dataset.state, button: !!card.querySelector("button.pd-request-flip"), text: card.textContent.trim() } : null;
  });
  await al.evaluate(() => { ui.sidebar.expand(); ui.sidebar.changeTab("chat", "primary"); });
  await gm.evaluate(() => { ui.sidebar.expand(); ui.sidebar.changeTab("chat", "primary"); });
  await al.waitForSelector("#chat .pd-request-card button.pd-request-flip", { timeout: 15000 })
    .then(() => ok("Alice's chat has the request card with a Flip button")).catch(() => fail("no request card with a Flip button for Alice"));
  await al.waitForTimeout(500);
  check(!(await al.evaluate(() => !!document.querySelector("dialog.application, .pd-dialog"))), "no flip dialog on Alice's screen");
  const gmCard = await lastCard(gm);
  check(gmCard?.button === true, `the Director's card also offers Flip (${JSON.stringify(gmCard)})`);
  await al.screenshot({ path: `${OUT}/alice-request.png` });
  const spotlightOnAlice = await gm.evaluate((id) => game.settings.get("penny-dreadful", "spotlightActorId") === id, aliceId);
  check(spotlightOnAlice, "spotlight moved to Alice with the challenge");

  // Watch every state the latest request card passes through on both screens
  // during the flip: it must go straight to "flipped", never via "ended".
  const watchCard = (page) => page.evaluate(() => {
    const card = [...document.querySelectorAll("#chat .pd-request-card")].pop();
    globalThis.__pdStates = [card.dataset.state];
    new MutationObserver(() => { const st = card.dataset.state; if (globalThis.__pdStates.at(-1) !== st) globalThis.__pdStates.push(st); })
      .observe(card, { attributes: true, attributeFilter: ["data-state"] });
  });
  await watchCard(gm);
  await watchCard(al);

  // Alice flips from the chat card.
  await al.locator("#chat .pd-request-card button.pd-request-flip").last().click({ timeout: 10000 });
  await al.waitForFunction(() => game.actors.find((a) => a.name === "Alice")?.system.challenge.ds === null, null, { timeout: 30000 })
    .then(() => ok("challenge cleared after the flip")).catch(() => fail("challenge never cleared"));
  await al.waitForTimeout(1500);
  const s3 = await gm.evaluate(() => {
    const actor = game.actors.find((a) => a.name === "Alice");
    const msg = game.messages.contents.findLast((m) => m.getFlag("penny-dreadful", "flip"));
    return {
      pennies: actor.system.pennies,
      dead: actor.system.dead,
      flag: msg?.getFlag("penny-dreadful", "flip"),
      isRoll: msg?.isRoll,
      formula: msg?.rolls?.[0]?.formula,
      cardInContent: msg?.content?.includes("pd-flip-card"),
      cardCoins: (msg?.content?.match(/class="pd-coin (heads|tails)"/g) ?? []).length,
      spotlight: game.settings.get("penny-dreadful", "spotlightActorId"),
      rowClasses: document.querySelector(`#pd-scoreboard tr[data-actor-id="${actor.id}"]`)?.className,
      filled: document.querySelectorAll(`#pd-scoreboard tr[data-actor-id="${actor.id}"] td.pd-penny.filled`).length,
    };
  });
  console.log(JSON.stringify(s3, null, 2));
  check(s3.isRoll && s3.formula === "1dc", `chat message carries the roll (${s3.formula})`);
  check(s3.cardInContent && s3.cardCoins === 1, `flip card rendered into the message with ${s3.cardCoins} coin`);
  const expected = s3.flag?.outcome === "success" ? 1 : 2;
  check(s3.pennies === expected, `pennies ${s3.pennies} match outcome ${s3.flag?.outcome}`);
  check(s3.filled === s3.pennies, "board shows the right number of filled pennies");
  await al.waitForFunction(() => { const c = [...document.querySelectorAll("#chat .pd-request-card")].pop(); return c?.dataset.state === "flipped"; }, null, { timeout: 10000 }).catch(() => {});
  const done = await lastCard(al);
  check(done?.state === "flipped" && !done.button, `the card reads flipped, no button (${JSON.stringify(done)})`);
  const seen = { gm: await gm.evaluate(() => globalThis.__pdStates), al: await al.evaluate(() => globalThis.__pdStates) };
  check(!seen.gm.includes("ended") && !seen.al.includes("ended") && seen.gm.at(-1) === "flipped" && seen.al.at(-1) === "flipped",
    `the card never shows "no longer pending" during a flip (Director ${seen.gm.join(">")}, Alice ${seen.al.join(">")})`);
  check(await gm.evaluate((id) => game.actors.get(id).system.challenge.resolved === game.messages.contents.findLast((m) => m.getFlag("penny-dreadful", "flip"))?.getFlag("penny-dreadful", "flip")?.issuedAt, aliceId),
    "the row records the token of the flip it resolved");
  await gm.screenshot({ path: `${OUT}/gm-2.png` });
  await al.screenshot({ path: `${OUT}/alice-2.png` });

  // Director: +/- and death path via the sheet values.
  await gm.click(`#pd-scoreboard tr[data-actor-id="${aliceId}"] button[data-action="addPenny"]`);
  await gm.waitForTimeout(600);
  const afterAdd = await gm.evaluate((id) => game.actors.get(id).system.pennies, aliceId);
  check(afterAdd === s3.pennies + 1, `+ raised pennies to ${afterAdd}`);
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "system.pennies": 10 }); }, aliceId);
  // Force tails on Alice's client so the ten-penny failure is deterministic.
  await al.evaluate(() => { globalThis.__pdRandom = CONFIG.Dice.randomUniform; CONFIG.Dice.randomUniform = () => 0.1; });
  await gm.click(`#pd-scoreboard tr[data-actor-id="${aliceId}"] button[data-action="issueChallenge"][data-ds="5"]`);
  await al.waitForFunction(() => { const c = [...document.querySelectorAll("#chat .pd-request-card")].pop(); return !!c?.querySelector("button.pd-request-flip"); }, null, { timeout: 15000 }).catch(() => {});
  await al.locator("#chat .pd-request-card button.pd-request-flip").last().click({ timeout: 10000 }).catch(() => fail("no second request card"));
  await gm.waitForFunction((id) => game.actors.get(id).system.challenge.ds === null, aliceId, { timeout: 30000 }).catch(() => fail("second flip never resolved"));
  await gm.waitForFunction((id) => !!document.querySelector(`#pd-scoreboard tr[data-actor-id="${id}"] td.pd-dead i.fa-skull`) || game.actors.get(id).system.dead === false, aliceId, { timeout: 15000 }).catch(() => {});
  const s4 = await gm.evaluate((id) => {
    const a = game.actors.get(id);
    const msg = game.messages.contents.findLast((m) => m.getFlag("penny-dreadful", "flip"));
    return { dead: a.system.dead, pennies: a.system.pennies, outcome: msg?.getFlag("penny-dreadful", "flip")?.outcome, heads: msg?.getFlag("penny-dreadful", "flip")?.heads,
      skull: !!document.querySelector(`#pd-scoreboard tr[data-actor-id="${id}"] td.pd-dead i.fa-skull`) };
  }, aliceId);
  console.log(JSON.stringify(s4));
  if (s4.outcome === "death") check(s4.dead && s4.skull, "ten-penny failure marked Alice dead with a skull");
  else check(!s4.dead && s4.pennies === 10, `ten pennies, ${s4.heads} heads vs DS 5: ${s4.outcome}`);
  await al.evaluate(() => { if (globalThis.__pdRandom) CONFIG.Dice.randomUniform = globalThis.__pdRandom; });
  await gm.screenshot({ path: `${OUT}/gm-3.png` });

  // Revive via minus if dead.
  if (s4.dead) {
    await gm.click(`#pd-scoreboard tr[data-actor-id="${aliceId}"] button[data-action="removePenny"]`);
    await gm.waitForTimeout(600);
    check(await gm.evaluate((id) => !game.actors.get(id).system.dead, aliceId), "minus revived Alice");
  }

  // Dead by another route (the sheet, the console) drops the pending challenge; the card stops offering Flip.
  await gm.click(`#pd-scoreboard tr[data-actor-id="${aliceId}"] button[data-action="issueChallenge"][data-ds="2"]`);
  await al.waitForFunction(() => !![...document.querySelectorAll("#chat .pd-request-card")].pop()?.querySelector("button.pd-request-flip"), null, { timeout: 10000 }).catch(() => {});
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "system.dead": true }); }, aliceId);
  await al.waitForFunction(() => [...document.querySelectorAll("#chat .pd-request-card")].pop()?.dataset.state === "ended", null, { timeout: 10000 }).catch(() => {});
  const deadDrop = { ds: await al.evaluate((id) => game.actors.get(id).system.challenge.ds, aliceId), card: await lastCard(al) };
  check(deadDrop.ds === null && deadDrop.card?.state === "ended" && !deadDrop.card.button, `death from outside the flip clears the challenge and the card's Flip (${JSON.stringify(deadDrop)})`);
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "system.dead": false }); }, aliceId);

  // The DS is fixed at 1-5: five buttons, no setting.
  const pills = await gm.evaluate((a) => document.querySelectorAll(`#pd-scoreboard tr[data-actor-id="${a}"] button[data-action="issueChallenge"]`).length, aliceId);
  check(pills === 5, `five DS buttons (${pills})`);
  check(!(await gm.evaluate(() => game.settings.settings.has("penny-dreadful.maxDifficulty"))), "no Maximum Difficulty Score setting");
  // Clicking the pending DS withdraws it, and its chat request says so. In
  // between, a write above 5 from outside the board: the field clamps it to 5
  // (14.365 NumberField) and the challenge survives with its token intact,
  // never wiped (migrateData leaves update input alone).
  await gm.click(`#pd-scoreboard tr[data-actor-id="${aliceId}"] button[data-action="issueChallenge"][data-ds="2"]`);
  await gm.waitForFunction((a) => game.actors.get(a).system.challenge.ds === 2, aliceId, { timeout: 10000 }).catch(() => {});
  const overDs = await gm.evaluate(async (id) => {
    const actor = game.actors.get(id);
    const before = actor.system.challenge.issuedAt;
    try { await actor.update({ "system.challenge.ds": 7 }); } catch (err) { return { error: String(err.message).slice(0, 80) }; }
    return { ds: actor.system.challenge.ds, sameToken: actor.system.challenge.issuedAt === before };
  }, aliceId);
  check(overDs.ds === 5 && overDs.sameToken === true, `a write of DS 7 is clamped to 5 and keeps the challenge (${JSON.stringify(overDs)})`);
  await gm.click(`#pd-scoreboard tr[data-actor-id="${aliceId}"] button[data-action="issueChallenge"][data-ds="5"]`);
  await gm.waitForFunction((a) => game.actors.get(a).system.challenge.ds === null, aliceId, { timeout: 10000 }).catch(() => {});
  await gm.waitForFunction(() => [...document.querySelectorAll("#chat .pd-request-card")].pop()?.dataset.state === "withdrawn", null, { timeout: 10000 }).catch(() => {});
  const wcard = await lastCard(gm);
  check(wcard?.state === "withdrawn" && !wcard.button, `clicking the pending DS withdraws it; its request reads withdrawn (${JSON.stringify(wcard)})`);

  // NPC add via API path (dialog is exercised by hand).
  await gm.evaluate(async () => { await foundry.documents.Actor.create({ name: "The Killer", type: "npc", system: { onBoard: true } }); });
  await gm.waitForFunction(() => [...document.querySelectorAll("#pd-scoreboard tr.pd-row")].some((r) => r.textContent.includes("The Killer")), null, { timeout: 10000 }).catch(() => {});
  const npcRow = await gm.evaluate(() => !!document.querySelector("#pd-scoreboard tr.pd-row td.pd-name span.pd-name-text, #pd-scoreboard tr.pd-row button.pd-name-btn") && [...document.querySelectorAll("#pd-scoreboard tr.pd-row")].some((r) => r.textContent.includes("The Killer")));
  check(npcRow, "NPC row appears on the board");
  const npcId = await gm.evaluate(() => game.actors.getName("The Killer").id);
  // NPCs sit in their own section under the characters and hold five pennies at most.
  const s5 = await gm.evaluate((id) => {
    const rows = [...document.querySelectorAll("#pd-scoreboard tbody tr")];
    const section = rows.findIndex((r) => r.classList.contains("pd-section"));
    const npc = rows.findIndex((r) => r.dataset.actorId === id);
    const alice = rows.findIndex((r) => r.classList.contains("pd-row") && r.textContent.includes("Alice"));
    return { section, npc, alice, slots: rows[npc]?.querySelectorAll("td.pd-penny").length, max: game.actors.get(id).system.maxPennies };
  }, npcId);
  check(s5.section >= 0 && s5.alice < s5.section && s5.section < s5.npc, "NPC row sits below a section divider under the characters");
  check(s5.slots === 5 && s5.max === 5, `NPC row shows ${s5.slots} penny slots`);
  const sizes = await al.evaluate(() => ({
    own: parseFloat(getComputedStyle(document.querySelector("#pd-scoreboard .pd-name-btn")).fontSize),
    npc: parseFloat(getComputedStyle(document.querySelector("#pd-scoreboard .pd-name-text")).fontSize),
  }));
  check(sizes.own === sizes.npc, `on a player's board, own and NPC names are the same size (${sizes.own}/${sizes.npc})`);

  // The Director's NPC Penny Limit: a game setting, one number for every NPC.
  const npcSlots = (id) => gm.evaluate((a) => ({
    slots: document.querySelectorAll(`#pd-scoreboard tr[data-actor-id="${a}"] td.pd-penny`).length,
    max: game.actors.get(a).system.maxPennies,
  }), id);
  const inConfig = await gm.evaluate(() => game.settings.settings.get("penny-dreadful.npcMaxPennies")?.config === true);
  check(inConfig, "NPC Penny Limit is in the game settings");
  await gm.evaluate(async () => { await game.settings.set("penny-dreadful", "npcMaxPennies", 7); });
  await gm.waitForFunction(([a, k]) => document.querySelectorAll(`#pd-scoreboard tr[data-actor-id="${a}"] td.pd-penny`).length === k, [npcId, 7], { timeout: 10000 }).catch(() => {});
  const at7 = await npcSlots(npcId);
  check(at7.slots === 7 && at7.max === 7, `NPC limit 7 shows ${at7.slots} slots`);
  const clamped = await gm.evaluate(async () => {
    await game.settings.set("penny-dreadful", "npcMaxPennies", 12).catch(() => {});
    return game.settings.get("penny-dreadful", "npcMaxPennies");
  });
  check(clamped >= 5 && clamped <= 10, `NPC limit stays within 5-10 (asked 12, got ${clamped})`);
  // Folded to a lower limit, the kept count survives an edit on the NPC's sheet.
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "system.pennies": 7 }); }, npcId);
  await gm.evaluate(async () => { await game.settings.set("penny-dreadful", "npcMaxPennies", 5); });
  const kept = await gm.evaluate(async (id) => {
    const actor = game.actors.get(id);
    await actor.sheet.render({ force: true });
    await new Promise((r) => setTimeout(r, 500));
    const input = actor.sheet.element.querySelector('input[name="name"]');
    input.value = "The Killer";
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1000));
    const out = { shown: actor.system.pennies, stored: actor._source.system.pennies };
    await actor.sheet.close();
    return out;
  }, npcId);
  check(kept.shown === 5 && kept.stored === 7, `an NPC sheet edit keeps the stored count under a lower limit (${JSON.stringify(kept)})`);
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "system.pennies": 1 }); }, npcId);
  await gm.evaluate(async () => { await game.settings.set("penny-dreadful", "npcMaxPennies", 5); });
  await gm.waitForFunction(([a, k]) => document.querySelectorAll(`#pd-scoreboard tr[data-actor-id="${a}"] td.pd-penny`).length === k, [npcId, 5], { timeout: 10000 }).catch(() => {});
  const back = await npcSlots(npcId);
  check(back.slots === 5 && back.max === 5, `NPC limit back to 5 shows ${back.slots} slots`);
  // A five-penny failure kills an NPC. Force tails on the Director's client, which rolls for it.
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "system.pennies": 5 }); }, npcId);
  await gm.waitForFunction((id) => document.querySelector(`#pd-scoreboard tr[data-actor-id="${id}"] button[data-action="addPenny"]`)?.disabled === true, npcId, { timeout: 10000 })
    .then(() => ok("+ is disabled at five pennies for an NPC")).catch(() => fail("+ is disabled at five pennies for an NPC"));
  if (dsn) {
    await gm.click('#pd-scoreboard button[data-action="holdCoins"]');
    await gm.waitForFunction(() => game.settings.get("penny-dreadful", "holdCoins") === true, null, { timeout: 10000 })
      .then(() => ok("Director turned the coin hold on")).catch(() => fail("hold toggle did not set"));
  }
  await gm.evaluate(() => { globalThis.__pdRandom = CONFIG.Dice.randomUniform; CONFIG.Dice.randomUniform = () => 0.1; });
  // Nobody flips for someone else: even with owner rights on the NPC, Alice gets no Flip, on the board or the card.
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }); }, npcId);
  await gm.click(`#pd-scoreboard tr[data-actor-id="${npcId}"] button[data-action="issueChallenge"][data-ds="1"]`);
  await al.waitForFunction(() => [...document.querySelectorAll("#chat .pd-request-card")].pop()?.dataset.state === "pending", null, { timeout: 10000 }).catch(() => {});
  const other = await al.evaluate((id) => ({
    owner: game.actors.get(id).isOwner,
    boardFlip: !!document.querySelector(`#pd-scoreboard tr[data-actor-id="${id}"] button[data-action="flip"]`),
    card: (() => { const c = [...document.querySelectorAll("#chat .pd-request-card")].pop(); return c ? { button: !!c.querySelector("button.pd-request-flip"), text: c.textContent.trim() } : null; })(),
  }), npcId);
  check(other.owner && !other.boardFlip && other.card && !other.card.button && /Director/.test(other.card.text),
    `a player with owner rights cannot flip an NPC (${JSON.stringify(other)})`);
  await gm.evaluate(async (id) => { await game.actors.get(id).update({ "ownership.default": CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE }); }, npcId);
  await gm.waitForTimeout(500);
  await gm.click(`#pd-scoreboard tr[data-actor-id="${npcId}"] button[data-action="flip"]`);
  await gm.waitForFunction((id) => game.actors.get(id).system.challenge.ds === null, npcId, { timeout: 30000 })
    .then(() => ok("Director flipped for the NPC")).catch(() => fail("NPC flip never resolved"));
  await gm.evaluate(() => { if (globalThis.__pdRandom) CONFIG.Dice.randomUniform = globalThis.__pdRandom; });
  await gm.waitForFunction((id) => !!document.querySelector(`#pd-scoreboard tr[data-actor-id="${id}"] td.pd-dead i.fa-skull`), npcId, { timeout: 15000 }).catch(() => {});
  const s6 = await gm.evaluate((id) => {
    const msg = game.messages.contents.findLast((m) => m.getFlag("penny-dreadful", "flip"));
    return { dead: game.actors.get(id).system.dead, outcome: msg?.getFlag("penny-dreadful", "flip")?.outcome, text: msg?.content ?? "",
      skull: !!document.querySelector(`#pd-scoreboard tr[data-actor-id="${id}"] td.pd-dead i.fa-skull`) };
  }, npcId);
  check(s6.outcome === "death" && s6.dead && s6.skull, "five-penny failure marked the NPC dead with a skull");
  check(/[Ww]ith 5 pennies/.test(s6.text), "death card names the five pennies");
  // Nothing of the system's is parked on screen after a flip: the chat card is the only trace.
  check(await gm.evaluate(() => !document.querySelector("body > .pd-coins, body > [class*='pd-coin']")), "no system element left on screen outside the chat log");
  if (dsn) {
    // Held: the module's canvas is still showing the coins well past its own hide time (2 s + 1 s fade by default).
    await gm.waitForTimeout(5000);
    // The module hides its canvas (display none) 2 s + a 1 s fade after the coins land unless something holds them.
    const shown = (page) => page.evaluate(() => { const c = game.dice3d?.canvas; return !!c && c.style.display !== "none" && c.style.opacity !== "0"; });
    const heldGm = await shown(gm);
    const heldAl = await shown(al);
    check(heldGm && heldAl, `held coins still on both screens (${heldGm}/${heldAl})`);
    await gm.screenshot({ path: `${OUT}/gm-held.png` });
    await gm.click('#pd-scoreboard button[data-action="clearCoins"]');
    await al.waitForFunction(() => { const c = game.dice3d?.canvas; return !!c && c.style.display === "none"; }, null, { timeout: 10000 })
      .then(() => ok("Director's clear took the coins off Alice's screen")).catch(() => fail("coins not cleared on Alice's screen"));
    await gm.waitForTimeout(1200);
    check(!(await shown(gm)), "coins cleared on the Director's screen");
    await gm.click('#pd-scoreboard button[data-action="holdCoins"]');
    await gm.waitForFunction(() => game.settings.get("penny-dreadful", "holdCoins") === false, null, { timeout: 10000 }).catch(() => fail("hold toggle did not clear"));
  }
  await gm.click(`#pd-scoreboard tr[data-actor-id="${npcId}"] button[data-action="removeNpc"]`);
  await gm.waitForTimeout(600);
  check(await gm.evaluate((id) => !game.actors.get(id).system.onBoard, npcId), "NPC removed from the board");

  // A row that flipped once and is then deleted: its old request still names
  // it, its new request offers no Flip, and nothing can flip it.
  const goneId = await gm.evaluate(async () => (await foundry.documents.Actor.create({ name: "Smoke Gone", type: "npc", system: { onBoard: true } })).id);
  await gm.waitForSelector(`#pd-scoreboard tr[data-actor-id="${goneId}"]`, { timeout: 10000 }).catch(() => {});
  await gm.click(`#pd-scoreboard tr[data-actor-id="${goneId}"] button[data-action="issueChallenge"][data-ds="1"]`);
  await gm.waitForSelector(`#chat .pd-request-card[data-actor-id="${goneId}"] button.pd-request-flip`, { timeout: 10000 }).catch(() => {});
  await gm.locator(`#chat .pd-request-card[data-actor-id="${goneId}"] button.pd-request-flip`).last().click({ timeout: 10000 });
  await gm.waitForFunction((id) => [...document.querySelectorAll(`#chat .pd-request-card[data-actor-id="${id}"]`)].pop()?.dataset.state === "flipped", goneId, { timeout: 30000 }).catch(() => {});
  await gm.click(`#pd-scoreboard tr[data-actor-id="${goneId}"] button[data-action="issueChallenge"][data-ds="1"]`);
  await gm.waitForFunction((id) => [...document.querySelectorAll(`#chat .pd-request-card[data-actor-id="${id}"]`)].length === 2, goneId, { timeout: 10000 }).catch(() => {});
  await gm.evaluate(async (id) => { await game.actors.get(id).delete(); }, goneId);
  await gm.waitForTimeout(800);
  const gone = await gm.evaluate((id) => {
    const cards = [...document.querySelectorAll(`#chat .pd-request-card[data-actor-id="${id}"]`)];
    const [first, last] = [cards[0], cards[cards.length - 1]];
    return { cards: cards.length, firstState: first?.dataset.state, firstText: first?.textContent.trim(),
      lastState: last?.dataset.state, button: !!last?.querySelector("button.pd-request-flip"),
      flips: game.messages.filter((m) => m.getFlag("penny-dreadful", "flip")?.actorId === id).length };
  }, goneId);
  check(gone.cards === 2 && gone.firstState === "flipped" && gone.firstText === "Smoke Gone flipped", `a deleted row's old request still names it (${JSON.stringify(gone)})`);
  check(gone.lastState === "ended" && !gone.button && gone.flips === 1, `a deleted row's pending request offers no Flip (${JSON.stringify(gone)})`);
  await gm.screenshot({ path: `${OUT}/gm-4.png` });

  /* ------------------------------------------------------------- report */
  const errors = [...gmErrors, ...alErrors];
  if (errors.length) { fail(`${errors.length} console error(s):`); for (const e of errors) console.error(`        ${e}`); }
  else ok("no console errors on either client");
  await alCtx.close();
  await gmCtx.close();
} finally {
  clearTimeout(watchdog);
  await browser.close().catch(() => {});
}
console.log(`\n${failures ? `PROBE FAILED (${failures})` : "Probe passed."}`);
process.exit(failures ? 1 : 0);
