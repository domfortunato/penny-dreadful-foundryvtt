#!/usr/bin/env node
/**
 * The UI strings: `docs/ui-strings.md` -> `lang/en.json`.
 *
 *   node tools/import/strings.mjs [--dry]      (npm run import:strings)
 *
 * CANONICAL SOURCE IS THE WORKSHEET — Dom's own words, written for Foundry's
 * AI policy (§4.1: UI labels must be human-authored). Edit the worksheet's
 * "Your text:" lines, rerun this; never edit lang/en.json by hand. An entry
 * heading names one key, or a pair ("`X.One` and `X`", the 1 and the other
 * numbers), whose answers are taken in that order.
 *
 * Refuses, writing nothing, when a key of en.json has no answer, when the
 * worksheet names a key en.json does not have, or when an answer uses a
 * placeholder the code never fills (a typo like {nmae} would show raw).
 * Leaving a placeholder out is allowed: Dom dropped some on purpose.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dry = process.argv.includes("--dry");
const WORKSHEET = path.join(root, "docs", "ui-strings.md");
const LANG = path.join(root, "lang", "en.json");

const current = JSON.parse(fs.readFileSync(LANG, "utf8"));
const answers = {};
const problems = [];

for (const entry of fs.readFileSync(WORKSHEET, "utf8").split(/^(?=#### )/m)) {
  if (!entry.startsWith("#### ")) continue;
  const head = entry.split("\n", 1)[0];
  const keys = [...head.matchAll(/`((?:PD|TYPES)\.[^`]+)`/g)].map((m) => m[1]);
  const texts = [...entry.matchAll(/^Your text[^:\n]*:[ \t]*(.*)$/gm)]
    .map((m) => m[1].replace(/`/g, "").replace(/\s+/g, " ").trim());
  if (keys.length !== texts.length) {
    problems.push(`${keys.join(" / ")}: ${keys.length} key(s) but ${texts.length} answer line(s)`);
    continue;
  }
  keys.forEach((key, i) => { answers[key] = texts[i]; });
}

for (const [key, text] of Object.entries(answers)) {
  if (!(key in current)) { problems.push(`${key}: not a key of lang/en.json`); continue; }
  if (!text) { problems.push(`${key}: no answer yet`); continue; }
  const filled = new Set([...current[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  for (const [, name] of text.matchAll(/\{(\w+)\}/g)) {
    if (!filled.has(name)) problems.push(`${key}: {${name}} is not a placeholder the code fills (it fills ${[...filled].map((n) => `{${n}}`).join(" ") || "none"})`);
  }
}
for (const key of Object.keys(current)) if (!(key in answers)) problems.push(`${key}: missing from the worksheet`);

if (problems.length) {
  console.error(`FATAL: docs/ui-strings.md is not ready:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// Same keys, same (sorted) order; only the values change.
const next = Object.fromEntries(Object.keys(current).map((key) => [key, answers[key]]));
const changed = Object.keys(current).filter((key) => current[key] !== next[key]);
if (!dry) fs.writeFileSync(LANG, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log(`${dry ? "[dry] would write" : "wrote"} lang/en.json: ${Object.keys(next).length} strings, ${changed.length} changed`);
