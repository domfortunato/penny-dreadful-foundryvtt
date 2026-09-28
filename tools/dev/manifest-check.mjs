#!/usr/bin/env node
/**
 * The manifest keys that fail SILENTLY, and so need a gate rather than a reader.
 * Trimmed from Air Bladder's check of the same name. All offline:
 *
 *   1. `styles`, `esmodules` and `languages` use the declared shapes and name
 *      files that exist (a string-form `styles` entry is accepted by a v13
 *      shim that emits no warning; a 404 language file falls back to English
 *      with one console line).
 *   2. `readme`, `bugs`, `changelog`, `manifest`, `download`, `url` are absolute
 *      https, and `manifest`/`download` name the right artifact for the flavor
 *      (system.json/system.zip vs module.json/module.zip — a copy-paste there
 *      publishes a module that installs the system, silently).
 *   3. Every declared pack has YAML under `src/packs/<name>/`, every source dir
 *      is declared, and `packFolders` files every pack exactly once. A SYSTEM
 *      pack must declare its own system; a MODULE pack must declare none, or
 *      the mini game's journals would be locked to a host it never requires.
 *   4. Every `*_JOURNAL_ID` in `module/rules.js` is the `_id` of a YAML entry
 *      under `src/packs/rules/`, so the board's buttons open pages that ship.
 *   5. The two manifests agree: same version (one tag ships both flavors),
 *      same documentTypes (one schema), different ids and entries.
 *
 * Usage: npm run check:manifest [path/to/manifest.json]   (default: both)
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, basename } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

let failed = false;
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => { console.error(`  FAIL  ${m}`); failed = true; };

const checkManifest = (manifestPath) => {
  const kind = basename(manifestPath) === "module.json" ? "module" : "system";
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  console.log(`\n${basename(manifestPath)} shape (${manifestPath})`);

  /* 1. Declared shapes and the files they name ------------------------------ */
  const styles = manifest.styles ?? [];
  if (!styles.length) fail("no styles declared");
  else if (styles.some((s) => typeof s !== "object" || typeof s?.src !== "string" || !s.src)) {
    fail(`every styles entry must be {"src": "..."} (the string form is a silent v13 shim): ${JSON.stringify(styles)}`);
  } else ok(`styles uses the declared form (${styles.map((s) => s.src).join(", ")})`);
  for (const src of styles.map((s) => s?.src).filter(Boolean)) {
    if (existsSync(join(ROOT, src))) ok(`styles: ${src} exists`);
    else fail(`styles names "${src}", which does not exist`);
  }
  if (!(manifest.esmodules ?? []).length) fail("no esmodules declared");
  for (const src of manifest.esmodules ?? []) {
    if (existsSync(join(ROOT, src))) ok(`esmodules: ${src} exists`);
    else fail(`esmodules names "${src}", which does not exist`);
  }
  const langs = manifest.languages ?? [];
  if (!langs.length) fail("no languages declared, not even lang/en.json");
  const declaredLangs = new Set();
  for (const [i, l] of langs.entries()) {
    if (!l?.lang || !l?.name || !l?.path) { fail(`languages[${i}] needs lang, name and path`); continue; }
    declaredLangs.add(l.path);
    if (existsSync(join(ROOT, l.path))) ok(`languages: ${l.path} exists`);
    else fail(`languages[${i}] names "${l.path}", which does not exist`);
  }
  const onDiskLangs = readdirSync(join(ROOT, "lang")).filter((f) => f.endsWith(".json")).map((f) => `lang/${f}`);
  const undeclaredLangs = onDiskLangs.filter((p) => !declaredLangs.has(p));
  if (undeclaredLangs.length) fail(`lang/ files never declared: ${undeclaredLangs.join(", ")}`);
  else ok(`all ${onDiskLangs.length} lang files are declared`);

  /* 2. Link keys ------------------------------------------------------------ */
  for (const key of ["readme", "bugs", "changelog", "manifest", "download", "url"]) {
    const v = manifest[key];
    if (!v) fail(`no "${key}" declared`);
    else if (!/^https:\/\/\S+$/.test(v)) fail(`"${key}" is not an absolute https URL: ${JSON.stringify(v)}`);
    else ok(`${key}: ${v}`);
  }
  if (manifest.manifest && !manifest.manifest.endsWith(`/${kind}.json`)) {
    fail(`"manifest" must end in ${kind}.json for the ${kind} flavor: ${manifest.manifest}`);
  }
  if (manifest.download && !manifest.download.endsWith(`/${kind}.zip`)) {
    fail(`"download" must end in ${kind}.zip for the ${kind} flavor: ${manifest.download}`);
  }
  if (manifest.license !== "LICENSE.txt" || !existsSync(join(ROOT, "LICENSE.txt"))) fail("\"license\" must name LICENSE.txt and the file must exist");
  else ok("license: LICENSE.txt exists");

  /* 3. Packs ---------------------------------------------------------------- */
  const declaredPacks = new Set((manifest.packs ?? []).map((p) => p.name));
  for (const pack of manifest.packs ?? []) {
    const src = join(ROOT, "src", "packs", pack.name);
    if (!existsSync(src)) { fail(`pack "${pack.name}" is declared but src/packs/${pack.name}/ does not exist`); continue; }
    const docs = readdirSync(src).filter((f) => f.endsWith(".yml")).length;
    if (docs) ok(`pack "${pack.name}": ${docs} source document(s)`);
    else fail(`pack "${pack.name}" has no YAML under src/packs/${pack.name}/`);
    if (kind === "system") {
      if (pack.system !== manifest.id) fail(`pack "${pack.name}" declares system "${pack.system}", not "${manifest.id}"`);
    } else if ("system" in pack) {
      fail(`pack "${pack.name}" declares system "${pack.system}" — a module pack must declare none, or it is locked to that system`);
    }
  }
  const packSrc = join(ROOT, "src", "packs");
  const onDiskPacks = existsSync(packSrc)
    ? readdirSync(packSrc, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
    : [];
  const undeclaredPacks = onDiskPacks.filter((n) => !declaredPacks.has(n));
  if (undeclaredPacks.length) fail(`src/packs/ holds undeclared pack(s): ${undeclaredPacks.join(", ")}`);
  else ok(`all ${onDiskPacks.length} pack source dirs are declared`);

  const filed = new Map();
  const walkFolders = (folders, trail = []) => {
    for (const f of folders ?? []) {
      const label = [...trail, f?.name ?? "(unnamed)"].join(" / ");
      for (const name of f?.packs ?? []) {
        if (filed.has(name)) fail(`pack "${name}" is filed twice (${filed.get(name)} and ${label})`);
        else filed.set(name, label);
        if (!declaredPacks.has(name)) fail(`packFolders "${label}" names "${name}", which is not a declared pack`);
      }
      walkFolders(f?.folders, [...trail, f?.name]);
    }
  };
  walkFolders(manifest.packFolders ?? []);
  const unfiled = [...declaredPacks].filter((n) => !filed.has(n));
  if (unfiled.length) fail(`pack(s) no packFolders entry names: ${unfiled.join(", ")}`);
  else ok(`all ${declaredPacks.size} packs are filed in packFolders`);

  return manifest;
};

