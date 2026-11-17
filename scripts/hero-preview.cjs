const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server = spawn('python3', ['-m', 'http.server', '3180', '--bind', '127.0.0.1', '--directory', 'dist'], {stdio:'ignore'});
(async () => {
 let browser;
 try {
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:3180');
  await page.waitForSelector('#hero h1');
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync('hero-previews', {recursive:true});
  for (const width of [375,390,768,1440]) {
   await page.setViewportSize({width,height:1000});
   await page.evaluate(async () => { await Promise.all([...document.querySelectorAll('#hero img,header img')].map(i => i.decode())); });
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'page overflow at '+width);
   assert.equal((await page.locator('#hero h1').innerText()).replace(/\s+/g,' '), 'Нарколог на дом');
   assert.equal(await page.locator('#hero .hero-services li').count(), 4);
   assert.equal(await page.locator('#hero .hero-services').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length), 2);
   assert.equal(await page.locator('#hero .hero-description,#hero .hero-benefits,#hero .trust-row').count(), 0);
   assert.equal(await page.locator('#hero .hero-services li').evaluateAll(xs=>xs.every(x=>x.scrollWidth<=x.clientWidth)),true,'service text overflow');
   await page.evaluate(()=>document.activeElement?.blur());
   await page.mouse.move(0,0);
   const heroBottom = await page.locator('#hero').evaluate(e=>e.getBoundingClientRect().bottom+scrollY);
   await page.setViewportSize({width,height:Math.max(1000,Math.ceil(heroBottom)+100)});
   await page.screenshot({path:'hero-previews/hero-'+width+'.png',clip:{x:0,y:0,width,height:Math.ceil(heroBottom)},animations:'disabled'});
   if ([375,1440].includes(width) && process.env.EMIT_HERO_PREVIEWS === '1') {
    const preview = await page.screenshot({type:'jpeg',quality:65,clip:{x:0,y:0,width,height:Math.ceil(heroBottom)},animations:'disabled'});
    console.log('HERO_PREVIEW_'+width+'_BEGIN'+preview.toString('base64')+'HERO_PREVIEW_END');
   }
   if (width<768) {
    const box=await page.locator('#hero .hero-visual').boundingBox();
    const actions=await page.locator('#hero .hero-buttons').boundingBox();
    assert.ok(box.y>=actions.y+actions.height,'photo follows actions');
    const button=await page.locator('#hero .hero-buttons>.button').boundingBox();
    const copy=await page.locator('#hero .hero-copy').boundingBox();
    assert.ok(Math.abs(button.width-copy.width)<1,'full-width primary button');
   }
   for(const action of ['#hero .hero-buttons>.button','#hero .hero-consultation']) {
    await page.locator(action).click();
    assert.equal(await page.locator('#callback').evaluate(e=>e.open),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator(action).evaluate(e=>e===document.activeElement),true);
   }
   console.log('PASS: hero at '+width+'px');
  }
  await page.evaluate(()=>window.pnp.updatePhone('+79990001122','+7 (999) 000-11-22'));
  assert.ok(await page.locator('a[href^="tel:"]').evaluateAll(xs=>xs.every(x=>x.getAttribute('href')==='tel:+79990001122')));
  assert.equal(await page.locator('#hero [data-phone]').innerText(),'+7 (999) 000-11-22');
  console.log('PASS: synchronized phones');
 } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
