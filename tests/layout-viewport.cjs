// Development-only viewport QA for På Menuen. Run from an HTTP-served checkout.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = (process.env.QA_URL || 'http://127.0.0.1:8018/').replace(/\/?$/, '/');
const output = process.env.QA_OUTPUT || '/tmp/paa-menuen-layout-qa';
const sizes = [[320,740],[390,844],[768,1024],[1024,768],[1100,800],[1280,800],[1440,900],[1920,1080],[2560,1440],[3440,1440],[3840,2160]];
const screenshotSizes = new Set([390,1024,1440,1920,2560,3440,3840]);
const routes = [
  ['index.html','.site-header'],
  ['productlist.html','#recipe-grid .recipe-card'],
  ['singleproduct.html?id=1','.detail-summary'],
  ['madterningen.html','#dice-roll:not([disabled])'],
  ['favoritter.html','.site-header'],
  ['indkoebsliste.html','.site-header'],
  ['om-os.html','.site-header']
];
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const launch={headless:true};
  if(process.env.CHROME_BIN) launch.executablePath=process.env.CHROME_BIN;
  else if(process.platform==='darwin') launch.executablePath='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const browser=await chromium.launch(launch);
  const results=[];
  try {
    for(const [width,height] of sizes){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
      const page=await context.newPage();
      const jsErrors=[];
      page.on('pageerror',error=>jsErrors.push(error.message));
      for(const [route,ready] of routes){
        const name=route.split(/[?.]/)[0];
        const label=name+' @ '+width+'x'+height;
        try{
          const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
          assert(response?.ok(),'HTTP status: '+response?.status());
          await page.locator(ready).first().waitFor({timeout:30000});
          await page.evaluate(()=>document.fonts.ready);
          const geometry=await page.evaluate(()=>{
            const rect=el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
            const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
            const top=['.site-header>.logo','.desktop-nav','.site-header>.about-link','.site-header>.header-search'].map(q=>document.querySelector(q)).filter(e=>e&&e.getClientRects().length);
            const nav=[...document.querySelectorAll('.desktop-nav a')].filter(e=>e.getClientRects().length);
            const crosses=els=>els.some((a,i)=>els.slice(i+1).some(b=>overlaps(rect(a),rect(b))));
            const img=document.querySelector('.detail-image'),card=document.querySelector('.detail-summary');
            const main=document.querySelector('.page-content');
            return {
              viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
              main:main?rect(main):null,
              headerOverlap:crosses(top),navOverlap:crosses(nav),
              detailOverlap:img&&card?overlaps(rect(img),rect(card)):null,
              detailGap:img&&card?rect(card).left-rect(img).right:null
            };
          });
          assert(geometry.scrollWidth<=width+1,'Horizontal overflow '+geometry.scrollWidth+'px');
          assert(!geometry.headerOverlap,'Header elements overlap');
          assert(!geometry.navOverlap,'Desktop navigation links overlap');
          if(name==='singleproduct'){
            assert.equal(geometry.detailOverlap,false,'Photo overlaps recipe card');
            if(width>=700)assert(geometry.detailGap>=-1,'Negative detail gap '+geometry.detailGap);
          }
          if(name==='madterningen'){
            await page.locator('#dice-filter-options').evaluate(e=>e.open=true);
            const filterOverlap=await page.evaluate(()=>{
              const overlaps=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
              return [...document.querySelectorAll('.dice-primary-filters>div')].some(row=>overlaps(row.querySelector('label').getBoundingClientRect(),row.querySelector('select').getBoundingClientRect()));
            });
            assert(!filterOverlap,'Filter labels overlap selects');
            if(screenshotSizes.has(width))await page.screenshot({path:path.join(output,'madterningen-filters-'+width+'.png'),fullPage:true,animations:'disabled'});
            await page.locator('#dice-roll').click();
            await page.locator('.dice-result .recipe-card').waitFor({timeout:5000});
            // Vent på selve API-fotografiet, så billedet ikke fremstår tomt i screenshots.
            await page.waitForFunction(() => {
              const img = document.querySelector('.dice-result .recipe-card img');
              return Boolean(img && img.complete);
            }, null, {timeout:20000});
            const imageState = await page.locator('.dice-result .recipe-card img').evaluate(img => ({
              width:img.naturalWidth,
              hidden:img.hidden,
              src:img.currentSrc
            }));
            assert(imageState.width>0 && !imageState.hidden, 'Opskriftsbillede blev ikke indlæst: '+imageState.src);
            if(screenshotSizes.has(width))await page.screenshot({path:path.join(output,'madterningen-result-'+width+'.png'),fullPage:true,animations:'disabled'});
          } else if(screenshotSizes.has(width)){
            await page.screenshot({path:path.join(output,name+'-'+width+'.png'),fullPage:true,animations:'disabled'});
          }
          results.push({label,status:'PASS',geometry});
          console.log('PASS',label);
        }catch(error){
          results.push({label,status:'FAIL',error:error.message});
          console.error('FAIL',label,error.message);
        }
      }
      if(jsErrors.length)results.push({label:'JavaScript errors @ '+width,status:'FAIL',error:jsErrors.join(' | ')});
      await context.close();
    }
  }finally{
    fs.writeFileSync(path.join(output,'layout-results.json'),JSON.stringify({base,date:new Date().toISOString(),browser:browser.version(),sizes,results},null,2));
    await browser.close();
  }
  if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
