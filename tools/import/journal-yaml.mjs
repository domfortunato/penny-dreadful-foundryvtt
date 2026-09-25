/**
 * Shared by the journal importers: seed-hashed ids that are stable across
 * runs, and the YAML shape `tools/packs.mjs` builds into the compendium.
 */
import crypto from "node:crypto";

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const idFor = (seed) => [...crypto.createHash("sha256").update(seed).digest().subarray(0, 16)]
  .map((b) => ALPHA[b % ALPHA.length]).join("");

export const y = (s) => {
  const str = String(s);
  if (str === "") return "''";
  if (/[:#{}[\],&*?|<>=!%@`'"]/.test(str) || /^\s|\s$/.test(str) || /^[-?]/.test(str)) {
    return `'${str.replace(/'/g, "''")}'`;
  }
  return str;
};

/**
 * One text page. `showTitle: false` drops the page's own heading where it
 * would only repeat the journal's name (a one-page journal).
 */
export const page = (ownerId, pageId, name, content, sort, { showTitle = true } = {}) => [
  `  - _id: ${pageId}`,
  `    name: ${y(name)}`,
  "    type: text",
  "    title:",
  `      show: ${showTitle}`,
  "      level: 1",
  "    text:",
  `      content: ${y(content)}`,
  "      format: 1",
  `    sort: ${sort}`,
  "    ownership:",
  "      default: -1",
  "    flags: {}",
  `    _key: '!journal.pages!${ownerId}.${pageId}'`,
].join("\n");

export const journalShell = (id, name, pages) => [
  `_id: ${id}`,
  `name: ${y(name)}`,
  "pages:",
  ...pages,
  "folder: null",
  "sort: 0",
  "ownership:",
  "  default: 0",
  // Marks the journal as the system's own: module/rules.js hides the sheet's
  // name field on it. A flag, so a copy imported into a world keeps it.
  "flags:",
  "  penny-dreadful:",
  "    journal: true",
  "_stats:",
  "  systemId: penny-dreadful",
  "  coreVersion: '14.365'",
  `_key: '!journal!${id}'`,
  "",
].join("\n");

export const collapse = (html) => html.replace(/\r?\n/g, " ").replace(/ {2,}/g, " ").trim();
