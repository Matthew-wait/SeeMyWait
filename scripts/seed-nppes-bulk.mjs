#!/usr/bin/env node
/**
 * National NPPES bulk-file pipeline — replaces the live-API script's 1,200
 * result-per-query ceiling with a single local pass over the full CMS
 * NPPES Data Dissemination file (millions of rows, no cap, no rate limit).
 *
 *   npidata_pfile_*.csv  →  stage (partition by state)  →  process (geocode + push)
 *
 * Usage:
 *   # One-time: split the ~10GB national file into small per-state CSVs.
 *   # This is the only step that touches the giant file; run it once.
 *   node scripts/seed-nppes-bulk.mjs stage \
 *     --csv D:/WorkFilesES/SeeMyWait/NPI_Data/npidata_pfile_*.csv \
 *     --taxonomy-csv ./scripts/data/nucc_taxonomy.csv \
 *     --out-dir ./NPI_Data/staged
 *
 *   # Repeatable: geocode + upsert one staged state, in whatever priority
 *   # order you want (Miami/FL first, then the rest).
 *   node scripts/seed-nppes-bulk.mjs process \
 *     --state-csv ./NPI_Data/staged/FL.csv \
 *     --geocode --push \
 *     --checkpoint ./NPI_Data/staged/FL.checkpoint.json
 *
 * Env for --push: SUPABASE_URL, SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 */

import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir, appendFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { resolve, join } from "node:path";
import { titleCase, zip5, csvEscape, parseCsvLine, geocode, pushToDb, sleep } from "./lib/nppes-pipeline.mjs";

function parseArgs(argv) {
  const mode = argv[0];
  const a = { mode, geocoder: "census", batchSize: 4000 };
  for (let i = 1; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === "--csv") a.csv = next();
    else if (k === "--taxonomy-csv") a.taxonomyCsv = next();
    else if (k === "--out-dir") a.outDir = next();
    else if (k === "--state-csv") a.stateCsv = next();
    else if (k === "--checkpoint") a.checkpoint = next();
    else if (k === "--geocode") a.geocode = true;
    else if (k === "--geocoder") a.geocoder = next();
    else if (k === "--push") { a.push = true; a.geocode = true; }
    else if (k === "--batch-size") a.batchSize = parseInt(next(), 10) || 4000;
    else if (k === "--limit") a.limit = parseInt(next(), 10);
  }
  return a;
}

/** Find a header's column index by fuzzy (case-insensitive substring) match
 *  — hedges against minor wording differences across NPPES file versions. */
function findCol(headers, ...patterns) {
  const lower = headers.map((h) => h.toLowerCase());
  for (const p of patterns) {
    const idx = lower.findIndex((h) => h.includes(p.toLowerCase()));
    if (idx !== -1) return idx;
  }
  return -1;
}

/* --------------------------- taxonomy lookup --------------------------- */

async function loadTaxonomyMap(path) {
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const codeIdx = header.indexOf("Code");
  const classIdx = header.indexOf("Classification");
  const specIdx = header.indexOf("Specialization");
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const code = f[codeIdx];
    if (!code) continue;
    const cls = f[classIdx] || "";
    const spec = f[specIdx] || "";
    map.set(code, spec ? `${cls}, ${spec}` : cls);
  }
  return map;
}

/* ------------------------------- stage ---------------------------------- */

