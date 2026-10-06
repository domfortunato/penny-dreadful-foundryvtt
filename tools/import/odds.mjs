#!/usr/bin/env node
/**
 * The odds journal: for every hand of pennies (1 to 10) and every DL (1 to
 * 5), the chance that the flip shows at least DL heads. A chance that is
 * exactly nothing (a DL above the pennies held) prints as a dash. `module/odds.js` does the
 * arithmetic, the same code the board's tooltips use, and the table lands in
 * `src/packs/rules/` beside the rules. This is reference material computed
 * from the rules, not game text.
 *
 *   node tools/import/odds.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_DS, MAX_PENNIES } from "../../module/constants.js";
import { chanceOfSuccess, percent } from "../../module/odds.js";
import { collapse, idFor, journalShell, page } from "./journal-yaml.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dry = process.argv.includes("--dry");

export const JOURNAL_ID = idFor("penny-dreadful-odds:journal");
const PAGE_ID = idFor("penny-dreadful-odds:page:table");
const ENTRY_NAME = "Odds of Success";

const range = (n) => Array.from({ length: n }, (_, i) => i + 1);
const cell = (p) => (p === 0 ? "—" : percent(p));
const head = `<tr><th>Pennies</th>${range(MAX_DS).map((ds) => `<th>DL ${ds}</th>`).join("")}</tr>`;
const rows = range(MAX_PENNIES).map((n) =>
  `<tr><td>${n}</td>${range(MAX_DS).map((ds) => `<td>${cell(chanceOfSuccess(n, ds))}</td>`).join("")}</tr>`).join("");
const html = collapse(`
<p>The odds that a flip's head count will meet or beat the Difficulty Level</p>
<table><thead>${head}</thead><tbody>${rows}</tbody></table>
`);

const yml = journalShell(JOURNAL_ID, ENTRY_NAME, [page(JOURNAL_ID, PAGE_ID, ENTRY_NAME, html, 0, { showTitle: false })]);
const dir = path.join(root, "src", "packs", "rules");
const prefix = `${ENTRY_NAME.replace(/[^A-Za-z0-9]/g, "_")}_`;
const out = `${prefix}${JOURNAL_ID}.yml`;
if (!dry) {
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".yml"))) fs.rmSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, out), yml, "utf8");
}
console.log(`${dry ? "[dry] would write" : "wrote"} src/packs/rules/${out}`);
console.log(`journal id ${JOURNAL_ID} — module/rules.js must carry the same as ODDS_JOURNAL_ID`);
