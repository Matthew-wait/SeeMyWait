// Read-only live browser checks. Presets are read from FL_LOCATION_TESTS.md.
// Supply PLAYWRIGHT_MODULE and FL_TEST_CDP_URL; no Supabase credentials required.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const presets = fs.readFileSync(path.join(root, 'FL_LOCATION_TESTS.md'), 'utf8')
  .split('\n').filter(line => /^\|[^|]+\|[^|]+\|\s*-?\d/.test(line))
  .map(line => {
    const p = line.split('|').map(v => v.trim());
    return { name:p[1], address:p[2], latitude:Number(p[3]), longitude:Number(p[4]), locale:p[5], timezone:p[6] };
  });
const out = path.join(root, 'artifacts', 'fl-location-tests');
fs.mkdirSync(out, {recursive:true});
(async () => {
  const browser = await chromium.connectOverCDP(process.env.FL_TEST_CDP_URL);
  const results = [];
  try {
    for (const preset of presets.filter(p => !process.env.FL_TEST_ONLY || p.name === process.env.FL_TEST_ONLY)) {
      const context = await browser.newContext({locale:preset.locale, timezoneId:preset.timezone,
        geolocation:{latitude:preset.latitude, longitude:preset.longitude, accuracy:100},
        permissions:['geolocation'], viewport:{width:1440,height:1000}});
      const page = await context.newPage();
      const r = {...preset, testedAt:new Date().toISOString(), requests:[], pageErrors:[]};
      const pending = [];
      page.on('pageerror', e => r.pageErrors.push(e.message));
      page.on('response', response => {
        if (!response.url().includes('/rest/v1/rpc/nearby_clinics')) return;
        pending.push((async () => {
          const request = response.request();
          const payload = request.postDataJSON();
          const body = await response.json();
          const distances = Array.isArray(body) ? body.map(c => c.distance_miles) : [];
          r.requests.push({status:response.status(), params:payload, count:Array.isArray(body)?body.length:null,
            elapsedMs:Math.round(request.timing().responseEnd),
            minMiles:distances.length?Math.min(...distances):null, maxMiles:distances.length?Math.max(...distances):null,
            invalidCoordinates:Array.isArray(body)?body.filter(c => typeof c.latitude !== 'number' || typeof c.longitude !== 'number' || Math.abs(c.latitude)>90 || Math.abs(c.longitude)>180).length:null,
            error:Array.isArray(body)?null:body.message});
        })().catch(e => r.pageErrors.push('Response inspection: '+e.message)));
      });
      try {
        const started = Date.now();
        await page.goto('https://www.seemywait.com/app', {waitUntil:'domcontentloaded', timeout:45000});
        await page.waitForFunction(() => document.body.innerText.includes('within') || document.body.innerText.includes('doctor offices near') || document.body.innerText.includes('No offices'), {timeout:25000}).catch(() => {});
        await page.waitForLoadState('networkidle', {timeout:15000}).catch(() => {});
        await page.getByText('Right Data. Right Spot. Right Time.', {exact:true}).waitFor({state:'hidden',timeout:15000});
        await page.locator('.leaflet-container').waitFor({state:'visible',timeout:10000});
        await Promise.all(pending);
        r.totalLoadMs = Date.now()-started;
        r.browserSettings = await page.evaluate(async () => ({locale:navigator.language,
          timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
          position:await new Promise((resolve,reject) => navigator.geolocation.getCurrentPosition(p => resolve({latitude:p.coords.latitude,longitude:p.coords.longitude}),reject))}));
        r.text = (await page.locator('body').innerText()).slice(0,6000);
        r.mapPresent = await page.locator('.leaflet-container').count() > 0;
        const slug = preset.name.toLowerCase().replaceAll(' ','-');
        r.screenshot = slug+'.png';
        await page.screenshot({path:path.join(out,r.screenshot),fullPage:true});
      } catch(e) { r.pageErrors.push(e.message); }
      results.push(r);
      fs.writeFileSync(path.join(out, 'results'+(process.env.FL_TEST_ONLY?'-single':'')+'.json'), JSON.stringify(results,null,2));
      console.log(JSON.stringify({name:r.name,requests:r.requests,mapPresent:r.mapPresent,pageErrors:r.pageErrors,totalLoadMs:r.totalLoadMs,text:r.text?.slice(0,650)}));
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e.message); process.exitCode=1; });