async function stage(args) {
  if (!args.csv || !args.taxonomyCsv || !args.outDir) {
    console.error("stage needs --csv, --taxonomy-csv, --out-dir");
    process.exit(1);
  }
  const taxonomy = await loadTaxonomyMap(resolve(args.taxonomyCsv));
  console.log(`Loaded ${taxonomy.size} taxonomy codes.`);

  await mkdir(resolve(args.outDir), { recursive: true });

  const rl = createInterface({ input: createReadStream(resolve(args.csv), { encoding: "utf8" }), crlfDelay: Infinity });

  let cols = null;
  let lineNo = 0;
  let kept = 0;
  const openStates = new Map(); // state -> buffered rows, flushed periodically
  const FLUSH_EVERY = 20000;
  const header = "npi,name,address_line,city,state,postal_code,specialty,phone";
  // `appendFile` with flag "a" silently *creates* a missing file rather than
  // erroring, so a try/catch around it can never detect "this is a new
  // file" — track it explicitly instead, or every staged CSV ends up with
  // no header row at all (its first real record gets misread as one).
  const headerWritten = new Set();

  async function flush(state, rows) {
    if (!rows.length) return;
    const path = join(resolve(args.outDir), `${state}.csv`);
    const body = rows
      .map((r) => [r.npi, r.name, r.address_line, r.city, r.state, r.postal_code, r.specialty, r.phone].map(csvEscape).join(","))
      .join("\n") + "\n";
    if (!headerWritten.has(state)) {
      await writeFile(path, header + "\n" + body);
      headerWritten.add(state);
    } else {
      await appendFile(path, body, { flag: "a" });
    }
  }

  for await (const line of rl) {
    lineNo++;
    if (lineNo === 1) {
      const h = parseCsvLine(line);
      cols = {
        npi: findCol(h, "NPI"),
        entityType: findCol(h, "Entity Type Code"),
        orgName: findCol(h, "Provider Organization Name"),
        lastName: findCol(h, "Provider Last Name"),
        firstName: findCol(h, "Provider First Name"),
        credential: findCol(h, "Provider Credential Text"),
        addr1: findCol(h, "First Line Business Practice Location Address", "First Line Business Mailing Address"),
        addr2: findCol(h, "Second Line Business Practice Location Address"),
        city: findCol(h, "Business Practice Location Address City Name"),
        state: findCol(h, "Business Practice Location Address State Name"),
        zip: findCol(h, "Business Practice Location Address Postal Code"),
        phone: findCol(h, "Business Practice Location Address Telephone Number"),
        deactivation: findCol(h, "NPI Deactivation Date"),
        taxCodes: Array.from({ length: 15 }, (_, i) => findCol(h, `Healthcare Provider Taxonomy Code_${i + 1}`)),
        taxPrimary: Array.from({ length: 15 }, (_, i) => findCol(h, `Healthcare Provider Primary Taxonomy Switch_${i + 1}`)),
      };
      // Only the first taxonomy slot is required — most providers have just
      // one or two anyway, and some file variants may not carry all 15.
      const missing = Object.entries(cols).filter(([k, v]) =>
        Array.isArray(v) ? v[0] === -1 : v === -1
      );
      if (missing.length) {
        console.error("Could not find these expected columns in the header:", missing.map(([k]) => k));
        console.error("Actual header sample:", h.slice(0, 20).join(" | "));
        process.exit(1);
      }
      console.log("Header mapped OK. Streaming…");
      continue;
    }

    const f = parseCsvLine(line);
    const npi = (f[cols.npi] || "").trim();
    if (!/^\d{10}$/.test(npi)) continue;
    if ((f[cols.deactivation] || "").trim()) continue; // deactivated

    const org = (f[cols.orgName] || "").trim();
    const last = (f[cols.lastName] || "").trim();
    const first = (f[cols.firstName] || "").trim();
    const cred = (f[cols.credential] || "").trim().replace(/\.\s*$/, "");
    let name;
    if (org) name = titleCase(org);
    else if (last || first) name = [titleCase(first), titleCase(last)].filter(Boolean).join(" ") + (cred ? `, ${cred}` : "");
    else continue;

    const a1 = (f[cols.addr1] || "").trim();
    const a2 = (f[cols.addr2] || "").trim();
    const addressLine = [a1, a2].filter(Boolean).map((x) => titleCase(x)).join(" ").trim();
    const city = titleCase((f[cols.city] || "").trim());
    const state = (f[cols.state] || "").trim().toUpperCase();
    const postal = zip5(f[cols.zip]);
    // Some NPPES records carry a foreign practice address (e.g. a German
    // state name) instead of a 2-letter US state code. The app is US-only,
    // and an unsanitized state value here would also corrupt the per-state
    // output filename below (a "/" in the value reads as a path separator).
    if (!addressLine || !city || !/^[A-Z]{2}$/.test(state)) continue;

    let specialty = null;
    for (let i = 0; i < 15; i++) {
      if ((f[cols.taxPrimary[i]] || "").trim().toUpperCase() === "Y") {
        const code = (f[cols.taxCodes[i]] || "").trim();
        specialty = taxonomy.get(code) || null;
        break;
      }
    }

    const phoneRaw = (f[cols.phone] || "").trim();
    const row = { npi, name, address_line: addressLine, city, state, postal_code: postal, specialty, phone: phoneRaw || null };

    if (!openStates.has(state)) openStates.set(state, []);
    const bucket = openStates.get(state);
    bucket.push(row);
    kept++;
    if (bucket.length >= FLUSH_EVERY) {
      await flush(state, bucket);
      openStates.set(state, []);
    }

    if (lineNo % 500000 === 0) {
      console.log(`  scanned ${lineNo.toLocaleString()} lines, kept ${kept.toLocaleString()}…`);
    }
  }

  for (const [state, bucket] of openStates) {
    await flush(state, bucket);
  }

  console.log(`\nDone. Scanned ${lineNo.toLocaleString()} lines, staged ${kept.toLocaleString()} active US records into ${args.outDir}, one CSV per state.`);
}

