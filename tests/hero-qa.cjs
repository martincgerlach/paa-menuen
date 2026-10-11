// Development-only test of the refreshed homepage hero and original API semantics.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs = require('node:fs'), path = require('node:path');
const assert = require('node:assert/strict');
const base = (process.env.QA_URL || 'http://127.0.0.1:8018/').replace(/\/?$/, '/');
const output = process.env.QA_OUTPUT || '/tmp/paa-menuen-hero-qa';
const sizes = [[320,740],[390,844],[768,1024],[1024,768],[1100,800],[1280,800],[1440,900],[1920,1080],[2560,1440],[3840,2160]];
fs.mkdirSync(output,{recursive:true});
(async () => {
  const browser=await chromium.launch({headless:true});
  const checks=[];
  try{
    for (const [width,height] of sizes){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
      const page=await context.newPage();const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const check=async(label,fn)=>{
        try{await fn();checks.push({label,status:'PASS'});console.log('PASS '+label);}
        catch(e){checks.push({label,status:'FAIL',error:e.message});console.error('FAIL '+label+' '+e.message);}
      };
      const prefix=width+'x'+height;
      await page.goto(base+'index.html',{waitUntil:'domcontentloaded'});
      await check(prefix+' image/metadata/link',async()=>{
        await page.locator('#hero-recipe-link:visible').waitFor({timeout:20000});
        await page.waitForFunction(()=>{
          const img=document.querySelector('#hero-image');
          return img&&img.complete&&img.naturalWidth>0&&img.currentSrc.includes('dummyjson.com');
        },null,{timeout:25000});
        const link=page.locator('#hero-recipe-link');
        const href=await link.getAttribute('href');
        assert.match(href,/^singleproduct\.html\?id=\d+$/);
        const id=Number(href.split('=')[1]);const api=await page.evaluate(async id=>(await (await fetch('https://dummyjson.com/recipes/'+id)).json()),id);
        assert.equal(await link.textContent(),api.name);
        assert.equal(await page.locator('#hero-image').getAttribute('src'),api.image);
      });
      await check(prefix+' responsive layout',async()=>{
        const result=await page.evaluate(()=>{
          const rect=(s)=>{const r=document.querySelector(s).getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width}};
          const a=rect('.hero-copy'),b=rect('.hero-image-wrap'),search=rect('.hero-search-field'),button=rect('.hero-search-button');
          return{scroll:document.documentElement.scrollWidth,inner:innerWidth,copy:a,image:b,search,button};
        });
        assert(result.scroll<=result.inner+1,'Horizontal overflow '+result.scroll);
        if(width>=1000) assert(result.copy.right<=result.image.left+1,'Hero copy overlaps photo on desktop');
        else assert(result.copy.bottom<=result.image.top+1,'Hero copy overlaps photo on tablet/mobile');
        const intersects=result.search.left<result.button.right&&result.search.right>result.button.left&&result.search.top<result.button.bottom&&result.search.bottom>result.button.top;
        assert(!intersects,'Search field overlaps CTA');
      });
      await check(prefix+' quick filters',async()=>{
        const links=await page.locator('.hero-quick-links a').evaluateAll(els=>els.map(a=>({name:a.textContent.trim(),href:a.getAttribute('href')})));
        assert.deepEqual(links,[
          {name:'Under 30 min',href:'productlist.html?time=under30'},
          {name:'Aftensmad',href:'productlist.html?meal=Dinner'},
          {name:'Pasta',href:'productlist.html?q=pasta'}
        ]);
      });
      if([390,768,1024,1440,2560,3840].includes(width)){
        await page.screenshot({path:path.join(output,'hero-'+width+'.png'),fullPage:true,animations:'disabled'});
      }
      if([390,1440].includes(width)){
        await check(prefix+' search behavior',async()=>{
          await page.locator('#hero-q').fill('pasta');
          await page.locator('.hero-search-button').click();
          await page.waitForURL('**/productlist.html?q=pasta');
          await page.locator('#recipe-grid .recipe-card').first().waitFor({timeout:20000});
          assert.equal(new URL(page.url()).searchParams.get('q'),'pasta');
        });
        await check(prefix+' quick link behavior',async()=>{
          await page.goto(base+'index.html');
          await page.getByRole('link',{name:'Under 30 min'}).first().click();
          await page.waitForURL('**/productlist.html?time=under30');
          await page.locator('#result-count').waitFor({timeout:20000});
        });
      }
      if(errors.length)checks.push({label:prefix+' JS errors',status:'FAIL',error:errors.join(' | ')});
      await context.close();
    }
  }finally{
    fs.writeFileSync(path.join(output,'hero-results.json'),JSON.stringify({date:new Date().toISOString(),checks},null,2));
    await browser.close();
  }
  if(checks.some(x=>x.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});