#!/usr/bin/env node
/**
 * Backs up every row currently in the `clinics` table for one state to a
 * timestamped local JSON file — a restore point taken right after that
 * state finishes importing, so a later mistake (this project has had a
 * few) only costs us back to the last completed state, not the whole run.
 *
 * Usage: node scripts/backup-state.mjs FL
 * Restore: node scripts/restore-state-backup.mjs NPI_Data/backups/FL_<timestamp>.json
 */
const code = process.argv[2];
if (!code) { console.error("usage: node scripts/backup-state.mjs <STATE>"); process.exit(1); }

const URL = process.env.SUPABASE_URL || "https://ziisjgtvqmturpljnvfh.supabase.co";
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!KEY) { console.error("SUPABASE_SECRET_KEY must be set"); process.exit(1); }

// Streams the JSON array to disk one page at a time instead of building the
// whole dataset as a single in-memory array + one giant JSON.stringify call
// — large states (California, 1M+ rows) blow past V8's max string length
// (~512MB) if you try to stringify everything at once.
//
// Keyset pagination (npi > last seen) rather than OFFSET: an offset deep
// into a 200k-row state makes Postgres walk and discard every earlier row
// on each page, which got slow enough to drop the connection.
const { mkdir, open } = await import("node:fs/promises");
const dir = "NPI_Data/backups";
await mkdir(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const path = `${dir}/${code}_${stamp}.json`;
const fh = await open(path, "w");

let total = 0;
let lastNpi = "";
const PAGE = 1000;
await fh.write("[");
for (;;) {
  const after = lastNpi ? `&npi=gt.${lastNpi}` : "";
  let page;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${URL}/rest/v1/clinics?select=*&state=eq.${code}${after}&order=npi&limit=${PAGE}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
      });
      if (res.ok) { page = await res.json(); break; }
      if (attempt >= 6) {
        await fh.write("]");
        await fh.close();
        console.error(`${code}: giving up after npi ${lastNpi || "(start)"}, HTTP ${res.status} (partial backup saved: ${total} rows)`);
        process.exit(1);
      }
    } catch (err) {
      if (attempt >= 6) {
        await fh.write("]");
        await fh.close();
        console.error(`${code}: giving up after npi ${lastNpi || "(start)"}: ${err.cause?.code || err.message} (partial backup saved: ${total} rows)`);
        process.exit(1);
      }
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** Math.min(attempt, 4)));
  }
  if (!Array.isArray(page) || page.length === 0) break;
  for (const row of page) {
    await fh.write((total > 0 ? "," : "") + JSON.stringify(row));
    total++;
  }
  if (page.length < PAGE) break;
  lastNpi = page[page.length - 1].npi;
}
await fh.write("]");
await fh.close();
console.log(`${code}: backed up ${total} rows -> ${path}`);
