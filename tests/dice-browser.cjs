// Udviklingstest af Madterningen. Testdata hentes fra det rigtige API.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.QA_URL || 'http://127.0.0.1:8043/';
const output = process.env.QA_OUTPUT || '/tmp/paa-dice-tests';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const results = [];
  const errors = [];
  async function check(name, action) {
    try {
      await action();
      results.push({ name, status: 'PASS' });
    } catch (error) {
      results.push({ name, status: 'FAIL', error: error.message });
    }
    console.log(JSON.stringify(results.at(-1)));
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  const requests = [];
  page.on('request', request => {
    if (request.url().startsWith('https://dummyjson.com/recipes')) requests.push(request.url());
  });
  async function visit(query = '') {
    await page.goto(`${base}madterningen.html${query}`);
    await page.waitForFunction(() => !document.querySelector('#dice-preferences').disabled);
  }
  async function openFilters() {
    if (!await page.locator('#dice-filter-options').evaluate(e => e.open)) {
      await page.locator('#dice-filter-options>summary').click();
    }
  }
  async function roll(method = 'click') {
    const before = await page.locator('.recipe-card').count() ? await page.locator('.recipe-card').getAttribute('data-recipe-id') : null;
    if (method === 'click') await page.locator('#dice-roll').click();
    else {
      await page.locator('#dice-roll').focus();
      await page.keyboard.press(method);
    }
    await page.waitForFunction(old => {
      const card = document.querySelector('.recipe-card');
      return card && card.dataset.recipeId !== old && !document.querySelector('#dice-roll').hasAttribute('aria-disabled');
    }, before);
    return Number(await page.locator('.recipe-card').getAttribute('data-recipe-id'));
  }
  await visit();
  const raw = await page.evaluate(async () => (await fetch('https://dummyjson.com/recipes?limit=0')).json());
  const data = raw.recipes;
  fs.writeFileSync(path.join(output, 'actual-api.json'), JSON.stringify(raw, null, 2));
  const count = async () => Number((await page.locator('#match-count').textContent()).match(/^\d+/)[0]);
  await check('initial: no recipe, six pip faces and native primary button', async () => {
    assert.equal(await page.locator('.recipe-card').count(), 0);
    assert.equal(await page.locator('#dice-roll').evaluate(e => e.tagName), 'BUTTON');
    assert.equal(await count(), raw.total);
    assert.equal(await page.locator('.dice-face').count(), 6);
    for (let i = 1; i <= 6; i++) assert.equal(await page.locator(`.dice-face--${i} .pip`).count(), i);
    assert.equal(await page.locator('.dice-cube').evaluate(e => getComputedStyle(e).transformStyle), 'preserve-3d');
  });
  await check('actual rotation, 850 ms duration, rapid activations ignored, focus retained', async () => {
    await page.locator('#dice-roll').focus();
    await page.keyboard.press('Enter');
    const state = await page.evaluate(() => {
      const die = document.querySelector('.dice-cube');
      const button = document.querySelector('#dice-roll');
      const first = getComputedStyle(die).transform;
      button.click(); button.click();
      return { first, busy: button.getAttribute('aria-disabled'), active: document.activeElement.id, duration: getComputedStyle(die).animationDuration, animations: die.getAnimations().length };
    });
    assert.equal(state.busy, 'true');
    assert.equal(state.active, 'dice-roll');
    assert.equal(state.duration, '0.85s');
    assert.equal(state.animations, 1);
    await page.waitForTimeout(230);
    assert.notEqual(await page.locator('.dice-cube').evaluate(e => getComputedStyle(e).transform), state.first);
    await page.waitForFunction(() => !document.querySelector('#dice-roll').hasAttribute('aria-disabled'));
    assert.equal(await page.locator('.recipe-card').count(), 1);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dice-roll');
    assert.match(await page.locator('#dice-instruction').textContent(), /igen/);
  });
  await check('Enter and Space, repeat avoidance and correct real recipe result', async () => {
    const previous = Number(await page.locator('.recipe-card').getAttribute('data-recipe-id'));
    const first = await roll('Space');
    assert.notEqual(first, previous);
    const second = await roll('Enter');
    assert.notEqual(first, second);
    const recipe = data.find(r => r.id === second);
    assert.equal(await page.locator('.card-title').textContent(), recipe.name);
    assert.equal(await page.locator('.recipe-image').getAttribute('src'), recipe.image);
    assert.equal(await page.locator('.card-body>.button').getAttribute('href'), `singleproduct.html?id=${second}`);
    assert.match(await page.locator('.card-meta').textContent(), new RegExp(`${recipe.prepTimeMinutes + recipe.cookTimeMinutes} min`));
    await page.locator('.recipe-image').evaluate(img => img.decode());
    assert.equal(await page.locator('.recipe-image').evaluate(img => img.naturalWidth > 0), true);
    assert.equal(await page.locator('.dice-result [aria-live]').count(), 0);
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snack'].filter(value => data.some(r => r.mealType.includes(value) || value === 'Snack' && r.mealType.includes('Snacks')));
  for (const meal of meals) await check(`meal ${meal}: real count and matching recipe`, async () => {
    await page.locator('#dice-reset').click();
    await openFilters();
    await page.locator('#dice-meals').selectOption(meal);
    const matches = data.filter(r => r.mealType.some(m => (m === 'Snacks' ? 'Snack' : m) === meal));
    assert.equal(await count(), matches.length);
    const id = await roll();
    assert.ok(matches.some(r => r.id === id));
  });
  for (const time of ['under30', '30to45', 'over45']) await check(`time ${time}: existing prep + cook calculation`, async () => {
    await page.locator('#dice-reset').click();
    await openFilters();
    await page.locator('#dice-times').selectOption(time);
    const matches = data.filter(r => {
      const t = r.prepTimeMinutes + r.cookTimeMinutes;
      return time === 'under30' ? t < 30 : time === '30to45' ? t >= 30 && t <= 45 : t > 45;
    });
    assert.equal(await count(), matches.length);
    const id = await roll();
    assert.ok(matches.some(r => r.id === id));
  });
  for (const difficulty of [...new Set(data.map(r => r.difficulty))]) await check(`difficulty ${difficulty}: supported values only`, async () => {
    await page.locator('#dice-reset').click();
    await openFilters();
    await page.locator('#dice-difficulties').selectOption(difficulty);
    const matches = data.filter(r => r.difficulty === difficulty);
    assert.equal(await count(), matches.length);
    const id = await roll();
    assert.ok(matches.some(r => r.id === id));
  });
  await check('combined imported multi-select keeps union within group and intersection between groups', async () => {
    await visit('?meal=Dinner&meal=Lunch&time=under30&difficulty=Easy');
    const matches = data.filter(r => r.mealType.some(m => ['Dinner', 'Lunch'].includes(m)) && r.prepTimeMinutes + r.cookTimeMinutes < 30 && r.difficulty === 'Easy');
    assert.equal(await count(), matches.length);
    assert.equal(await page.locator('#dice-meals').inputValue(), 'imported');
    assert.match(await page.locator('#dice-imported-note').textContent(), /Flere valg/);
    const id = await roll();
    assert.ok(matches.some(r => r.id === id));
    await page.locator('#dice-meals').selectOption('Dinner');
    const dinner = matches.filter(r => r.mealType.includes('Dinner'));
    assert.equal(await count(), dinner.length);
    assert.equal(await page.locator('#dice-times').inputValue(), 'under30');
    assert.equal(await page.locator('#dice-difficulties').inputValue(), 'Easy');
  });
  await check('advanced cuisine, rating, ingredients and search work together', async () => {
    const recipe = data[0];
    await page.locator('#dice-reset').click();
    await openFilters();
    await page.locator('#dice-more-filters>summary').click();
    await page.locator(`input[name=cuisine][value="${recipe.cuisine}"]`).check();
    await page.locator('#dice-rating').selectOption('4');
    await page.locator('#dice-ingredients').fill(recipe.ingredients[0]);
    await page.locator('#dice-search').fill(recipe.name);
    const expected = await page.evaluate(async raw => {
      const { filterRecipes, readFilters } = await import('./js/filters.js');
      const { normalizeRecipe } = await import('./js/api.js');
      const query = new URLSearchParams({ cuisine: raw[0].cuisine, rating: '4', ingredients: raw[0].ingredients[0], q: raw[0].name });
      return filterRecipes(raw.map(normalizeRecipe), readFilters(query)).map(r => r.id);
    }, data);
    assert.equal(await count(), expected.length);
    const id = await roll();
    assert.ok(expected.includes(id));
  });
  await check('zero match disables die, keeps selections and offers one-click reset', async () => {
    await page.locator('#dice-search').fill('zzzzunavailable');
    assert.equal(await count(), 0);
    assert.equal(await page.locator('#dice-roll').isDisabled(), true);
    assert.match(await page.locator('#status').textContent(), /Ingen opskrifter passer til dine filtre/);
    assert.equal(await page.locator('.recipe-card').count(), 0);
    assert.equal(await page.locator('#dice-search').inputValue(), 'zzzzunavailable');
    await page.locator('#dice-reset').click();
    await openFilters();
    assert.equal(await count(), data.length);
    assert.equal(await page.locator('#dice-roll').isEnabled(), true);
  });
  await check('single-match pool can repeat and reduced motion finishes synchronously', async () => {
    await page.locator('#dice-search').fill(data[0].name);
    assert.equal(await count(), 1);
    for (let i = 0; i < 2; i++) {
      const snapshot = await page.evaluate(() => {
        document.querySelector('#dice-roll').click();
        return { id: Number(document.querySelector('.recipe-card')?.dataset.recipeId), rolling: document.querySelector('.dice-cube').getAnimations().length, busy: document.querySelector('#dice-roll').hasAttribute('aria-disabled') };
      });
      assert.equal(snapshot.id, data[0].id);
      assert.equal(snapshot.rolling, 0);
      assert.equal(snapshot.busy, false);
    }
  });
  await check('favorite save/remove persists actual ID, detail navigation works', async () => {
    await page.locator('.favorite-button').click();
    assert.equal(await page.locator('.favorite-button').getAttribute('aria-pressed'), 'true');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('paa-menuen:favorites:v1')));
    assert.ok(saved.includes(data[0].id));
    await page.locator('.favorite-button').click();
    assert.equal(await page.locator('.favorite-button').getAttribute('aria-pressed'), 'false');
    await page.locator('.card-body>.button').click();
    await page.locator('#recipe-detail h1').waitFor();
    assert.equal(await page.locator('#recipe-detail h1').textContent(), data[0].name);
  });
  await check('URL overrides stored filters; local changes/reset do not write shared state', async () => {
    const stored = 'cuisine=Italian&time=under30&meal=Dinner';
    await page.evaluate(query => sessionStorage.setItem('paa-menuen:filters:v1', JSON.stringify(query)), stored);
    await visit();
    assert.equal(await page.locator('input[name=cuisine][value=Italian]').isChecked(), true);
    assert.equal(await page.locator('#dice-times').inputValue(), 'under30');
    await page.locator('#dice-reset').click();
    await openFilters();
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('paa-menuen:filters:v1'))), stored);
    await visit('?meal=Dessert&rating=4.2');
    assert.equal(await page.locator('#dice-meals').inputValue(), 'Dessert');
    assert.equal(await page.locator('#dice-rating').inputValue(), '4.2');
    assert.equal(await page.locator('input[name=cuisine][value=Italian]').isChecked(), false);
    await page.locator('#dice-reset').click();
    await openFilters();
    assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('paa-menuen:filters:v1'))), stored);
  });
  await check('changing filters during animation cancels stale result and permits next roll', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('#dice-roll').click();
    await openFilters();
    await page.locator('#dice-meals').selectOption('Breakfast');
    assert.equal(await page.locator('.recipe-card').count(), 0);
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.recipe-card').count(), 0);
    const id = await roll();
    assert.ok(data.find(r => r.id === id).mealType.includes('Breakfast'));
  });
  await check('filtering and rolling add no recipe API calls', async () => {
    const before = requests.length;
    await page.locator('#dice-reset').click();
    await openFilters();
    await roll(); await roll();
    assert.equal(requests.length, before);
  });
  for (const width of [320, 390, 768, 1440]) {
    for (const motion of ['reduce', 'no-preference']) await check(`responsive ${width}px / ${motion}: layout, image position, focus, overflow`, async () => {
      await page.setViewportSize({ width, height: 1000 });
      await page.emulateMedia({ reducedMotion: motion });
      await page.locator('#dice-reset').click();
      await openFilters();
      await roll();
      await page.locator('.recipe-image').evaluate(img => img.decode());
      const layout = await page.evaluate(() => {
        const dice = document.querySelector('#dice-roll').getBoundingClientRect();
        const image = document.querySelector('.recipe-image').getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth, die: { x: dice.x, y: dice.y, right: dice.right, height: dice.height, width: dice.width }, image: { x: image.x, y: image.y } };
      });
      assert.equal(layout.overflow, false);
      assert.ok(layout.die.width >= 44 && layout.die.height >= 44);
      if (width >= 700) assert.ok(layout.image.x >= layout.die.right);
      else assert.ok(layout.image.y > layout.die.y);
      assert.equal(await page.evaluate(() => document.activeElement.id), 'dice-roll');
      if (!await page.locator('#dice-more-filters').evaluate(e => e.open)) await page.locator('#dice-more-filters>summary').click();
      assert.equal(await page.locator('#dice-rating').isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('#dice-more-filters>summary').click();
    });
  }
  await check('real touch events activate the native die button', async () => {
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const mobile = await touch.newPage();
    await mobile.goto(`${base}madterningen.html`);
    await mobile.waitForSelector('#dice-roll:not([disabled])');
    assert.match(await mobile.locator('#dice-instruction').textContent(), /^Tryk/);
    await mobile.locator('#dice-roll').tap();
    await mobile.locator('.recipe-card').waitFor();
    const id = Number(await mobile.locator('.recipe-card').getAttribute('data-recipe-id'));
    assert.ok(data.some(r => r.id === id));
    await touch.close();
  });
  await check('loading disables control; real network failure is honest; retry succeeds', async () => {
    const isolated = await browser.newContext();
    const failure = await isolated.newPage();
    await failure.route('https://dummyjson.com/recipes**', route => route.abort('failed'));
    await failure.goto(`${base}madterningen.html`);
    await failure.waitForFunction(() => document.querySelector('#status').dataset.state === 'error');
    assert.equal(await failure.locator('#dice-roll').isDisabled(), true);
    assert.equal(await failure.locator('#dice-preferences').evaluate(e => e.disabled), true);
    assert.equal(await failure.locator('.recipe-card').count(), 0);
    assert.equal(await failure.locator('#retry').isVisible(), true);
    await failure.unroute('https://dummyjson.com/recipes**');
    await failure.locator('#retry').click();
    await failure.waitForSelector('#dice-roll:not([disabled])');
    assert.match(await failure.locator('#match-count').textContent(), new RegExp(`^${data.length} `));
    await isolated.close();
  });
  await check('unsupported imported filter stays visible and yields zero; no fictional option', async () => {
    await visit('?difficulty=UnknownLevel&meal=UnknownMeal&cuisine=UnknownCuisine');
    assert.equal(await count(), 0);
    assert.match(await page.locator('#active-filters').textContent(), /UnknownLevel/);
    assert.equal(await page.locator('input[value=UnknownLevel],input[value=UnknownMeal],input[value=UnknownCuisine]').count(), 0);
    await page.locator('#dice-reset').click();
    await openFilters();
    assert.equal(await count(), data.length);
  });
  await check('all six faces settle without accumulating turns; motion preference can change mid-roll', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const angles = [[0, 0], [-90, 0], [0, -90], [0, 90], [90, 0], [0, 180]];
    for (let face = 0; face < 6; face++) {
      await page.evaluate(face => {
        let call = 0;
        window.originalRandom = Math.random;
        Math.random = () => call++ === 0 ? .24 : (face + .1) / 6;
      }, face);
      await roll();
      const [x, y] = angles[face];
      assert.equal(await page.locator('.dice-cube').evaluate(e => e.style.transform), `rotateX(-18deg) rotateY(-22deg) rotateX(${x}deg) rotateY(${y}deg)`);
      assert.equal(await page.locator('.dice-cube').evaluate(e => e.getAnimations().length), 0);
      await page.evaluate(() => { Math.random = window.originalRandom; });
    }
    await page.locator('#dice-roll').click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('#dice-roll').hasAttribute('aria-disabled'));
    assert.equal(await page.locator('.dice-cube').evaluate(e => e.getAnimations().length), 0);
  });
  await check('no JavaScript page errors', async () => assert.deepEqual(errors, []));
  fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ browser: browser.version(), base, source: 'Live DummyJSON; network failure simulated by abort', results, errors }, null, 2));
  await browser.close();
  if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
})();
