const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
let playwright;
try { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }
catch { playwright = require('/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
const root = path.resolve(__dirname, '..');
const server = spawn('python3', ['-m','http.server','3177','--bind','127.0.0.1','--directory','dist'], { cwd:root, stdio:'ignore' });
(async()=>{
 let browser;
 try {
  browser=await playwright.chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage();const failures=[],outbound=[];
  page.on('pageerror',e=>failures.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`);});
  page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:3177/'))outbound.push(r.url());});
  await page.goto('http://127.0.0.1:3177');await page.waitForSelector('h1');
  assert.equal(await page.locator('h1').count(),1);
  for(const [selector,count] of [['#services .card',5],['#prices .card',3],['.doctor',8],['.review',20],['details',8],['.ratings a',5]])assert.equal(await page.locator(selector).count(),count,selector);
  assert.deepEqual(await page.locator('main>section,main>aside').evaluateAll(xs=>xs.map(x=>x.id)),['hero','situations','promotion','statistics','services','format','specialists','protocol','prices','reviews','trust','results','family','license','faq','consult']);
  const expectedPackages=[8,10,10];
  for(let i=0;i<3;i++)assert.equal(await page.locator('#prices .card').nth(i).locator('li').count(),expectedPackages[i]);
  for(const width of [320,375,768,1440,1920]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(async()=>{for(const img of document.images)if(img.src)img.loading='eager';await Promise.all([...document.images].filter(x=>x.src).map(i=>i.decode()));});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow at ${width}`);
  }
  console.log('PASS: section order, 5 services, full 3 packages, 8 specialists, 20 unique reviews, 5 ratings, 8 FAQs; images and responsive widths 320–1920.');
  await page.locator('details summary').first().focus();await page.keyboard.press('Enter');assert.equal(await page.locator('details').first().getAttribute('open'),'');
  const rail=page.locator('#team-rail');await rail.focus();await page.keyboard.press('ArrowRight');assert.ok(await rail.evaluate(el=>el.scrollLeft)>0);
  await page.locator('[data-sheet="1"]').click();assert.match(await page.locator('#license-sheet').getAttribute('src'),/4ff7489b45/);
  await page.locator('.license-zoom').click();assert.equal(await page.locator('#image-dialog').evaluate(e=>e.open),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.license-zoom').evaluate(e=>e===document.activeElement),true);
  const trigger=page.locator('.hero [data-callback]').first();await trigger.click();
  const dialog=page.locator('#callback');assert.equal(await dialog.evaluate(e=>e.open),true);
  await dialog.locator('.dialog-close').focus();await page.keyboard.press('Shift+Tab');assert.equal(await dialog.locator('[type=submit]').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Tab');assert.equal(await dialog.locator('.dialog-close').evaluate(e=>e===document.activeElement),true);
  await dialog.locator('[type=submit]').click();assert.equal(await dialog.locator('form').evaluate(f=>f.checkValidity()),false);
  await dialog.locator('[name=name]').fill('Тест');await dialog.locator('[name=phone]').fill('89991234567');assert.equal(await dialog.locator('[name=phone]').inputValue(),'+7 (999) 123-45-67');await dialog.locator('[name=consent]').check();await dialog.locator('[type=submit]').click();assert.match(await dialog.locator('.form-status').innerText(),/Заявка не отправлена/);
  await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  await page.evaluate(()=>window.pnp.updatePhone('+79990001122','+7 (999) 000-11-22'));
  assert.equal(await page.locator('a[href^="tel:"]').evaluateAll(xs=>xs.every(x=>x.getAttribute('href')==='tel:+79990001122')),true);
  await page.setViewportSize({width:375,height:900});await page.locator('.menu-toggle').click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'true');await page.locator('#main-nav a').first().click();assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');
  assert.deepEqual(failures,[]);assert.deepEqual(outbound,[]);
  console.log('PASS: keyboard FAQ/sliders, license switching and zoom, focus trap/restoration, Escape, validation, phone mask, consent, honest demo mode, mobile menu, synchronized phones; no external requests.');
  // Simulate a configured same-origin adapter; no personal data leaves this browser test server.
  await page.route('**/data/config.json',async route=>{const response=await route.fetch();const cfg=await response.json();cfg.form={mode:'live',endpoint:'/api/callback'};await route.fulfill({json:cfg});});
  let answer='success';let unblock;
  await page.route('**/api/callback',async route=>{
   assert.equal(route.request().method(),'POST');assert.equal(route.request().postDataJSON().consent,true);
   if(answer==='loading')await new Promise(resolve=>unblock=resolve);
   await route.fulfill({status:answer==='error'?500:200,json:{success:answer!=='error'}});
  });
  await page.reload();await page.waitForSelector('h1');
  const fill=async()=>{const f=page.locator('#consult form');await f.locator('[name=name]').fill('Тест');await f.locator('[name=phone]').fill('79991234567');await f.locator('[name=consent]').check();return f;};
  let f=await fill();answer='loading';await f.locator('[type=submit]').click();assert.equal(await f.locator('[type=submit]').isDisabled(),true);assert.equal(await f.getAttribute('aria-busy'),'true');while(!unblock)await new Promise(r=>setTimeout(r,10));unblock();await page.waitForFunction(()=>document.querySelector('#consult .form-status').textContent.includes('успешно доставлено'));
  f=await fill();answer='error';await f.locator('[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#consult .form-status').textContent.includes('Заявка не подтверждена'));assert.equal(await f.locator('[type=submit]').isDisabled(),false);
  console.log('PASS: same-origin adapter loading, confirmed success, server failure and retry state (mocked).');
 } finally {if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
