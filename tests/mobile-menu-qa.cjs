// Udviklingstest af mobilmenuen. Playwright er kun et testværktøj.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const base = (process.env.QA_URL || 'http://127.0.0.1:8018/').replace(/\/?$/, '/');
const output = process.env.QA_OUTPUT || 'output/playwright/mobilmenu';
const pages = [
  'index.html', 'productlist.html', 'singleproduct.html?id=1',
  'madterningen.html', 'favoritter.html', 'indkoebsliste.html', 'om-os.html'
];
const links = [
  ['Forside', 'index.html'], ['Opskrifter', 'productlist.html'],
  ['Madterningen', 'madterningen.html'], ['Favoritter', 'favoritter.html'],
  ['Indkøbsliste', 'indkoebsliste.html'], ['Om os', 'om-os.html']
];
const sizes = [
  [320, 740], [390, 844], [667, 375], [699, 800], [700, 800], [768, 1024], [1024, 768], [1099, 800],
  [1100, 800], [1440, 900], [1920, 1080], [844, 390], [390, 320]
];
fs.mkdirSync(output, { recursive: true });

(async () => {
  const launch = { headless: true };
  if (process.env.CHROME_PATH) launch.executablePath = process.env.CHROME_PATH;
  const browser = await chromium.launch(launch);
  const results = [];
  const errors = [];
  async function check(name, test) {
    try {
      await test();
      results.push({ name, status: 'PASS' });
      console.log('PASS ' + name);
    } catch (error) {
      results.push({ name, status: 'FAIL', error: error.message });
      console.error('FAIL ' + name + ': ' + error.message);
    }
  }

  try {
    for (const [width, height] of sizes) {
      const context = await browser.newContext({
        viewport: { width, height }, reducedMotion: 'reduce'
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      for (const route of pages) {
        await check(route + ' @ ' + width + '×' + height, async () => {
          const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
          assert(response.ok(), 'Siden skal svare med HTTP 200');
          await page.waitForFunction(() => document.querySelector('.has-mobile-menu'));
          await page.evaluate(() => document.fonts.ready);
          const button = page.locator('#mobile-menu-toggle');
          const menu = page.locator('#mobile-menu');
          assert.equal(await menu.evaluate(n => n.hidden), true);
          assert.equal(await button.getAttribute('aria-expanded'), 'false');
          assert.equal(await button.getAttribute('aria-controls'), 'mobile-menu');
          assert.equal(await menu.getAttribute('aria-label'), 'Mobilmenu');

          if (width >= 700) {
            assert.equal(await button.isVisible(), false);
            assert.equal(await page.locator('.desktop-nav').isVisible(), width >= 1100);
            assert.equal(await page.locator('.about-link').isVisible(), true);
            assert.equal(await page.locator('.header-search').isVisible(), width >= 1100);
            assert.equal(await page.locator('.bottom-nav').isVisible(), width < 1100);
            return;
          }

          assert(await button.isVisible(), 'Synlig menuknap');
          assert.equal(await page.locator('.about-link').isVisible(), false);
          assert.equal(await page.locator('.desktop-nav').isVisible(), false);
          assert(await page.locator('.bottom-nav').isVisible(), 'Bundnavigation er bevaret');
          assert.equal(await page.locator('.bottom-nav a').count(), 5);
          const logo = await page.locator('.site-header>.logo').boundingBox();
          const control = await button.boundingBox();
          assert(control.width >= 48 && control.height >= 48, 'Touch-mål på mindst 48 px');
          assert(logo.x + logo.width <= control.x, 'Logo og menuknap skal være adskilt');
          assert(control.x + control.width <= width, 'Knap inden for skærmen');

          const mainTop = (await page.locator('main').boundingBox()).y;
          await button.click();
          assert.equal(await button.getAttribute('aria-expanded'), 'true');
          assert.equal(await button.getAttribute('aria-label'), 'Luk menu');
          assert(await menu.isVisible());
          assert.equal((await page.locator('main').boundingBox()).y, mainTop, 'Dropdown må ikke flytte indholdet');
          assert.deepEqual(await menu.locator('a').evaluateAll(nodes => nodes.map(n => [
            n.textContent.trim(), n.getAttribute('href')
          ])), links);

          const expected = route.startsWith('singleproduct') ? 'productlist.html' : route;
          const current = menu.locator('[aria-current]');
          assert.equal(await current.count(), 1, 'Én fremhævet indgang');
          assert.equal(await current.getAttribute('href'), expected);
          assert.equal(await current.getAttribute('aria-current'),
            route.startsWith('singleproduct') ? 'location' : 'page');
          const geometry = await page.evaluate(() => {
            const menu = document.getElementById('mobile-menu');
            const rect = menu.getBoundingClientRect();
            const header = document.querySelector('.site-header').getBoundingClientRect();
            const bottom = document.querySelector('.bottom-nav').getBoundingClientRect();
            return {
              left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
              headerBottom: header.bottom, navTop: bottom.top,
              overflow: document.documentElement.scrollWidth > innerWidth,
              touchHeights: [...menu.querySelectorAll('a')].map(n => n.getBoundingClientRect().height)
            };
          });
          assert(!geometry.overflow, 'Ingen vandret scrolling');
          assert(geometry.left >= 0 && geometry.right <= width, 'Menu inden for skærmen');
          assert(geometry.top >= geometry.headerBottom, 'Menu under headeren');
          assert(geometry.bottom <= geometry.navTop, 'Menu fri af bundnavigation');
          assert(geometry.touchHeights.every(h => h >= 48));

          if ([320, 390].includes(width) && height > 500) {
            if (route === 'index.html') {
              await page.waitForFunction(() => document.querySelector('#hero-image').src.includes('dummyjson'));
              await page.locator('#hero-image').evaluate(n => n.decode());
            }
            const name = route.split('.')[0];
            await page.screenshot({ path: path.join(output, name + '-' + width + '-open.png') });
            await button.click();
            await page.screenshot({ path: path.join(output, name + '-' + width + '-closed.png') });
          } else {
            await button.click();
          }
          assert.equal(await menu.evaluate(n => n.hidden), true, 'Knappen lukker menuen');

          // Native knapbetjening: Enter og Space, efterfulgt af almindelig Tab-rækkefølge.
          await button.focus();
          await page.keyboard.press('Enter');
          assert(await menu.isVisible());
          await page.keyboard.press('Space');
          assert.equal(await menu.evaluate(n => n.hidden), true);
          await page.keyboard.press('Space');
          await page.keyboard.press('Tab');
          assert.equal(await menu.locator('a').first().evaluate(n => n === document.activeElement), true);
          const focusStyle = await menu.locator('a').first().evaluate(n => getComputedStyle(n).outlineWidth);
          assert.equal(focusStyle, '3px', 'Synlig tastaturfokus');
          await page.keyboard.press('Shift+Tab');
          assert.equal(await button.evaluate(n => n === document.activeElement), true);
          for (let i = 0; i < 6; i++) {
            await page.keyboard.press('Tab');
            assert.equal(await menu.locator('a').nth(i).evaluate(n => n === document.activeElement), true);
          }
          await page.keyboard.press('Tab');
          assert.equal(await menu.evaluate(n => n.hidden), true, 'Tab ud lukker uden fokusfælde');

          await button.click();
          await page.keyboard.press('Tab');
          await page.keyboard.press('Escape');
          assert.equal(await menu.evaluate(n => n.hidden), true);
          assert.equal(await button.evaluate(n => n === document.activeElement), true, 'Escape giver fokus tilbage');
          await button.click();
          await page.keyboard.press('Tab');
          await page.mouse.click(4, geometry.top + 4);
          assert.equal(await menu.evaluate(n => n.hidden), true, 'Klik udenfor lukker');
          assert.equal(await menu.evaluate(n => n.contains(document.activeElement)), false, 'Skjult link beholder ikke fokus');
          await page.keyboard.press('Tab');
          assert.equal(await menu.evaluate(n => n.contains(document.activeElement)), false, 'Lukkede links springes over');
        });
      }
      await context.close();
    }

    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, hasTouch: true
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await check('Alle seks dropdown-links og alle fem bundlinks kan bruges med touch', async () => {
      for (const [label, href] of links) {
        await page.goto(base);
        await page.tap('#mobile-menu-toggle');
        await page.locator('#mobile-menu a').filter({ hasText: label }).tap();
        await page.waitForURL(base + href);
        assert.equal(await page.locator('#mobile-menu').evaluate(n => n.hidden), true);
      }
      for (const [, href] of links.slice(0, 5)) {
        await page.goto(base);
        await page.locator('.bottom-nav a[href="' + href + '"]').tap();
        await page.waitForURL(base + href);
      }
    });

    await check('Skift fra mobil til tablet/desktop lukker menuen og bevarer synligt fokus', async () => {
      await page.goto(base);
      await page.locator('#mobile-menu-toggle').click();
      await page.locator('#mobile-menu a').first().focus();
      await page.setViewportSize({ width: 700, height: 800 });
      await page.waitForFunction(() => document.getElementById('mobile-menu').hidden);
      assert.equal(await page.locator('.site-header>.logo').evaluate(n => n === document.activeElement), true);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: path.join(output, 'index-desktop-1440.png') });
      await page.setViewportSize({ width: 390, height: 844 });
      assert.equal(await page.locator('#mobile-menu-toggle').getAttribute('aria-expanded'), 'false');
    });

    await check('Menuen virker også ved netværksfejl i Recipes API', async () => {
      await page.route('https://dummyjson.com/recipes**', route => route.abort('failed'));
      await page.goto(base + 'productlist.html');
      await page.locator('#status[data-state="error"]').waitFor();
      await page.locator('#mobile-menu-toggle').click();
      assert(await page.locator('#mobile-menu').isVisible());
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#mobile-menu').evaluate(n => n.hidden), true);
      await page.unroute('https://dummyjson.com/recipes**');
    });

    await check('Safe areas i portræt og kort landskabsvindue', async () => {
      const cdp = await context.newCDPSession(page);
      for (const [width, height, insets] of [
        [390, 844, { top: 59, bottom: 34, left: 0, right: 0 }],
        [667, 375, { top: 0, bottom: 21, left: 44, right: 44 }]
      ]) {
        await page.setViewportSize({ width, height });
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets });
        await page.goto(base);
        await page.locator('#mobile-menu-toggle').click();
        const state = await page.evaluate(() => {
          const menu = document.getElementById('mobile-menu').getBoundingClientRect();
          const button = document.getElementById('mobile-menu-toggle').getBoundingClientRect();
          const bottom = document.querySelector('.bottom-nav').getBoundingClientRect();
          return { menu: { left: menu.left, right: menu.right, bottom: menu.bottom },
            button: { top: button.top, right: button.right }, bottomTop: bottom.top,
            overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert(state.button.top >= insets.top);
        assert(state.button.right <= width - insets.right);
        assert(state.menu.left >= insets.left && state.menu.right <= width - insets.right);
        assert(state.menu.bottom <= state.bottomTop && !state.overflow);
        await page.locator('#mobile-menu a').last().scrollIntoViewIfNeeded();
        await page.locator('#mobile-menu a').last().tap();
        await page.waitForURL(base + 'om-os.html');
      }
      await cdp.send('Emulation.setSafeAreaInsetsOverride', {
        insets: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      await cdp.detach();
    });
    await context.close();

    const noScript = await browser.newContext({
      javaScriptEnabled: false, viewport: { width: 390, height: 844 }
    });
    await check('Uden JavaScript bevares bundnavigation og Om os uden en død menuknap', async () => {
      const tab = await noScript.newPage();
      await tab.goto(base);
      assert.equal(await tab.locator('#mobile-menu-toggle').isVisible(), false);
      assert(await tab.locator('.about-link').isVisible());
      assert(await tab.locator('.bottom-nav').isVisible());
    });
    await noScript.close();
    await check('Ingen ukontrollerede JavaScript-fejl', async () => assert.deepEqual(errors, []));
  } finally {
    const passed = results.filter(r => r.status === 'PASS').length;
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({
      base, browser: browser.version(), results, errors
    }, null, 2));
    console.log('MOBILE_MENU_TESTS: ' + passed + '/' + results.length);
    await browser.close();
    if (passed !== results.length) process.exitCode = 1;
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

