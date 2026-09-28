import { CONTENT_NS, NS } from "./constants.js";
import { renderFromBoard } from "./scoreboard.js";

/** The journals the importers under tools/import/ write; `check:manifest` keeps the ids equal. */
export const RULES_JOURNAL_ID = "VV0ezsslj1ZG9qbc";
export const ODDS_JOURNAL_ID = "ABPaGhE6b5ZXatpu";
/** A pack collection is keyed by the RUNNING package: whoever ships the pack owns the key. */
export const RULES_PACK = `${NS}.rules`;

const openJournal = async (id, name, options = {}) => {
  let doc = await fromUuid(`Compendium.${RULES_PACK}.JournalEntry.${id}`);
  if (!doc) {
    const pack = game.packs.get(RULES_PACK);
    const entry = pack?.index.find((e) => e.name === name);
    doc = entry ? await pack.getDocument(entry._id) : null;
  }
  if (!doc) return ui.notifications.warn("PD.Notify.JournalMissing", { format: { name } });
  return renderFromBoard(doc.sheet, options);
};

/** The shipped rules journal. */
export const openRules = () => openJournal(RULES_JOURNAL_ID, "Penny Dreadful Rules");

/** The table of success chances for every hand of pennies and every DS. */
export const openOdds = () => openJournal(ODDS_JOURNAL_ID, "Odds of Success", { expanded: false });

/**
 * Foundry's journal sheet shows the entry's name three times: the window
 * title, a rename field at the top of the pages, and the first page's
 * heading. On the system's own journals (flagged by the importers) the
 * rename field goes; the window title names the journal, and each page keeps
 * the heading it needs. Rename an imported copy from the Journal directory.
 * The flag is baked CONTENT (both flavors ship the same packs), so it is
 * read under CONTENT_NS and straight off `flags`: `getFlag` would throw in
 * the module flavor, where "penny-dreadful" is not an installed package.
 */
export const registerJournalHooks = () => {
  Hooks.on("renderJournalEntrySheet", (app, element) => {
    element.classList.toggle("pd-journal", !!app.document?.flags?.[CONTENT_NS]?.journal);
  });
};
