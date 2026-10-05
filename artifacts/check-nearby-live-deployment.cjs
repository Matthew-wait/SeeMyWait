const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.connectOverCDP(process.env.FL_TEST_CDP_URL), results=[];
 try {for(const loc of [{name:'Central Florida',lat:27.7567667,lng:-81.4639835,expected:4846},{name:'Miami-Dade',lat:25.8965,lng:-80.157,minimum:5000}]){
  const context=await browser.newContext({locale:'en-US',timezoneId:'America/New_York',geolocation:{latitude:loc.lat,longitude:loc.lng},permissions:['geolocation'],viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[],ids=new Set(),responses=[];let calls=0,maxMiles=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().includes('/rpc/nearby_clinics_page'))responses.push((async()=>{const data=await r.json();if(r.status()!==200){errors.push('RPC '+r.status());return;}calls++;for(const row of data.clinics){ids.add(row.id);maxMiles=Math.max(maxMiles,row.distance_miles);}if(calls%20===0)console.log(JSON.stringify({name:loc.name,calls,received:ids.size}));})());});
  const start=Date.now();await page.goto('https://www.seemywait.com/app',{waitUntil:'domcontentloaded'});
  if(loc.expected){await page.getByRole('heading',{name:'Nearby Doctor Offices ('+loc.expected+')',exact:true}).waitFor({timeout:240000});await page.getByText('Finding more within',{exact:false}).waitFor({state:'hidden',timeout:240000});}
  else await page.waitForFunction(min=>{const h=[...document.querySelectorAll('h3')].find(e=>e.textContent.includes('Nearby Doctor Offices'));return h&&Number(h.textContent.match(/\((\d+)\)/)?.[1])>=min;},loc.minimum,{timeout:240000});
  await Promise.all(responses);await page.getByText('Right Data. Right Spot. Right Time.',{exact:true}).waitFor({state:'hidden',timeout:15000});
  const heading=await page.getByRole('heading',{name:/Nearby Doctor Offices/}).innerText();
  const canvas=await page.locator('canvas.smw-clinic-pins').evaluate(el=>({total:Number(el.dataset.clinicCount),visible:Number(el.dataset.visibleCount)}));
  await page.getByRole('button',{name:/Explore More/}).click();
  const scroller=page.locator('[data-clinic-row]').first().locator('..').locator('..');const top=await page.locator('[data-clinic-row]').allTextContents();
  await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});await page.waitForTimeout(500);const tail=await page.locator('[data-clinic-row]').allTextContents();
  const screenshot='artifacts/nearby-live-'+loc.name.toLowerCase().replaceAll(' ','-')+'.png';await page.screenshot({path:screenshot,fullPage:true});
  const result={...loc,url:page.url(),heading,received:ids.size,calls,maxMiles,canvas,errors,elapsedMs:Date.now()-start,complete:!!loc.expected,top:top.slice(0,3),tail:tail.slice(-3),screenshot};results.push(result);fs.writeFileSync('artifacts/nearby-live-deployment-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(result));
  if(errors.length||maxMiles>25||canvas.total<=500||(loc.expected&&ids.size!==loc.expected))throw new Error('Live deployment validation failed');await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1});
