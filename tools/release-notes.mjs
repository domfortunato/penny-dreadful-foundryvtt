/**
 * Release notes come from CHANGELOG.md — the section headed by the version being
 * cut — and travel to GitHub inside the release TAG.
 *
 * `sectionFor(text, version)` returns the section's content: the lines between
 * `## <version>` and the next `## ` heading, trimmed. `null` when the file has no
 * such heading, `""` when the heading has nothing under it; `release.mjs` refuses
 * both. `releaseBody(version, section)` is what the GitHub release shows.
 * `tagMessage(version, body)` is the annotated tag's message — subject, blank
 * line, body — which the Release Creation workflow reads back with
 * `git tag -l --format='%(contents:body)'`.
 *
 * The tag is made with `--cleanup=verbatim`: git's default cleanup drops every
 * line starting with `#`, headings included.
 */

/** A `## X.Y.Z` heading; trailing text on the line (a date, say) is allowed. */
export const HEADING = /^## (\d+\.\d+\.\d+)(?:\s.*)?$/;

export function sectionFor(text, version) {
  const lines = String(text).split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = HEADING.exec(lines[i]);
    if (m && m[1] === version) { start = i + 1; break; }
  }
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    if (/^## /.test(lines[i])) { end = i; break; }
  }
  return lines.slice(start, end).join("\n").trim();
}

export function releaseBody(version, section) {
  return `# Penny Dreadful ${version}\n\n${section}\n`;
}

export function tagMessage(version, body) {
  return `Penny Dreadful ${version}\n\n${body}`;
}
