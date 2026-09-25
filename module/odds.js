/**
 * The odds of a flip: the chance that n fair coins show at least ds heads.
 * Pure arithmetic with no Foundry in it, so `tools/import/odds.mjs` runs the
 * same code in node to write the odds journal the board's tooltips agree with.
 */
const choose = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
};

/** @returns {number} probability in [0, 1] */
export const chanceOfSuccess = (n, ds) => {
  if (ds <= 0) return 1;
  if (ds > n) return 0;
  let ways = 0;
  for (let k = ds; k <= n; k++) ways += choose(n, k);
  return ways / 2 ** n;
};

/**
 * "62.3%": at most one decimal, in the given language's own number format.
 * The board passes `game.i18n.lang`; the node importer writes the English journal.
 */
export const percent = (p, lang = "en") =>
  new Intl.NumberFormat(lang, { style: "percent", maximumFractionDigits: 1 }).format(p);
