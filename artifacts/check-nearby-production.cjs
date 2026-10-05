const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
const fs=require('node:fs');
const cases=JSON.parse(fs.readFileSync('artifacts/nearby-snapshot-manifest.json','utf8'));
(async()=>{const browser=await chromium.connectOverCDP(process.env.FL_TEST_CDP_URL);const results=[];
try{for(const loc of cases){const rows=JSON.parse(fs.readFileSync(loc.file,'utf8')).sort((a,b)=>a.distance_miles-b.distance_miles||a.id.localeCompare(b.id));const positions=new Map(rows.map((r,i)=>[r.id,i]));
const context=await browser.newContext({locale:'en-US',timezoneId:'America/New_York',geolocation:{latitude:loc.lat,longitude:loc.lng},permissions:['geolocation'],viewport:{width:1440,height:1000}});
// Replay the full live database snapshot to isolate production rendering from
// network time. Real anonymous API completeness was verified separately.
await context.route('**/rest/v1/rpc/nearby_clinics_page',route=>{const p=route.request().postDataJSON();const start=p.p_after_id?positions.get(p.p_after_id)+1:0;const end=Math.min(rows.length,start+p.p_page_size);return route.fulfill({json:{clinics:rows.slice(start,end),next_cursor:end<rows.length?{cell:0,id:rows[end-1].id}:null}});});
await context.route('**/rest/v1/rpc/nearby_clinics',route=>route.fulfill({json:rows.slice(0,500)}));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));const start=Date.now();
await page.goto('http://127.0.0.1:3002/app',{waitUntil:'domcontentloaded'});
await page.getByRole('heading',{name:'Nearby Doctor Offices ('+loc.expected+')',exact:true}).waitFor({timeout:180000});
await page.getByText('Finding more within',{exact:false}).waitFor({state:'hidden',timeout:180000});
await page.getByText('Right Data. Right Spot. Right Time.',{exact:true}).waitFor({state:'hidden',timeout:10000});
await page.getByRole('button',{name:/Explore More/}).click();
const scroller=page.locator('[data-clinic-row]').first().locator('..').locator('..');
const top=await page.locator('[data-clinic-row]').allTextContents();
await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight});await page.waitForTimeout(500);
const tail=await page.locator('[data-clinic-row]').allTextContents();
for(let i=0;i<5;i++){await page.getByRole('button',{name:'Zoom out',exact:true}).click();await page.waitForTimeout(400);}
await page.waitForTimeout(500);
const canvas=await page.locator('canvas.smw-clinic-pins').evaluate(el=>({total:Number(el.dataset.clinicCount),visible:Number(el.dataset.visibleCount)}));
const screenshot='artifacts/nearby-production-'+loc.name.toLowerCase().replaceAll(' ','-')+'.png';await page.screenshot({path:screenshot,fullPage:true});
const box=await page.locator('.leaflet-container').boundingBox();
const project=(lat,lng)=>{const s=256*2**9,r=lat*Math.PI/180;return{x:(lng+180)/360*s,y:(1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*s};};
const origin=project(loc.lat,loc.lng),pin=project(rows[0].latitude,rows[0].longitude);
await page.mouse.click(box.x+box.width/2+pin.x-origin.x,box.y+box.height/2+pin.y-origin.y-24);
await page.waitForFunction(()=>document.querySelectorAll('h3').length>1,{timeout:10000});
const selected=await page.locator('h3.text-base').innerText();if(!rows.some(r=>r.name===selected))throw new Error('Canvas pin did not open a clinic: '+selected);
await page.locator('button.absolute.top-3.right-3').click();
await scroller.evaluate(el=>{el.scrollTop=0});await page.waitForTimeout(400);
await page.locator('[data-clinic-row]').first().click();await page.getByRole('heading',{name:rows[0].name,exact:true}).waitFor({timeout:10000});
const r={name:loc.name,count:loc.expected,dataSource:'live database snapshot replay',elapsedMs:Date.now()-start,errors,canvas,renderedCards:tail.length,top:top.slice(0,3),tail:tail.slice(-3),screenshot,officeDetailsOpened:true,markerDetailsOpened:true};
results.push(r);fs.writeFileSync('artifacts/nearby-pagination-production-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({name:r.name,count:r.count,errors,canvas,renderedCards:r.renderedCards,officeDetailsOpened:true}));
if(errors.length||canvas.total!==loc.expected||tail.length>100||!tail.at(-1).includes('25 mi'))throw new Error('Production rendering check failed');await context.close();}
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1});
