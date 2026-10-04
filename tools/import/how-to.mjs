#!/usr/bin/env node
/**
 * The How To: `docs/how-to-system.md` and `docs/how-to-module.md` ->
 *   - `templates/how-to/{system,module}.html` — the How To WINDOW's body
 *     (module/how-to.js), each flavor showing its own guide; and
 *   - `src/packs/rules/How_to_Play_Penny_Dreadful_<id>.yml` — the same two
 *     guides as one JOURNAL in the compendium, a page each. Both flavors
 *     ship the same packs, so the journal carries both pages, named for
 *     where each applies.
 *
 *   node tools/import/how-to.mjs [--dry]      (npm run import:howto)
 *
 * CANONICAL SOURCE IS THE MARKDOWN — Dom's to edit. Edit it, rerun this,
 * then `npm run build:packs` (stop Foundry first) for the compendium copy;
 * the window needs no build. Never edit the generated templates or YAML.
 * Each template renders exactly one root element, as every ApplicationV2
 * part must.
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

export const JOURNAL_ID = idFor("penny-dreadful-howto:journal");
const ENTRY_NAME = "How to Play Penny Dreadful";
const GUIDES = [
  { flavor: "system", page: "In a Penny Dreadful World" },
  { flavor: "module", page: "As a Mini Game in Another World" },
];

const pages = [];
for (const [i, guide] of GUIDES.entries()) {
  const source = `docs/how-to-${guide.flavor}.md`;
  const html = marked.parse(fs.readFileSync(path.join(root, source), "utf8"), { async: false }).trim();
  if (html.length < 200) throw new Error(`FATAL: ${source} converted to ${html.length} chars`);

  // The window's body. Handlebars would read `{{` in the prose as an
  // expression, so it is escaped there (the journal takes the HTML as is).
  const template = [
    `{{!-- GENERATED from ${source} by tools/import/how-to.mjs. Edit the markdown, then npm run import:howto. --}}`,
    `<div class="pd-how-to-body">`,
    html.replace(/\{\{/g, "\\{{"),
    `</div>`,
    "",
  ].join("\n");
  const out = path.join(root, "templates", "how-to", `${guide.flavor}.html`);
  if (!dry) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, template, "utf8");
  }
  console.log(`${dry ? "[dry] would write" : "wrote"} templates/how-to/${guide.flavor}.html (${html.length} chars)`);

  pages.push(page(JOURNAL_ID, idFor(`penny-dreadful-howto:page:${guide.flavor}`), guide.page, collapse(html), i * 100000));
}

const dir = path.join(root, "src", "packs", "rules");
const prefix = `${ENTRY_NAME.replace(/[^A-Za-z0-9]/g, "_")}_`;
const yml = `${prefix}${JOURNAL_ID}.yml`;
if (!dry) {
  fs.mkdirSync(dir, { recursive: true });
  // Only this importer's own earlier output; the rules and odds live beside it.
  for (const f of fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".yml"))) fs.rmSync(path.join(dir, f));
  fs.writeFileSync(path.join(dir, yml), journalShell(JOURNAL_ID, ENTRY_NAME, pages), "utf8");
}
console.log(`${dry ? "[dry] would write" : "wrote"} src/packs/rules/${yml} (journal id ${JOURNAL_ID})`);
if (!dry) console.log("next: npm run build:packs (stop Foundry first) for the compendium copy");
