#!/usr/bin/env node
/** `node --check` over every module file and tool script. Offline, seconds. */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const files = [];
const walk = (dir, ext) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, ext);
    else if (ext.some((x) => e.name.endsWith(x))) files.push(p);
  }
};
walk(join(ROOT, "module"), [".js"]);
walk(join(ROOT, "tools"), [".mjs"]);

let failed = 0;
for (const f of files) {
  const r = spawnSync(process.execPath, ["--check", f], { encoding: "utf8" });
  if (r.status === 0) console.log(`  ok    ${relative(ROOT, f)}`);
  else { failed++; console.error(`  FAIL  ${relative(ROOT, f)}\n${r.stderr}`); }
}
console.log(`\n${failed ? `SYNTAX CHECK FAILED (${failed})` : `Syntax check passed (${files.length} files).`}`);
process.exit(failed ? 1 : 0);
