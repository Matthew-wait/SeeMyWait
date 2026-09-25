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

const rows = [];
let from = 0;
const PAGE = 1000;
for (;;) {
  let res;
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(`${URL}/rest/v1/clinics?select=*&state=eq.${code}&order=npi`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + PAGE - 1}` },
    });
    if (res.ok) break;
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!res.ok) { console.error(`${code}: giving up at offset ${from}, HTTP ${res.status}`); process.exit(1); }
  const page = await res.json();
  if (!Array.isArray(page) || page.length === 0) break;
  rows.push(...page);
  if (page.length < PAGE) break;
  from += PAGE;
}

const { mkdir, writeFile } = await import("node:fs/promises");
const dir = "NPI_Data/backups";
await mkdir(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const path = `${dir}/${code}_${stamp}.json`;
await writeFile(path, JSON.stringify(rows));
console.log(`${code}: backed up ${rows.length} rows -> ${path}`);
