// Målrettede UI-tests af de seks forbedringer; alle opskrifter hentes fra API'et.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.QA_URL || 'http://127.0.0.1:8046/';
const output = process.env.QA_OUTPUT || '/tmp/paa-menuen-polish';
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = [];
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  async function check(name, fn) {
    try { await fn(); results.push({ name, status: 'PASS' }); }
    catch (error) { results.push({ name, status: 'FAIL', error: error.message }); }
    console.log(JSON.stringify(results.at(-1)));
  }
  async function visit(query = '') {
    await page.goto(base + 'madterningen.html' + query);
    await page.waitForFunction(() => !document.querySelector('#dice-preferences').disabled);
  }
  async function openFilters(advanced = false) {
    if (!await page.locator('#dice-filter-options').evaluate(e => e.open)) await page.locator('#dice-filter-options>summary').click();
    if (advanced && !await page.locator('#dice-more-filters').evaluate(e => e.open)) await page.locator('#dice-more-filters>summary').click();
  }
  await visit();
  const raw = await page.evaluate(async () => (await fetch('https://dummyjson.com/recipes?limit=0')).json());
  const recipes = raw.recipes;
  const count = async () => Number((await page.locator('#match-count').textContent()).match(/^\d+/)[0]);
  const band = r => r.prepTimeMinutes + r.cookTimeMinutes < 30 ? 'under30' : r.prepTimeMinutes + r.cookTimeMinutes <= 45 ? '30to45' : 'over45';
  await check('optional filters collapsed before first roll, primary selects single-valued, no auto recipe', async () => {
    assert.equal(await page.locator('#dice-filter-options').evaluate(e => e.open), false);
    assert.equal(await page.locator('#dice-more-filters').evaluate(e => e.open), false);
    assert.equal(await page.locator('.recipe-card').count(), 0);
    assert.equal(await count(), raw.total);
    await openFilters();
    for (const id of ['dice-meals', 'dice-times', 'dice-difficulties']) assert.equal(await page.locator('#' + id).evaluate(e => e.multiple), false);
    const difficulties = await page.locator('#dice-difficulties option').evaluateAll(options => options.map(o => o.value).filter(Boolean));
    assert.deepEqual(difficulties.sort(), [...new Set(recipes.map(r => r.difficulty))].sort());
  });
  await check('single choice replaces only its category and other active dimensions remain', async () => {
    await visit('?meal=Dinner&time=under30&difficulty=Easy');
    await page.locator('#dice-meals').selectOption('Lunch');
    assert.equal(await page.locator('#dice-times').inputValue(), 'under30');
    assert.equal(await page.locator('#dice-difficulties').inputValue(), 'Easy');
    const expected = recipes.filter(r => r.mealType.includes('Lunch') && band(r) === 'under30' && r.difficulty === 'Easy');
    assert.equal(await count(), expected.length);
    assert.equal(await page.locator('#active-filters button').count(), 3);
  });
  await check('all three imported multi-value groups are preserved, clearly shown and removable', async () => {
    await visit('?meal=Dinner&meal=Lunch&time=under30&time=30to45&difficulty=Easy&difficulty=Medium');
    for (const id of ['dice-meals', 'dice-times', 'dice-difficulties']) assert.equal(await page.locator('#' + id).inputValue(), 'imported');
    assert.equal(await page.locator('#dice-imported-note').isVisible(), true);
    const expected = recipes.filter(r => r.mealType.some(m => ['Dinner', 'Lunch'].includes(m)) && ['under30', '30to45'].includes(band(r)) && ['Easy', 'Medium'].includes(r.difficulty));
    assert.equal(await count(), expected.length);
    await page.getByRole('button', { name: 'Fjern filter: Aftensmad', exact: true }).click();
    assert.equal(await page.locator('#dice-meals').inputValue(), 'Lunch');
    assert.equal(await page.locator('#dice-times').inputValue(), 'imported');
    assert.equal(await page.locator('#dice-difficulties').inputValue(), 'imported');
    assert.equal(await page.locator('#active-filters button').count(), 5);
    assert.equal(await page.evaluate(() => document.activeElement.closest('#active-filters')?.id), 'active-filters');
  });
  await check('each chip removes one filter, keeps every other selection, focuses next/previous/reset', async () => {
    const r = recipes[0];
    const query = new URLSearchParams({ q: r.name, cuisine: r.cuisine, meal: r.mealType[0] === 'Snacks' ? 'Snack' : r.mealType[0], time: band(r), difficulty: r.difficulty, rating: '4', ingredients: r.ingredients[0] });
    await visit('?' + query);
    assert.equal(await count(), 1);
    for (let i = 7; i > 0; i--) {
      const chips = await page.locator('#active-filters button').allTextContents();
      assert.equal(chips.length, i);
      // Skift mellem første og sidste chip for at prøve både næste og forrige fokus.
      const target = i % 2 ? page.locator('#active-filters button').first() : page.locator('#active-filters button').last();
      const removed = await target.textContent();
      await target.press('Enter');
      const after = await page.locator('#active-filters button').allTextContents();
      assert.deepEqual(after, chips.filter(x => x !== removed));
      assert.ok(await count() >= 1);
      if (i > 1) assert.equal(await page.evaluate(() => document.activeElement.closest('#active-filters')?.id), 'active-filters');
      else assert.equal(await page.evaluate(() => document.activeElement.id), 'dice-reset');
    }
    assert.equal(await page.locator('#dice-search').inputValue(), '');
    assert.equal(await page.locator('#dice-ingredients').inputValue(), '');
    assert.equal(await page.locator('#dice-rating').inputValue(), '');
    for (const id of ['dice-meals', 'dice-times', 'dice-difficulties']) assert.equal(await page.locator('#' + id).inputValue(), '');
    assert.equal(await count(), raw.total);
  });
  await check('filter changes explain missing result; zero results have their own honest message', async () => {
    await visit();
    await page.locator('#dice-roll').click();
    await page.locator('.recipe-card').waitFor();
    await openFilters(true);
    await page.locator('#dice-meals').selectOption('Dinner');
    assert.equal(await page.locator('.recipe-card').count(), 0);
    assert.equal(await page.locator('.dice-result-placeholder').textContent(), 'Dine filtre er opdateret. Kast terningen igen for at få et nyt forslag.');
    await page.locator('#dice-search').fill('zzzzunavailable');
    assert.match(await page.locator('.dice-result-placeholder').textContent(), /^Ingen opskrifter passer/);
    assert.equal(await page.locator('#dice-roll').isDisabled(), true);
    await page.locator('#dice-reset').click();
    assert.match(await page.locator('.dice-result-placeholder').textContent(), /^Dine filtre er opdateret/);
  });
  for (const width of [320, 390]) await check(`typing at ${width}px reuses placeholder, keeps input position/focus, avoids duplicate announcements`, async () => {
    await page.setViewportSize({ width, height: 1000 });
    await visit();
    await page.locator('#dice-roll').click();
    await page.locator('.recipe-card').waitFor();
    await openFilters(true);
    await page.locator('#dice-search').fill('c');
    const placeholder = await page.locator('.dice-result-placeholder').elementHandle();
    const before = await page.locator('#dice-search').boundingBox();
    await page.evaluate(() => {
      window.statusChanges = 0;
      window.statusObserver = new MutationObserver(() => window.statusChanges++);
      window.statusObserver.observe(document.querySelector('#status'), { childList: true, characterData: true, subtree: true });
    });
    await page.locator('#dice-search').fill('ch');
    await page.locator('#dice-search').fill('chi');
    const after = await page.locator('#dice-search').boundingBox();
    assert.equal(await placeholder.evaluate(node => node.isConnected), true);
    assert.equal(after.y, before.y);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dice-search');
    assert.equal(await page.evaluate(() => window.statusChanges), 0);
    await page.evaluate(() => window.statusObserver.disconnect());
  });
  for (const width of [320, 390, 768, 1440]) await check(`first-view dice, reading order, image-first result and navigation clearance ${width}px`, async () => {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    await visit();
    const initial = await page.evaluate(() => {
      const die = document.querySelector('#dice-roll'), preferences = document.querySelector('#dice-preferences'), result = document.querySelector('#dice-result');
      const r = die.getBoundingClientRect(), nav = document.querySelector('.bottom-nav');
      return { y: r.y, bottom: r.bottom, height: innerHeight, navTop: getComputedStyle(nav).display === 'none' ? innerHeight : nav.getBoundingClientRect().top, readingOrder: Boolean(die.compareDocumentPosition(preferences) & Node.DOCUMENT_POSITION_FOLLOWING) && Boolean(preferences.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    assert.ok(initial.y > 0 && initial.bottom <= initial.navTop);
    assert.equal(initial.readingOrder, true);
    await page.locator('#dice-roll').press('Space');
    await page.locator('.recipe-card').waitFor();
    await page.locator('.recipe-image').evaluate(i => i.decode());
    const layout = await page.evaluate(() => {
      const d = document.querySelector('#dice-roll').getBoundingClientRect(), image = document.querySelector('.recipe-image').getBoundingClientRect(), title = document.querySelector('.card-title').getBoundingClientRect();
      return { overflow: document.documentElement.scrollWidth > innerWidth, imageY: image.y, titleY: title.y, imageX: image.x, dieRight: d.right, reveal: getComputedStyle(document.querySelector('.recipe-card')).animationName };
    });
    assert.equal(layout.overflow, false);
    if (width < 700) assert.ok(layout.imageY < layout.titleY);
    else assert.ok(layout.imageX >= layout.dieRight);
    assert.equal(layout.reveal, 'none');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dice-roll');
    await openFilters();
    const labelsFit = await page.locator('.dice-primary-filters>div').evaluateAll(rows => rows.every(row => {
      const range = document.createRange();
      range.selectNodeContents(row.querySelector('label'));
      return range.getBoundingClientRect().right < row.querySelector('select').getBoundingClientRect().left;
    }));
    assert.equal(labelsFit, true, 'filter labels must not collide with selects');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  });
  await check('short normal-motion reveal and resting shadow/hover, all removed when motion is reduced', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await visit();
    await page.locator('#dice-roll').click();
    await page.waitForFunction(() => document.querySelector('.recipe-card') && !document.querySelector('#dice-roll').hasAttribute('aria-disabled'));
    assert.equal(await page.locator('.recipe-card').evaluate(e => getComputedStyle(e).animationDuration), '0.2s');
    assert.equal(await page.locator('.recipe-card').evaluate(e => getComputedStyle(e).animationName), 'recipe-reveal');
    assert.equal(await page.locator('.dice-scene').evaluate(e => getComputedStyle(e).width), '116px');
    assert.notEqual(await page.locator('#dice-roll').evaluate(e => getComputedStyle(e, '::after').boxShadow), 'none');
    await page.locator('#dice-roll').hover();
    await page.waitForTimeout(200);
    assert.notEqual(await page.locator('.dice-scene').evaluate(e => getComputedStyle(e).transform), 'none');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.recipe-card').evaluate(e => getComputedStyle(e).animationName), 'none');
    assert.equal(await page.locator('.dice-scene').evaluate(e => getComputedStyle(e).transform), 'none');
  });
  await check('no page errors', async () => assert.deepEqual(errors, []));
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ base, browser: browser.version(), results, errors, dataSource: 'Live DummyJSON; MutationObserver only in test context' }, null, 2));
  await browser.close();
  if (results.some(r => r.status === 'FAIL')) process.exitCode = 1;
})();
