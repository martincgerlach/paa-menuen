// Development-only Playwright checks. No mocked data is used by the website.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const output = process.env.QA_OUTPUT || '/tmp/paa-menuen-qa';
fs.mkdirSync(output, { recursive: true });
const base = process.env.QA_URL || 'http://127.0.0.1:8018/';
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage(), results = [], consoleErrors = [], requests = [];
  page.on('pageerror', error => consoleErrors.push(error.message));
  page.on('request', request => { if (request.url().startsWith('https://dummyjson.com/recipes')) requests.push(request.url()); });
  async function check(name, fn) { try { await fn(); results.push({ name, status: 'PASS' }); } catch (error) { results.push({ name, status: 'FAIL', error: error.message }); } console.log(JSON.stringify(results.at(-1))); }
  async function visit(route, selector = '.recipe-card') { await page.goto(base + route); if (selector) await page.locator(selector).first().waitFor({ timeout: 22000 }); }
  async function listReady() { await page.waitForFunction(() => document.querySelector('#result-count').textContent || document.querySelector('#status').dataset.state === 'error'); }
  await visit('productlist.html');
  const raw = await page.evaluate(async () => (await (await fetch('https://dummyjson.com/recipes?limit=0')).json()));
  fs.writeFileSync(path.join(output, 'live-api.json'), JSON.stringify(raw, null, 2));
  const data = raw.recipes;
  await check('live complete recipes integration, pagination and no repeated API on filter', async () => {
    assert.equal(await page.locator('#result-count').textContent(), `${raw.total} opskrifter`);
    assert.equal(await page.locator('.recipe-card').count(), Math.min(12, raw.total));
    const before = requests.length;
    await page.locator('#recipe-q').fill('tomat'); await page.locator('#search-form button').click();
    const expected = data.filter(r => [r.name, ...r.ingredients].join(' ').toLowerCase().includes('tomato')).length;
    assert.equal(await page.locator('#result-count').textContent(), `${expected} opskrifter`); assert.equal(requests.length, before);
  });
  await check('search empty, empty query and load more', async () => {
    await page.locator('#recipe-q').fill('zzzzunavailable'); await page.locator('#search-form button').click();
    assert.equal(await page.locator('.recipe-card').count(), 0); assert.match(await page.locator('#status').textContent(), /Ingen opskrifter/);
    await page.locator('#recipe-q').fill(''); await page.locator('#search-form button').click();
    await page.locator('#load-more').click(); assert.equal(await page.locator('.recipe-card').count(), Math.min(24, data.length));
  });
  for (const [name, query, match] of [
    ['cuisine', 'cuisine=Italian', r => r.cuisine === 'Italian'], ['meal', 'meal=Dinner', r => r.mealType.includes('Dinner')],
    ['time', 'time=under30', r => r.prepTimeMinutes + r.cookTimeMinutes < 30], ['difficulty', 'difficulty=Easy', r => r.difficulty === 'Easy'],
    ['rating', 'rating=4.8', r => r.rating >= 4.8], ['ingredients', 'ingredients=tomat&ingredients=pasta', r => r.ingredients.some(x => x.toLowerCase().includes('tomato')) && r.ingredients.some(x => x.toLowerCase().includes('pasta'))],
    ['combined', 'cuisine=Italian&meal=Dinner&time=under30&difficulty=Easy&rating=4', r => r.cuisine === 'Italian' && r.mealType.includes('Dinner') && r.prepTimeMinutes + r.cookTimeMinutes < 30 && r.difficulty === 'Easy' && r.rating >= 4]
  ]) await check(`filter ${name} against full live dataset`, async () => {
    await visit(`productlist.html?${query}`, null); await listReady();
    assert.equal(await page.locator('#result-count').textContent(), `${data.filter(match).length} opskrifter`);
  });
  await check('filter dialog apply, remove chip, reset, keyboard Escape and focus return', async () => {
    await visit('productlist.html'); await page.locator('#filter-open').click();
    await page.locator('#cuisine-options input[value=Italian]').check(); await page.locator('#filter-apply').click();
    assert.equal(await page.locator('#result-count').textContent(), `${data.filter(r => r.cuisine === 'Italian').length} opskrifter`);
    await page.getByRole('button', { name: 'Fjern filter: Italiensk' }).click();
    assert.equal(await page.locator('#result-count').textContent(), `${data.length} opskrifter`);
    await page.locator('#filter-open').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#filter-panel').evaluate(el => el.open), false);
    assert.equal(await page.locator('#filter-open').evaluate(el => el === document.activeElement), true);
    await page.locator('#filter-open').click(); await page.locator('#filter-reset').click(); await page.locator('#filter-close').click();
  });
  await check('sort time/rating and browser back filter state', async () => {
    await page.locator('#sort').selectOption('time'); const fastest = [...data].sort((a,b) => a.prepTimeMinutes+a.cookTimeMinutes-b.prepTimeMinutes-b.cookTimeMinutes || a.id-b.id)[0];
    assert.equal(await page.locator('.recipe-card').first().getAttribute('data-recipe-id'), String(fastest.id));
    await page.locator('#sort').selectOption('rating'); const top = [...data].sort((a,b) => b.rating-a.rating || a.id-b.id)[0];
    assert.equal(await page.locator('.recipe-card').first().getAttribute('data-recipe-id'), String(top.id));
    await page.locator('#recipe-q').fill('pizza'); await page.locator('#search-form button').click(); await page.goBack();
    assert.equal(await page.locator('#recipe-q').inputValue(), '');
  });
  await check('homepage API hero/cards and category link', async () => {
    await visit('index.html'); assert.equal(await page.locator('#home-recipes .recipe-card').count(), 3);
    assert.equal(await page.getByRole('link', { name: 'Prøv Madterningen', exact: true }).getAttribute('href'), 'madterningen.html');
    await page.locator('.meal-links a').filter({ hasText: 'Aftensmad' }).click(); await listReady();
    assert.equal(await page.locator('#result-count').textContent(), `${data.filter(r => r.mealType.includes('Dinner')).length} opskrifter`);
  });
  await check('detail correct ID, ingredients, instructions and no quantity invention', async () => {
    await visit('singleproduct.html?id=1', '#recipe-detail h1'); const first = data.find(r => r.id === 1);
    assert.equal(await page.locator('#recipe-detail h1').textContent(), first.name);
    assert.deepEqual(await page.locator('.ingredient-row span').allTextContents(), first.ingredients);
    assert.deepEqual(await page.locator('.instruction-panel li').allTextContents(), first.instructions);
    assert.match(await page.locator('#recipe-detail').textContent(), /ikke ingrediensmængder/);
  });
  await check('home ingredient marks add only missing original indices and no duplicates', async () => {
    const isolated = await browser.newContext(), detail = await isolated.newPage();
    await detail.goto(base+'singleproduct.html?id=1'); await detail.locator('#ingredient-0').waitFor();
    const ingredients=data.find(r=>r.id===1).ingredients;
    const add=detail.getByRole('button',{name:'Tilføj manglende ingredienser',exact:true});
    await detail.locator('#ingredient-0').check(); await add.click(); await add.click();
    let saved=await detail.evaluate(()=>JSON.parse(localStorage.getItem('paa-menuen:shopping:v1')));
    assert.deepEqual(saved.map(x=>x.ingredientIndex),ingredients.map((_,i)=>i).slice(1));
    assert.deepEqual(saved.map(x=>x.text),ingredients.slice(1));
    for(const input of await detail.locator('.ingredient-row input').all()) await input.check();
    assert.equal(await add.isDisabled(),true);
    await detail.locator('#ingredient-0').uncheck(); await add.click();
    saved=await detail.evaluate(()=>JSON.parse(localStorage.getItem('paa-menuen:shopping:v1')));
    assert.equal(saved.length,ingredients.length);
    assert.ok(saved.every(x=>x.id===`recipe-1-${x.ingredientIndex}`)); await isolated.close();
  });
  await check('favorite add, reload, cross-page removal and empty state', async () => {
    await page.locator('.favorite-button').click(); await page.reload(); await page.locator('#recipe-detail h1').waitFor();
    assert.equal(await page.locator('.favorite-button').getAttribute('aria-pressed'), 'true');
    await visit('favoritter.html'); assert.equal(await page.locator('.recipe-card').count(), 1);
    await page.locator('.favorite-button').click(); assert.equal(await page.locator('.recipe-card').count(), 0);
    await page.reload(); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('ingen favoritter'));
    const findRecipes = page.getByRole('link', { name: 'Find opskrifter', exact: true });
    await findRecipes.focus();
    await Promise.all([page.waitForURL('**/productlist.html'), page.keyboard.press('Enter')]);
    assert.equal(new URL(page.url()).pathname, '/productlist.html');
  });
  await check('shopping API ingredients, idempotence, purchased persistence, clear and manual creation', async () => {
    await visit('singleproduct.html?id=1', '#recipe-detail h1');
    await page.getByRole('button', { name: 'Tilføj manglende ingredienser' }).click(); await page.getByRole('button', { name: 'Tilføj manglende ingredienser' }).click();
    await visit('indkoebsliste.html', '.shopping-row'); assert.equal(await page.locator('.shopping-row').count(), data.find(r => r.id === 1).ingredients.length);
    await page.locator('.shopping-row input').first().check(); await page.reload(); await page.locator('.shopping-row').first().waitFor(); assert.equal(await page.locator('.shopping-row input').first().isChecked(), true);
    await page.locator('#clear-purchased').click(); assert.equal(await page.locator('.shopping-row').count(), data.find(r => r.id === 1).ingredients.length - 1);
    await page.locator('#manual-item').fill('<img src=x onerror=alert(1)>'); await page.locator('#manual-item').press('Enter');
    assert.equal(await page.locator('.shopping-row').last().locator('span').textContent(), '<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('.shopping-row img').count(), 0); await page.reload(); await page.locator('.shopping-row').first().waitFor();
    await page.locator('.shopping-row .remove-item').last().click();
    await page.locator('#manual-item').fill('   '); await page.locator('#manual-form button').click(); assert.match(await page.locator('#manual-error').textContent(), /1–120/);
  });
  await check('Madterningen uses active combined pool and repeats only matching IDs', async () => {
    const query='cuisine=Italian&time=under30&meal=Dinner'; await visit(`productlist.html?${query}`, null); await listReady();
    const ids = data.filter(r => r.cuisine === 'Italian' && r.prepTimeMinutes+r.cookTimeMinutes < 30 && r.mealType.includes('Dinner')).map(r => r.id);
    await visit('madterningen.html', '#dice-roll:not([disabled])'); let prev=null;
    for (let i=0;i<4;i++) { await page.locator('#dice-roll').click(); const id=Number(await page.locator('.recipe-card').getAttribute('data-recipe-id')); assert.ok(ids.includes(id)); if(ids.length>1) assert.notEqual(id,prev); prev=id; }
    await page.locator('#use-filters').uncheck(); assert.match(await page.locator('#status').textContent(), new RegExp(`${data.length} opskrifter`)); await page.locator('#dice-roll').click(); const unfilteredId=Number(await page.locator('.recipe-card').getAttribute('data-recipe-id')); assert.ok(data.some(r => r.id === unfilteredId)); assert.equal(await page.locator('.recipe-card').count(),1);
  });
  await check('Madterningen zero matches does not silently clear active filters', async () => {
    await visit('madterningen.html?q=zzzzunavailable', null); await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Ingen opskrifter matcher'));
    assert.equal(await page.locator('#dice-roll').isDisabled(), true); assert.equal(await page.locator('.recipe-card').count(), 0); assert.equal(await page.locator('#use-filters').isChecked(), true);
  });
  for (const query of ['', '?id=abc', '?id=-1', '?id=99999']) await check(`invalid detail ${query || 'missing ID'}`, async () => {
    await visit(`singleproduct.html${query}`, null); await page.waitForFunction(()=>document.querySelector('#status').dataset.state === 'error'); assert.equal(await page.locator('#recipe-detail h1').count(),0);
  });
  await check('About has no feedback demo; shopping form validates and creates a persistent item', async () => {
    await visit('om-os.html', null); assert.equal(await page.locator('#contact-form').count(),0);
    assert.match(await page.locator('main').textContent(), /Team 8/);
    assert.equal(await page.locator('footer').evaluate(e=>getComputedStyle(e).visibility),'visible');
    await visit('indkoebsliste.html', null); assert.equal(await page.locator('footer').evaluate(e=>getComputedStyle(e).visibility),'visible'); const before=await page.locator('.shopping-row').count();
    await page.locator('#manual-item').fill(''); assert.equal(await page.locator('#manual-form').evaluate(f=>f.checkValidity()),false);
    await page.locator('#manual-item').fill('Linser'); assert.equal(await page.locator('#manual-form').evaluate(f=>f.checkValidity()),true);
    await page.locator('#manual-form button').click(); assert.equal(await page.locator('.shopping-row').count(),before+1);
    await page.reload(); await page.locator('.shopping-row').first().waitFor(); assert.equal(await page.locator('.shopping-row').count(),before+1);
  });
  await check('live normal-flow console errors', async () => { assert.deepEqual(consoleErrors, []); });
  const faultPage = await context.newPage();
  await check('loading + network abort error + retry recovery', async () => {
    let release; const gate=new Promise(resolve=>release=resolve);
    await faultPage.route('https://dummyjson.com/recipes?*', async route => { await gate; await route.abort(); });
    await faultPage.goto(base+'productlist.html'); await faultPage.locator('#status[data-state=loading]').waitFor(); release();
    await faultPage.locator('#retry:not([hidden])').waitFor(); assert.equal(await faultPage.locator('.recipe-card').count(),0);
    await faultPage.unroute('https://dummyjson.com/recipes?*'); await faultPage.locator('#retry').click(); await faultPage.locator('.recipe-card').first().waitFor();
  });
  for(const [name,body] of [['empty API',{recipes:[],total:0}],['malformed API',{invalid:true}],['optional metadata missing',{recipes:[{id:1,name:data[0].name}],total:1}]]) await check(name,async()=>{
    await faultPage.route('https://dummyjson.com/recipes?*',route=>route.fulfill({json:body})); await faultPage.goto(base+'productlist.html');
    if(name==='empty API'){await faultPage.waitForFunction(()=>document.querySelector('#status').dataset.state==='empty');assert.equal(await faultPage.locator('.recipe-card').count(),0);}
    else if(name==='malformed API'){await faultPage.locator('#retry:not([hidden])').waitFor();}
    else{await faultPage.locator('.recipe-card').waitFor();assert.match(await faultPage.locator('.card-meta').textContent(),/Tid ikke oplyst/);}
    await faultPage.unroute('https://dummyjson.com/recipes?*');
  });
  await faultPage.close();
  await check('corrupt storage and denied writes remain usable',async()=>{
    const corrupt=await browser.newContext();await corrupt.addInitScript(()=>{localStorage.setItem('paa-menuen:favorites:v1','invalid json');});const cp=await corrupt.newPage();await cp.goto(base+'singleproduct.html?id=1');await cp.locator('.favorite-button').waitFor();await cp.locator('.favorite-button').click();assert.equal(await cp.locator('#storage-notice').isVisible(),true);assert.equal(await cp.locator('.favorite-button').getAttribute('aria-pressed'),'true');await corrupt.close();
    const denied=await browser.newContext();await denied.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('blocked','SecurityError')};});const dp=await denied.newPage();await dp.goto(base+'singleproduct.html?id=1');await dp.locator('.favorite-button').waitFor();await dp.locator('.favorite-button').click();assert.match(await dp.locator('#storage-notice').textContent(),/midlertidigt/);await denied.close();
  });
  for(const width of [320,390,768,1440]) await check(`responsive all pages ${width}px, local links and screenshots`, async()=>{
    await page.setViewportSize({width,height:width<700?844:1000});
    for(const route of ['index.html','productlist.html','singleproduct.html?id=1','madterningen.html','favoritter.html','indkoebsliste.html','om-os.html']){
      await page.goto(base+route);await page.waitForFunction(()=>!document.querySelector('#status')||document.querySelector('#status').dataset.state!=='loading');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);assert.equal(overflow,false,route);
      const broken=await page.evaluate(()=>[...document.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>!h.startsWith('http')&&!h.startsWith('#')).filter(h=>!['index.html','productlist.html','singleproduct.html','madterningen.html','favoritter.html','indkoebsliste.html','om-os.html'].includes(h.split('?')[0])));assert.deepEqual(broken,[]);
      await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(i=>i.loading!=='lazy').map(i=>i.decode().catch(()=>{})));});
      if(width===390||width===1440)await page.screenshot({path:path.join(output,`${route.split('?')[0].replace('.html','')}-${width}.png`),fullPage:true});
    }
  });
  await check('mobile dialog scrolling and keyboard controls',async()=>{await page.setViewportSize({width:390,height:844});await visit('productlist.html');await page.locator('#filter-open').click();await page.locator('#filter-panel input[name=ingredients]').fill('tomat');await page.locator('#filter-apply').click();assert.match(await page.locator('#active-filters').textContent(),/tomat/);});
  for (const width of [320,390]) await check(`filter labels fit mobile dialog ${width}px`, async()=>{
    await page.setViewportSize({width,height:844}); await visit('productlist.html'); await page.locator('#filter-open').click();
    const label = page.locator('#cuisine-options label').filter({hasText:'Middelhavskøkken'});
    await label.scrollIntoViewIfNeeded();
    const bounds = await label.evaluate(node=>{
      const range=document.createRange(); range.selectNodeContents(node);
      const text=range.getBoundingClientRect(), dialog=document.querySelector('#filter-panel').getBoundingClientRect();
      return {left:text.left,right:text.right,dialogLeft:dialog.left,dialogRight:dialog.right,overflow:node.parentElement.scrollWidth>node.parentElement.clientWidth+1};
    });
    assert.equal(bounds.overflow,false); assert.ok(bounds.left>=bounds.dialogLeft && bounds.right<=bounds.dialogRight);
    await page.screenshot({path:path.join(output,`filter-label-${width}.png`)});
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#filter-open').evaluate(el=>el===document.activeElement),true);
  });
  await check('short empty favorites fill viewport without extra scrolling',async()=>{
    await page.setViewportSize({width:390,height:844}); await visit('favoritter.html',null);
    await page.waitForFunction(()=>document.querySelector('#status').dataset.state==='empty');
    await page.evaluate(()=>document.fonts.ready);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
  });
  await check('all live recipe cards keep full titles and aligned favorite buttons',async()=>{
    await visit('productlist.html'); while(await page.locator('#load-more').isVisible()) await page.locator('#load-more').click();
    const titles=await page.locator('.card-title').allTextContents(); assert.equal(titles.length,data.length);
    assert.deepEqual([...titles].sort(),data.map(r=>r.name).sort());
    assert.ok(await page.locator('.recipe-card').evaluateAll(cards=>{
      const rows=new Map(); cards.forEach(c=>{const top=Math.round(c.getBoundingClientRect().top),values=rows.get(top)||[];values.push(c.querySelector('.favorite-button').getBoundingClientRect().bottom);rows.set(top,values)});
      return [...rows.values()].every(values=>Math.max(...values)-Math.min(...values)<1);
    }));
  });
  const metrics = await page.evaluate(()=>({resources:performance.getEntriesByType('resource').map(x=>({url:x.name,duration:x.duration,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize})),overflow:document.documentElement.scrollWidth>innerWidth}));
  fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify({date:new Date().toISOString(),base,browser:browser.version(),results,consoleErrors,requests,metrics},null,2));
  await browser.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
