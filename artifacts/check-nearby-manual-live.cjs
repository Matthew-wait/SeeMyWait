const {chromium}=require(process.env.PLAYWRIGHT_MODULE),fs=require('node:fs');
(async()=>{const browser=await chromium.connectOverCDP(process.env.FL_TEST_CDP_URL),results=[];
 try{for(const loc of [{name:'Miami-Dade',lat:25.8965,lng:-80.157,count:1000,more:true},{name:'Central Florida',lat:27.7567667,lng:-81.4639835,count:27},{name:'Islamabad',lat:33.6844,lng:73.0479,count:17}]){
 const context=await browser.newContext({locale:'en-US',timezoneId:loc.name==='Islamabad'?'Asia/Karachi':'America/New_York',geolocation:{latitude:loc.lat,longitude:loc.lng},permissions:['geolocation'],viewport:{width:1440,height:1000}});
 const page=await context.newPage(),errors=[],batches=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/rpc/nearby_clinics_batch'))batches.push(r);});const start=Date.now();
 await page.goto('https://www.seemywait.com/app',{waitUntil:'domcontentloaded'});const label='Nearby Doctor Offices ('+loc.count.toLocaleString('en-US')+(loc.more?'+':'')+')';await page.getByRole('heading',{name:label,exact:true}).waitFor({timeout:60000});
 await page.getByText('Right Data. Right Spot. Right Time.',{exact:true}).waitFor({state:'hidden',timeout:15000});await page.getByText("You're seeing doctor offices within",{exact:false}).filter({hasText:'5 miles'}).waitFor();
 const initialMs=Date.now()-start;await page.waitForTimeout(5000);if(batches.length!==1)throw new Error('Unexpected automatic batches: '+batches.length);
 const first=await batches[0].json();let rows=first.clinics;let afterLabel=label;
 if(loc.more){await page.getByRole('button',{name:'Load more (up to 1,000)',exact:true}).click();await page.getByRole('heading',{name:'Nearby Doctor Offices (2,000+)',exact:true}).waitFor({timeout:60000});await page.waitForTimeout(5000);if(batches.length!==2)throw new Error('Unexpected batches after Load more');rows=rows.concat((await batches[1].json()).clinics);afterLabel='Nearby Doctor Offices (2,000+)';}
 else if(await page.getByRole('button',{name:'Load more (up to 1,000)',exact:true}).count())throw new Error('Complete result set still shows Load more');
 const ids=new Set();let previous=-1;for(const r of rows){if(ids.has(r.id)||r.distance_miles<previous||r.distance_miles>5)throw new Error('Batch continuity failed');ids.add(r.id);previous=r.distance_miles;}
 const canvas=await page.locator('canvas.smw-clinic-pins').evaluate(el=>Number(el.dataset.clinicCount));if(canvas!==rows.length||errors.length)throw new Error('Map source/error check failed');
 const screenshot='artifacts/nearby-manual-'+loc.name.toLowerCase().replaceAll(' ','-')+'.png';await page.screenshot({path:screenshot,fullPage:true});const result={name:loc.name,label,afterLabel,initialMs,batches:batches.length,loaded:rows.length,canvas,errors,automaticRequestsStopped:true,manualLoadVerified:!!loc.more,screenshot};results.push(result);console.log(JSON.stringify(result));fs.writeFileSync('artifacts/nearby-manual-live-results.json',JSON.stringify(results,null,2));await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