/* ------------------------------ process --------------------------------- */

async function loadCheckpoint(path) {
  if (!path) return new Set();
  try {
    const text = await readFile(path, "utf8");
    return new Set(JSON.parse(text));
  } catch {
    return new Set();
  }
}

async function saveCheckpoint(path, doneSet) {
  if (!path) return;
  await writeFile(path, JSON.stringify([...doneSet]));
}

async function processState(args) {
  if (!args.stateCsv) {
    console.error("process needs --state-csv");
    process.exit(1);
  }
  const text = await readFile(resolve(args.stateCsv), "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  let rows = lines.slice(1).map((l) => {
    const f = parseCsvLine(l);
    return {
      npi: f[idx.npi],
      name: f[idx.name],
      address_line: f[idx.address_line],
      city: f[idx.city],
      state: f[idx.state],
      postal_code: f[idx.postal_code],
      specialty: f[idx.specialty] || null,
      phone: f[idx.phone] || null,
    };
  });

  const done = await loadCheckpoint(args.checkpoint);
  rows = rows.filter((r) => !done.has(r.npi));
  if (args.limit) rows = rows.slice(0, args.limit);
  console.log(`${args.stateCsv}: ${rows.length} rows remaining to process (${done.size} already done).`);
  if (!rows.length) return;

  const BATCH = args.batchSize;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    console.log(`\nBatch ${Math.floor(i / BATCH) + 1}/${Math.ceil(rows.length / BATCH)} (${chunk.length} rows)`);

    let geo = new Map();
    if (args.geocode) {
      geo = await geocode(chunk, args.geocoder, { onProgress: (m) => console.log(m) });
      console.log(`  geocoded ${geo.size}/${chunk.length}`);
    }

    const records = chunk
      .map((r) => {
        const g = geo.get(r.npi);
        return {
          npi: r.npi,
          name: r.name,
          address: [r.address_line, r.city, [r.state, r.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", "),
          city: r.city,
          state: r.state,
          postal_code: r.postal_code || null,
          specialty: r.specialty,
          phone: r.phone,
          latitude: g ? g.latitude : null,
          longitude: g ? g.longitude : null,
          is_active: true,
        };
      })
      .filter((r) => !args.geocode || (r.latitude != null && r.longitude != null));

    if (args.push && records.length) {
      const n = await pushToDb(records, { onProgress: (m) => console.log(m) });
      console.log(`  pushed ${n}/${records.length}`);
    }

    for (const r of chunk) done.add(r.npi);
    await saveCheckpoint(args.checkpoint, done);
    console.log(`  checkpoint saved (${done.size} total done for this state)`);
  }

  console.log(`\nDone with ${args.stateCsv}.`);
}

/* --------------------------------- main --------------------------------- */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.mode === "stage") return stage(args);
  if (args.mode === "process") return processState(args);
  console.error("Usage: node scripts/seed-nppes-bulk.mjs <stage|process> [flags]");
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
