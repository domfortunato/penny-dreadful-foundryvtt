#!/usr/bin/env node
/**
 * Every localization key the code and templates use exists in lang/en.json,
 * and every key in lang/en.json is used somewhere. Both directions, because a
 * missing key renders as its own name and an orphan key is dead weight nobody
 * notices. Keys must be written out in full in the source — a key assembled
 * at runtime is invisible to this gate, so the code keeps explicit maps.
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const en = JSON.parse(readFileSync(join(ROOT, "lang", "en.json"), "utf8"));
const declared = new Set(Object.keys(en));

const sources = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|html)$/.test(e.name)) sources.push(p);
  }
};
walk(join(ROOT, "module"));
walk(join(ROOT, "templates"));

const used = new Set();
for (const f of sources) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/["'`](PD\.[A-Za-z0-9_.]+)["'`]/g)) used.add(m[1]);
}
// Type labels are read by core from the manifests' documentTypes. The
// module flavor's types are keyed `<module-id>.<subtype>` by core, so its
// labels live at TYPES.Actor.penny-dreadful-module.character and so on
// (client helpers/localization.mjs:96 builds the key from the full type).
const manifest = JSON.parse(readFileSync(join(ROOT, "system.json"), "utf8"));
for (const [doc, types] of Object.entries(manifest.documentTypes ?? {})) {
  for (const type of Object.keys(types)) used.add(`TYPES.${doc}.${type}`);
}
for (const pack of manifest.packs ?? []) if (/^PD\./.test(pack.label)) used.add(pack.label);
const moduleManifest = JSON.parse(readFileSync(join(ROOT, "module.json"), "utf8"));
for (const [doc, types] of Object.entries(moduleManifest.documentTypes ?? {})) {
  for (const type of Object.keys(types)) used.add(`TYPES.${doc}.${moduleManifest.id}.${type}`);
}
for (const pack of moduleManifest.packs ?? []) if (/^PD\./.test(pack.label)) used.add(pack.label);

let failed = false;
const missing = [...used].filter((k) => !declared.has(k)).sort();
const orphans = [...declared].filter((k) => !used.has(k)).sort();
if (missing.length) { failed = true; console.error(`  FAIL  used but not in lang/en.json:\n    ${missing.join("\n    ")}`); }
else console.log(`  ok    all ${used.size} keys used by the code exist in lang/en.json`);
if (orphans.length) { failed = true; console.error(`  FAIL  in lang/en.json but never used:\n    ${orphans.join("\n    ")}`); }
else console.log(`  ok    all ${declared.size} keys in lang/en.json are used`);
console.log(`\n${failed ? "I18N CHECK FAILED" : "i18n check passed."}`);
process.exit(failed ? 1 : 0);
