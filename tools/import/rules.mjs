#!/usr/bin/env node
/**
 * The rules journal: `docs/player-facing-rules.md` -> `src/packs/rules/*.yml`.
 *
 *   node tools/import/rules.mjs [--dry]
 *
 * CANONICAL SOURCE IS THE MARKDOWN. The text is Daniel Fitzpatrick's Penny
 * Dreadful (CC BY-SA 4.0) as adapted for this table; it is converted verbatim
 * by `marked` and never edited here. Edit the markdown, rerun this, then
 * `npm run build:packs`. Never edit the YAML by hand.
 *
 * Ids are seed-hashed so they are stable across runs; `module/rules.js` holds
 * the journal id and `check:manifest` verifies the two agree. The odds table
 * beside it comes from `tools/import/odds.mjs`; `npm run import:rules` runs both.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { collapse, idFor, journalShell, page } from "./journal-yaml.mjs";

const require = createRequire(import.meta.url);
const { marked } = require("marked");

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dry = process.argv.includes("--dry");

export const JOURNAL_ID = idFor("penny-dreadful-rules:journal");
const RULES_PAGE_ID = idFor("penny-dreadful-rules:page:rules");
const LICENCE_PAGE_ID = idFor("penny-dreadful-rules:page:licence");
const ENTRY_NAME = "Penny Dreadful Rules";

const md = fs.readFileSync(path.join(root, "docs", "player-facing-rules.md"), "utf8");
const rulesHtml = collapse(marked.parse(md, { async: false }));
if (rulesHtml.length < 200) throw new Error(`FATAL: rules converted to ${rulesHtml.length} chars`);

// Attribution, exactly as the licence requires it. Functional text, not game text.
const licenceHtml = collapse(`
<p>Penny Dreadful © 2026 by Daniel Fitzpatrick is licensed under CC BY-SA 4.0.
To view a copy of this license, visit
<a href="https://creativecommons.org/licenses/by-sa/4.0/">https://creativecommons.org/licenses/by-sa/4.0/</a></p>
<p>Daniel Fitzpatrick on itch.io: <a href="https://baphelon.itch.io/">https://baphelon.itch.io/</a></p>
<p>The Player-Facing Rules page is an adaptation of Penny Dreadful for play in
Foundry VTT and is shared under the same licence.</p>
`);

const yml = journalShell(JOURNAL_ID, ENTRY_NAME, [
  page(JOURNAL_ID, RULES_PAGE_ID, "Player-Facing Rules", rulesHtml, 0),
  page(JOURNAL_ID, LICENCE_PAGE_ID, "Licence", licenceHtml, 100000),
]);

const dir = path.join(root, "src", "packs", "rules");
const prefix = `${ENTRY_NAME.replace(/[^A-Za-z0-9]/g, "_")}_`;
const out = `${prefix}${JOURNAL_ID}.yml`;
if (!dry) {
  fs.mkdirSync(dir, { recursive: true });
  // Only this importer's own earlier output; the odds journal lives beside it.
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".yml"))) fs.rmSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, out), yml, "utf8");
}
console.log(`${dry ? "[dry] would write" : "wrote"} src/packs/rules/${out} (${rulesHtml.length} chars of rules)`);
console.log(`journal id ${JOURNAL_ID} — module/rules.js must carry the same`);
if (!dry) console.log("next: npm run build:packs (stop Foundry first)");
