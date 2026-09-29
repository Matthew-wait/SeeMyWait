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
import { existsSync, readFileSync } from "node:fs";
import { mkdir, open } from "node:fs/promises";

const code = process.argv[2];
if (!code) { console.error("usage: node scripts/backup-state.mjs <STATE>"); process.exit(1); }

const URL = process.env.SUPABASE_URL || "https://ziisjgtvqmturpljnvfh.supabase.co";
const KEY = process.env.SUPABASE_SECRET_KEY;
if (!KEY) { console.error("SUPABASE_SECRET_KEY must be set"); process.exit(1); }

/** GET with a per-request timeout and backoff; returns parsed JSON. */
async function getJson(query, what) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${URL}/rest/v1/clinics?${query}`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
        signal: AbortSignal.timeout(60000), // a hung request would otherwise stall the backup forever
      });
      if (res.ok) return await res.json();
      const text = await res.text();
      if (attempt >= 6) { console.error(`${code}: giving up at ${what}, HTTP ${res.status}: ${text.slice(0, 200)}`); process.exit(1); }
    } catch (err) {
      if (attempt >= 6) { console.error(`${code}: giving up at ${what}: ${err.cause?.code || err.message}`); process.exit(1); }
    }
    await new Promise((r) => setTimeout(r, 2000 * 2 ** Math.min(attempt, 4)));
  }
}

// Streams the JSON array to disk one page/chunk at a time instead of
// building the whole dataset as a single in-memory array + one giant
// JSON.stringify call — large states (California, 1M+ rows) blow past V8's
// max string length (~512MB) if you try to stringify everything at once.
const dir = "NPI_Data/backups";
await mkdir(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const path = `${dir}/${code}_${stamp}.json`;
const fh = await open(path, "w");
let total = 0;
await fh.write("[");
async function writeRows(rows) {
  for (const row of rows) {
    await fh.write((total > 0 ? "," : "") + JSON.stringify(row));
    total++;
  }
}

const staged = `NPI_Data/staged/${code}.csv`;
if (existsSync(staged)) {
  // Look rows up by NPI (a unique-index hit) using the staged file's NPI
  // list. Filtering on state + ordering by npi instead has to walk the npi
  // index across every state to find this one's rows, which on a
  // multi-million-row table hits the statement timeout under import load.
  const npis = readFileSync(staged, "utf8").split(/\r?\n/).slice(1).filter(Boolean).map((l) => l.split(",")[0]);
  const CHUNK = 150;
  for (let i = 0; i < npis.length; i += CHUNK) {
    const part = npis.slice(i, i + CHUNK);
    await writeRows(await getJson(`select=*&npi=in.(${part.join(",")})`, `NPIs ${i}-${i + part.length}`));
    if ((i / CHUNK) % 100 === 0) console.log(`${code}: checked ${Math.min(i + CHUNK, npis.length)}/${npis.length} NPIs, ${total} rows found`);
  }
} else {
  // No staged file: keyset pagination (npi > last seen) over the state.
  let lastNpi = "";
  const PAGE = 250;
  for (;;) {
    const after = lastNpi ? `&npi=gt.${lastNpi}` : "";
    const page = await getJson(`select=*&state=eq.${code}${after}&order=npi&limit=${PAGE}`, `after npi ${lastNpi || "(start)"}`);
    if (!Array.isArray(page) || page.length === 0) break;
    await writeRows(page);
    if (page.length < PAGE) break;
    lastNpi = page[page.length - 1].npi;
  }
}

await fh.write("]");
await fh.close();
console.log(`${code}: backed up ${total} rows -> ${path}`);
