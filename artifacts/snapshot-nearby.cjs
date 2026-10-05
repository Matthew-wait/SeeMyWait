const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const text=fs.readFileSync('apps/web/.env','utf8');
const token=text.match(/^\s*SUPABASE_Token_URL\s*=\s*(.*)$/m)?.[1].trim().replace(/^['"]|['"]$/g,'');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'seemywait-nearby-'));
const cases=[{name:'Central Florida',lat:27.7567667,lng:-81.4639835,expected:4846},{name:'Miami-Dade',lat:25.8965,lng:-80.157,expected:154273}];
(async()=>{for(const loc of cases){const query=`set local statement_timeout='60s'; select coalesce(jsonb_agg(r),'[]'::jsonb) as clinics from (select c.id,c.name,c.address,c.city,c.state,c.postal_code,c.latitude,c.longitude,c.phone,c.google_place_id,c.npi,c.specialty,public.ST_Distance(c.geog,public.ST_SetSRID(public.ST_MakePoint(${loc.lng},${loc.lat}),4326)::public.geography)/1609.344 as distance_miles from public.clinics c where c.is_active and c.geog is not null and public.ST_DWithin(c.geog,public.ST_SetSRID(public.ST_MakePoint(${loc.lng},${loc.lat}),4326)::public.geography,25*1609.344)) r;`;
const response=await fetch('https://api.supabase.com/v1/projects/ziisjgtvqmturpljnvfh/database/query',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({query}),signal:AbortSignal.timeout(90000)});
const body=await response.json();if(!response.ok)throw new Error('Snapshot query failed: '+response.status);
const rows=body[0].clinics;if(rows.length!==loc.expected)throw new Error('Snapshot count mismatch');
loc.file=path.join(dir,loc.name.replaceAll(' ','-')+'.json');fs.writeFileSync(loc.file,JSON.stringify(rows));console.log(JSON.stringify({location:loc.name,count:rows.length}));}
fs.writeFileSync('artifacts/nearby-snapshot-manifest.json',JSON.stringify(cases,null,2));})().catch(e=>{console.error(e.message);process.exitCode=1});
