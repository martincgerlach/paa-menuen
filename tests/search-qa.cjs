// Kontroller den samme søgning fra forside, opskriftsliste og Madterningen.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const base = (process.env.QA_URL || 'http://127.0.0.1:8018/').replace(/\/?$/, '/');
(async()=>{
  const browser=await chromium.launch({headless:true});
  let count=0;
  try{
    for(const width of [390,1440]){
      const page=await browser.newPage({viewport:{width,height:900}});
      for(const word of ['kød','æg','hvidløg','tomater','ris']){
        await page.goto(base+'productlist.html?q='+encodeURIComponent(word),{waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>/^\d+ opskrifter/.test(document.querySelector('#result-count')?.textContent||''),null,{timeout:20000});
        const found=await page.locator('#recipe-grid .recipe-card').count();
        assert(found>0,word+' søgning gav 0 opskrifter');
        assert.equal(new URL(page.url()).searchParams.get('q'),word);
        count++;console.log('PASS',word,'opskriftsliste',width,found);
      }
      await page.goto(base+'index.html');
      await page.locator('#hero-q').fill('æg');
      await page.locator('.hero-search-button').click();
      await page.waitForURL('**/productlist.html?q=*');
      assert.equal(new URL(page.url()).searchParams.get('q'),'æg');
      await page.locator('#recipe-grid .recipe-card').first().waitFor({timeout:20000});
      count++;console.log('PASS forsidens æg søgning',width);
      await page.goto(base+'productlist.html?ingredients='+encodeURIComponent('æg'),{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>/^\d+ opskrifter/.test(document.querySelector('#result-count')?.textContent||''),null,{timeout:20000});
      assert((await page.locator('#recipe-grid .recipe-card').count())>0);
      count++;console.log('PASS ingrediensfilteret æg',width);
      await page.goto(base+'madterningen.html?q='+encodeURIComponent('kød'),{waitUntil:'domcontentloaded'});
      await page.locator('#dice-roll:not([disabled])').waitFor({timeout:20000});
      const t=await page.locator('#match-count').textContent();
      assert.match(t,/^\d+ opskrifter? matcher/);
      count++;console.log('PASS Madterningen med kød',width,t);
      await page.close();
    }
  }finally{await browser.close()}
  console.log('SOEGE_UI_KONTROLLER:',count);
})().catch(e=>{console.error(e);process.exitCode=1});
