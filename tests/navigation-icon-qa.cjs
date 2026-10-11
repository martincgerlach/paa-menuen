// Kontroller terningeikonet i navigationen på alle 7 sider.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const root=(process.env.QA_URL || 'http://127.0.0.1:8018/').replace(/\/?$/, '/');
const output=process.env.QA_OUTPUT || 'qa-navigation';
const pages=['index.html','productlist.html','singleproduct.html?id=1','madterningen.html','favoritter.html','indkoebsliste.html','om-os.html'];
const viewports=[[320,740],[390,844],[768,1024],[1024,768],[1100,800],[1280,800],[1440,900],[1920,1080],[2560,1440],[3840,2160]];
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true});
  let passed=0;
  const results=[];
  try {
    for(const [width,height] of viewports){
      const context=await browser.newContext({viewport:{width,height}});
      const tab=await context.newPage();
      for(const route of pages){
        const name=route.split(/[?.]/)[0];
        const label=name+' '+width+'x'+height;
        try {
          const response=await tab.goto(root+route,{waitUntil:'domcontentloaded',timeout:30000});
          assert(response?.ok(),'HTTP not OK');
          await tab.evaluate(()=>document.fonts.ready);
          await tab.locator('.desktop-nav img.nav-dice-icon').waitFor({state:'attached'});
          const state=await tab.evaluate(()=>{
            const icons=[...document.querySelectorAll('nav a[href="madterningen.html"] img.nav-dice-icon')];
            const shown=el=>el.getClientRects().length>0&&getComputedStyle(el).display!=='none';
            const navDesktop=document.querySelector('.desktop-nav');
            const navMobile=document.querySelector('.bottom-nav');
            const icon=icons.find(shown);
            const navRect=icon?.getBoundingClientRect();
            return {
              iconCount:icons.length,
              visibleCount:icons.filter(shown).length,
              desktopVisible:shown(navDesktop),
              mobileVisible:shown(navMobile),
              src:icon?.getAttribute('src'),
              imageLoaded:Boolean(icon?.complete&&icon?.naturalWidth>0),
              width:navRect?.width,
              height:navRect?.height,
              clipped:navRect?.left<0||navRect?.right>innerWidth+1,
              scroll:document.documentElement.scrollWidth,viewport:innerWidth
            };
          });
          assert.equal(state.iconCount,2,'Der skal være et ikon i hver navigation');
          assert.equal(state.visibleCount,1,'Der skal kun være ét synligt navigationsikon');
          assert.equal(state.desktopVisible,width>=1100,'Desktopnav visning');
          assert.equal(state.mobileVisible,width<1100,'Mobilnav visning');
          assert.equal(state.src,'assets/dice-nav.svg');
          assert(state.imageLoaded,'SVG-ikonet blev ikke indlæst');
          assert(state.width>=20&&state.height>=20,'Terningen er for lille');
          assert(!state.clipped,'Terningen er klippet ved skærmkanten');
          assert(state.scroll<=width+1,'Vandret scrolling '+state.scroll);
          passed++;results.push({label,status:'PASS',state});console.log('PASS '+label);
          if(name==='madterningen'&&[390,1100,1440,2560,3840].includes(width)){
            await tab.screenshot({path:path.join(output,'navigation-'+width+'.png'),animations:'disabled'});
          }
        }catch(e){results.push({label,status:'FAIL',reason:e.message});console.log('FAIL '+label+': '+e.message);}
      }
      await context.close();
    }
  }finally{
    fs.writeFileSync(path.join(output,'test-resultater.json'),JSON.stringify({passed,total:results.length,results},null,2));
    await browser.close();
  }
  console.log('NAVIGATION_TESTS:',passed+'/'+results.length);
  if(passed!==results.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});