// Regenerates docs/NPI-GAP-LOG.md: per-state gap between the staged NPPES
// files and the live clinics table. Run from the repo root with the Supabase
// management token in SUPABASE_ACCESS_TOKEN (see apps/web/.env, SUPABASE_Token_URL).
//
//   node scripts/npi-gap-report.mjs            # counts only (fast, ~minutes)
//
// Columns:
//   Staged   rows in NPI_Data/staged/<ST>.csv (excluding header)
//   Live     rows in public.clinics with that state (npi_imported or not)
//   Done     NPIs in NPI_Data/staged/<ST>.checkpoint.json
//   Gap      Staged - Live (upper bound on what is missing; duplicate skips count too)
//   Not run  Staged NPIs not in the checkpoint (never attempted, or failed geocoding)
// Exact per-NPI reconciliation is per state with NPI_Data/reconcile-gaps-fl.mjs.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const stagedDir = join(root, "NPI_Data", "staged");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const URL = "https://api.supabase.com/v1/projects/ziisjgtvqmturpljnvfh/database/query";

async function q(query) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const liveRows = await q("select state, count(*)::int as n from public.clinics where state is not null group by state");
const live = new Map(liveRows.map((r) => [r.state, r.n]));

const states = readdirSync(stagedDir)
  .filter((f) => /^[A-Z]{2}\.csv$/.test(f))
  .map((f) => f.slice(0, 2))
  .sort();

const rows = [];
for (const st of states) {
  const csv = readFileSync(join(stagedDir, `${st}.csv`), "utf8");
  let staged = 0;
  for (const line of csv.split("\n")) if (/^\d{10},/.test(line)) staged++;
  const cpPath = join(stagedDir, `${st}.checkpoint.json`);
  const done = existsSync(cpPath) ? JSON.parse(readFileSync(cpPath, "utf8")).length : 0;
  const liveN = live.get(st) ?? 0;
  rows.push({ st, staged, live: liveN, done, gap: staged - liveN, notRun: Math.max(0, staged - done) });
}

const fmt = (n) => n.toLocaleString("en-US");
const total = rows.reduce((a, r) => ({ staged: a.staged + r.staged, live: a.live + r.live, done: a.done + r.done, gap: a.gap + r.gap, notRun: a.notRun + r.notRun }), { staged: 0, live: 0, done: 0, gap: 0, notRun: 0 });
const today = new Date().toISOString().slice(0, 10);

const lines = [
  "# NPI gap log",
  "",
  `Generated ${today} by \`scripts/npi-gap-report.mjs\`. Regenerate after every import run.`,
  "",
  "This records where the live database is missing offices that exist in the NPPES staged files,",
  "so the gaps can be filled later. It is the source of truth for gaps; the rules for each state are in",
  "[Known gap causes](#known-gap-causes).",
  "",
  "## Totals",
  "",
  `- Staged offices: ${fmt(total.staged)}`,
  `- Live offices: ${fmt(total.live)}`,
  `- Gap (staged minus live, all states): ${fmt(total.gap)}`,
  `- Never run or failed geocoding (not checkpointed): ${fmt(total.notRun)}`,
  "",
  "## By state",
  "",
  "| State | Staged | Live | Done (checkpoint) | Gap | Not run | Status |",
  "|---|---:|---:|---:|---:|---:|---|",
];
for (const r of rows) {
  const status = r.gap <= 0 ? "complete" : r.live === 0 ? "not imported" : r.gap / r.staged < 0.01 ? "near complete" : "gap";
  lines.push(`| ${r.st} | ${fmt(r.staged)} | ${fmt(r.live)} | ${fmt(r.done)} | ${fmt(r.gap)} | ${fmt(r.notRun)} | ${status} |`);
}
lines.push(
  "",
  "## Known gap causes",
  "",
  "- **Failed geocoding, not checkpointed.** The Census batch geocoder (and the Nominatim fallback) returned no match for some addresses. These stay out of the checkpoint and are retried on the next run. Per-batch counts are in `NPI_Data/logs/<ST>.log` (\"rows failed geocoding\").",
  "- **Checkpointed by old code.** Before commit `9c8a47d` (2026-09-26) the import marked geocoding failures as done. Those NPIs are in the checkpoint but never reached the database. Florida has about 37,600 of these. Fix: remove them from the checkpoint and re-run.",
  "- **Duplicate skips.** An office with the same name and address already exists under another NPI. This is correct, and it is counted in the gap.",
  "- **Whole batch geocoder outage.** A batch that geocodes 0 of 9,000 (seen in Florida) is retried in full on the next run.",
  "",
  "## How to fill a gap later",
  "",
  "1. Florida exact reconcile: `NPI_Data/reconcile-gaps-fl.mjs` (`ONLY_STATES=FL`), output `NPI_Data/reconcile-FL.json`.",
  "2. Remove the checkpointed-but-missing NPIs for that state from `NPI_Data/staged/<ST>.checkpoint.json` (back the file up first).",
  "3. Re-run the state with `scripts/seed-nppes-bulk.mjs --geocode --push --checkpoint NPI_Data/staged/<ST>.checkpoint.json`.",
  "4. Re-run `node scripts/npi-gap-report.mjs` and update this file.",
  "",
  "Florida exact reconcile, 2026-10-05 (NPI_Data/reconcile-FL.json): 63,299 staged NPIs missing from live. 5,247 are duplicate skips, about 37,600 are checkpointed but missing (old code), about 20,400 were never run. Live count now 589,657, so the gap total above is 63,292.",
  "",
);
writeFileSync(join(root, "docs", "NPI-GAP-LOG.md"), lines.join("\n"));
console.log(`wrote docs/NPI-GAP-LOG.md (${rows.length} states)`);