const single = process.argv[2] ? resolve(process.argv[2]) : null;
const manifests = single
  ? [checkManifest(single)]
  : [checkManifest(join(ROOT, "system.json")), checkManifest(join(ROOT, "module.json"))];

/* 4. Journal ids ------------------------------------------------------------ */
const rulesJs = readFileSync(join(ROOT, "module", "rules.js"), "utf8");
const rulesDir = join(ROOT, "src", "packs", "rules");
const ymlIds = existsSync(rulesDir)
  ? readdirSync(rulesDir).filter((f) => f.endsWith(".yml"))
    .map((f) => /^_id: ([A-Za-z0-9]{16})/m.exec(readFileSync(join(rulesDir, f), "utf8"))?.[1]).filter(Boolean)
  : [];
const journalIds = [...rulesJs.matchAll(/(\w+_JOURNAL_ID)\s*=\s*"([A-Za-z0-9]{16})"/g)];
if (!journalIds.length) fail("module/rules.js declares no *_JOURNAL_ID");
for (const [, name, id] of journalIds) {
  if (ymlIds.includes(id)) ok(`${name} ${id} matches an entry in src/packs/rules/`);
  else fail(`${name} ${id} is not the _id of any entry in src/packs/rules/ (${ymlIds.join(", ") || "none"})`);
}

/* 5. The two manifests agree ------------------------------------------------ */
if (manifests.length === 2) {
  console.log("\nsystem.json vs module.json");
  const [sys, mod] = manifests;
  if (sys.version !== mod.version) fail(`versions differ: system ${sys.version}, module ${mod.version} (one tag ships both)`);
  else ok(`both manifests at version ${sys.version}`);
  if (JSON.stringify(sys.documentTypes) !== JSON.stringify(mod.documentTypes)) {
    fail("documentTypes differ between the manifests — one schema serves both flavors");
  } else ok("documentTypes agree");
  if (sys.id === mod.id) fail(`both manifests claim id "${sys.id}"`);
  else ok(`ids differ (${sys.id} / ${mod.id})`);
  const shared = (sys.esmodules ?? []).filter((e) => (mod.esmodules ?? []).includes(e));
  if (shared.length) fail(`the flavors share an entry file: ${shared.join(", ")}`);
  else ok("each flavor has its own entry file");
}

console.log(`\n${failed ? "MANIFEST CHECK FAILED" : "Manifest check passed."}`);
process.exit(failed ? 1 : 0);
