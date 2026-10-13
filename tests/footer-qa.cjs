const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base=(process.env.QA_URL || 'http://127.0.0.1:8018/').replace(/\/?$/, '/');
const pages=['index.html','productlist.html','singleproduct.html?id=1','madterningen.html','favoritter.html','indkoebsliste.html','om-os.html'];
const viewports=[[320,740],[390,844],[768,1024],[1100,800],[1440,900],[2560,1440],[3840,2160]];
const out='qa-footer';
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  let passed=0;
  try{
    for(const [width,height] of viewports){
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});
      const page=await context.newPage();
      for(const route of pages){
        const label=route+' @ '+width;
        try{
          const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});
          assert(response.ok(),'HTTP error');
          await page.locator('footer.site-footer .footer-brand').waitFor({state:'attached'});
          await page.locator('footer.site-footer').scrollIntoViewIfNeeded();
          await page.evaluate(()=>document.fonts.ready);
          const state=await page.evaluate(()=>{
            const footer=document.querySelector('footer.site-footer');
            const footerRect=footer.getBoundingClientRect();
            const nav=footer.querySelector('.footer-nav');
            const links=[...nav.querySelectorAll('a')];
            const cta=footer.querySelector('.footer-feature-link');
            const credit=footer.querySelector('.footer-credit a');
            const brand=footer.querySelector('.footer-brand');
            const style=getComputedStyle(footer);
            const outside=[...footer.querySelectorAll('a')].filter(a=>{
              const r=a.getBoundingClientRect();
              return r.left < -1 || r.right > innerWidth+1;
            });
            return{
              navCount:links.length,
              allLinks: [...links,cta,credit,brand].map(a=>a?.getAttribute('href')),
              footerWidth:footerRect.width,
              bg:style.backgroundColor,
              documentWidth:document.documentElement.scrollWidth,
              outside:outside.length,
              footerHeight:footerRect.height,
              contentHeight:footer.scrollHeight,
              credit:footer.querySelector('.footer-credit')?.textContent,
              heading:footer.querySelector('h2')?.textContent,
              contrast:getComputedStyle(footer.querySelector('.footer-intro h2')).color
            };
          });
          assert.equal(state.navCount,5,'Navigation must show five real pages');
          for(const href of ['productlist.html','madterningen.html','favoritter.html','indkoebsliste.html','om-os.html','index.html','https://dummyjson.com/docs/recipes']){
            assert(state.allLinks.includes(href),'Broken/missing expected href '+href);
          }
          assert(state.documentWidth<=width+1,'Horizontal scrolling');
          assert.equal(state.outside,0,'Footer links clipped');
          assert(state.footerHeight>=200,'Footer must be visible');
          assert(state.credit.includes('Et studieprojekt'),'Keep truthful credit');
          assert(state.heading.includes('God mad'),'Missing CTA headline');
          assert.equal(state.contrast,'rgb(255, 255, 255)','Heading contrast');
          if(route==='index.html'&&[390,1440,2560].includes(width)){
            await page.screenshot({path:path.join(out,'footer-'+width+'.png'),animations:'disabled'});
          }
          console.log('PASS '+label);
          passed++;
        }catch(e){
          console.error('FAIL '+label+': '+e.message);
        }
      }
      await context.close();
    }
  }finally{await browser.close();}
  console.log('FOOTER CHECKS '+passed+'/'+(viewports.length*pages.length));
  if(passed !== viewports.length*pages.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});