/**
 * Fill in and submit Foundry's /join form, for the smokes.
 *
 * Up to 14.367 the form offers a <select name="userid"> of every user; from
 * 14.368 it is a typed <input name="username"> and lists nobody. `name`
 * null means "the GM": the first user on the old form, and on the new one
 * the first of `gmNames` that gets in. Pass the names the world really has
 * ("The Director" for the system, "Warden" for the Air Bladder host world):
 * every wrong guess makes Foundry log a console error.
 * Resolves to the name used once /game is loading; throws if none got in.
 */
export async function submitJoin(page, url, name, gmNames = []) {
  await page.goto(`${url}/join`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('select[name="userid"], input[name="username"]', { state: "attached", timeout: 30000 });
  const submit = () => page.locator('button[type="submit"][name="join"], form#join-game button[type="submit"]').first().click({ timeout: 15000 });

  if (await page.locator('select[name="userid"]').count()) {
    await page.waitForSelector('select[name="userid"] option[value]:not([value=""])', { state: "attached", timeout: 30000 });
    const picked = await page.evaluate((name) => {
      const s = document.querySelector('select[name="userid"]');
      const opt = [...s.options].find((o) => o.value && (name === null || o.textContent.trim() === name));
      if (!opt) return null;
      s.value = opt.value;
      s.dispatchEvent(new Event("change", { bubbles: true }));
      return opt.textContent.trim();
    }, name);
    if (!picked) throw new Error(`joinAs: no user ${name ?? "(first)"} offered`);
    await submit();
    return picked;
  }

  for (const candidate of name === null ? gmNames : [name]) {
    await page.fill('input[name="username"]', candidate);
    await submit();
    try {
      await page.waitForURL(/\/game\b/, { timeout: 15000 });
      return candidate;
    } catch {
      if (!/\/join\b/.test(page.url())) await page.goto(`${url}/join`, { waitUntil: "networkidle", timeout: 60000 });
    }
  }
  throw new Error(`joinAs: no user ${name ?? `(GM: ${gmNames.join(", ")})`} could join`);
}
