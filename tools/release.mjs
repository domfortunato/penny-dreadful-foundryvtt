#!/usr/bin/env node
/**
 * Cut a new Penny Dreadful release — one command, no GitHub UI.
 *
 *     npm run release 0.1.1
 *     npm run release 0.1.1 -- --dry-run     # every check and the notes, nothing written
 *
 * What it does:
 *   1. validates the version (X.Y.Z, no leading "v")
 *   2. refuses unless you are on `master` — releases are never cut from a branch
 *   3. refuses if the working tree has uncommitted TRACKED changes, or the tag exists
 *   4. reads the release notes from CHANGELOG.md — the `## X.Y.Z` section — and
 *      refuses without them, so a release can never be published with an empty body
 *   5. prints the commits since the last tag and the notes, so you see what you are
 *      shipping and what the release page will say
 *   6. bumps `version` in BOTH system.json and module.json (minimal, single-line
 *      edits — one tag builds both flavors)
 *   7. commits "Release X.Y.Z", creates an annotated tag whose BODY is the notes,
 *      and pushes the branch + tag to `origin`
 *
 * The tag originates on `origin` (Gitea), so the Gitea->GitHub push mirror PROTECTS
 * it instead of pruning it — that pruning was the whole reason releases used to
 * vanish. Once the tag reaches GitHub, the "Release Creation" workflow triggers on
 * the tag push in EACH mirror target and builds that repo's flavor — system.json +
 * system.zip in the system repo, module.json + module.zip in the module repo — and
 * reads the notes back out of the tag for the release body — the notes land in the
 * same call that attaches the assets, nothing is pasted afterwards. The mirror
 * carries the tag OBJECT, not just the ref (every tag on GitHub lists a peeled `^{}`
 * entry, which only an annotated tag has), which is what makes the tag a carrier.
 *
 * See RELEASE.md for the full runbook.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { releaseBody, sectionFor, tagMessage } from "./release-notes.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const capture = (cmd) => execSync(cmd, { cwd: ROOT }).toString().trim();
const run = (cmd) => { console.log(`  $ ${cmd}`); execSync(cmd, { cwd: ROOT, stdio: "inherit" }); };
const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

const args = process.argv.slice(2);
// Both spellings are dry. `npm run release X -- --dry-run` hands the flag to
// argv; `npm run release X --dry-run` — the form every doc here gave for a day —
// hands it to NPM, which owns a `dry-run` config of its own and forwards nothing
// but `npm_config_dry_run=true` (review #32, measured on npm 11). Reading argv
// alone made the documented preview a REAL release on master and a refusal on dev.
const dryRun = args.includes("--dry-run") || process.env.npm_config_dry_run === "true";
const version = args.find((a) => !a.startsWith("--"));
if (!version) die("Usage: npm run release <version> [-- --dry-run]   e.g. npm run release 0.1.1");
if (!/^\d+\.\d+\.\d+$/.test(version)) die(`Version must be X.Y.Z (digits only, no leading "v"). Got: ${version}`);

// 1. Releases are cut from master, never from a branch. Work lives on `dev` and
//    reaches master by merge. Without this guard `git push origin HEAD` below would
//    happily publish a branch and tag unmerged work — see RELEASE.md.
//    A dry run on `dev` is the ordinary way to preview the notes before the merge,
//    so there the guard reports instead of refusing.
const branch = capture("git rev-parse --abbrev-ref HEAD");
if (branch !== "master") {
  const msg = `Releases are cut from master. You are on "${branch}".\n` +
              `    git checkout master && git merge ${branch}`;
  if (dryRun) console.log(`(dry run) would refuse: ${msg}\n`);
  else die(msg);
}

// 2. Working tree must be clean of TRACKED changes (untracked scratch files are fine).
const dirty = capture("git status --porcelain --untracked-files=no");
if (dirty) die(`Working tree has uncommitted changes — commit or stash them first:\n${dirty}`);

// 3. The tag must not already exist locally...
if (capture(`git tag --list ${version}`)) {
  die(`Tag ${version} already exists. Pick a new version, or remove it first:\n` +
      `    git tag -d ${version} && git push origin :refs/tags/${version}`);
}
// ...nor on origin. The local check alone missed a tag deleted here but still on
// the remote — the release commit would land on master and only the tag push be
// refused, leaving master bumped for a version that never shipped (review #18).
// ls-remote needs the network; so does the push that follows.
if (capture(`git ls-remote --tags origin refs/tags/${version}`)) {
  die(`Tag ${version} already exists on origin. Pick a new version, or remove it first:\n` +
      `    git push origin :refs/tags/${version}`);
}

// 4. The release notes: CHANGELOG.md's section for this version, which becomes the
//    body of the tag and so the body of the GitHub release. Refused when the file
//    is missing, untracked (the notes would reach the tag and never the repo),
//    has no heading for the version, or has an empty one — 0.1.22 was published
//    with an empty body because the notes were a separate step nobody's checklist
//    held, and this is the step that holds it.
const changelogPath = path.join(ROOT, "CHANGELOG.md");
if (!fs.existsSync(changelogPath)) die(`CHANGELOG.md is missing. Write a "## ${version}" section in it first.`);
if (!capture("git ls-files CHANGELOG.md")) die(`CHANGELOG.md is not tracked. Commit it first.`);
const section = sectionFor(fs.readFileSync(changelogPath, "utf8"), version);
if (section === null) die(`CHANGELOG.md has no "## ${version}" section. Write the release notes there first.`);
if (!section) die(`CHANGELOG.md's "## ${version}" section is empty. Write the release notes there first.`);
const body = releaseBody(version, section);

// 5. Show what is about to ship. A forgotten merge shows up here as an empty list,
//    which is far cheaper to notice now than after the tag exists.
const lastTag = capture("git tag --sort=-v:refname").split("\n")[0];
if (lastTag) {
  const log = capture(`git log --oneline ${lastTag}..HEAD`);
  console.log(`\nShipping since ${lastTag}:`);
  console.log(log ? log.split("\n").map((l) => `  ${l}`).join("\n") : "  (nothing — no commits since that tag)");
  console.log("");
}
console.log(`Release notes (CHANGELOG.md, "## ${version}") — the body of the tag and of the GitHub release:\n`);
console.log(body.split("\n").map((l) => `  ${l}`).join("\n"));

if (dryRun) {
  console.log(`\n(dry run) Nothing written, nothing pushed.\n`);
  process.exit(0);
}

// 6. Bump the version in BOTH manifests (targeted single-line replace, so the
//    diff stays minimal): one tag ships two flavors, and check:manifest fails
//    the moment the two disagree. A manifest that already says this version is
//    fine: the first release of a new system ships the version it was
//    scaffolded with, so there is nothing to commit and the tag goes on HEAD.
const MANIFESTS = ["system.json", "module.json"];
let bumped = false;
for (const name of MANIFESTS) {
  const p = path.join(ROOT, name);
  const before = fs.readFileSync(p, "utf8");
  if (!/"version"\s*:\s*"[^"]*"/.test(before)) die(`Could not find a "version" field to update in ${name}`);
  const after = before.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`);
  if (after === before) { console.log(`✓ ${name} already at ${version}; no bump`); continue; }
  fs.writeFileSync(p, after);
  if (JSON.parse(after).version !== version) die(`${name} version did not update cleanly — aborting.`);
  console.log(`✓ ${name} version → ${version}`);
  bumped = true;
}

// 7. Commit (when bumped), tag, push branch + tag to origin.
if (bumped) {
  run(`git add ${MANIFESTS.join(" ")}`);
  run(`git commit -m "Release ${version}"`);
}
// The tag message comes from a file, not `-m`: it is many lines, and a quoted
// multi-line argument is exactly what PowerShell mangles. `--cleanup=verbatim`
// is load-bearing — git's default cleanup strips every line beginning with `#` as
// a comment, so the notes' own headline would vanish from the tag in silence; and
// `whitespace`, the mode for a day, still dropped a Markdown hard break's two
// trailing spaces and collapsed blank lines, which made RELEASE.md's "verbatim"
// false by two characters (review #32, proven in a throwaway repo, all three modes).
const msgDir = fs.mkdtempSync(path.join(os.tmpdir(), "penny-dreadful-release-"));
const msgPath = path.join(msgDir, "tag-message.txt");
fs.writeFileSync(msgPath, tagMessage(version, body));
try {
  run(`git tag -a ${version} --cleanup=verbatim -F "${msgPath.replace(/\\/g, "/")}"`);
} finally {
  fs.rmSync(msgDir, { recursive: true, force: true });
}
// ONE atomic push: branch and tag land together or not at all, so a refused tag
// can never leave master bumped without its release (review #18).
run(`git push --atomic origin HEAD refs/tags/${version}`);

console.log(`
✓ Release ${version} pushed to origin, notes and all.

Next:
  1. Make sure BOTH push mirrors have synced (the tag must reach both GitHub
     repos). In each, the "Release Creation" workflow triggers on the tag push
     and builds that repo's flavor — system.json + system.zip in
     penny-dreadful-foundryvtt, module.json + module.zip in
     penny-dreadful-module-foundryvtt — its body read from the tag (~1-2 min;
     watch both Actions tabs).
  2. Verify BOTH install manifests return 200 and read ${version}:
     https://github.com/domfortunato/penny-dreadful-foundryvtt/releases/latest/download/system.json
     https://github.com/domfortunato/penny-dreadful-module-foundryvtt/releases/latest/download/module.json
  3. Sync the development branch, or the next merge conflicts on the version bump
     this commit just made:
         git checkout dev && git merge master && git push origin dev
`);
