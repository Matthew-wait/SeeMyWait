#!/usr/bin/env node
/**
 * Phase 5 — metro seed for the `clinics` table.
 *
 *   NPPES NPI Registry  →  US Census batch geocoder  →  clinics_seed.csv  →  DB
 *
 * All upstreams are free and keyless. Node 18+ (uses global fetch/FormData/Blob).
 * No npm dependencies.
 *
 * Usage:
 *   node scripts/seed-nppes.mjs --state FL --city Miami --city "Coral Gables"
 *   node scripts/seed-nppes.mjs --state FL --zip 33136,33101 --limit 800 --geocode
 *   node scripts/seed-nppes.mjs --state FL --city Miami --geocode --push
 *
 * Flags:
 *   --state FL                 (required) 2-letter USPS
 *   --city  "Miami"            repeatable; at least one --city or --zip required
 *   --zip   33136,33101        repeatable / comma-list
 *   --taxonomy "Family Medicine"   repeatable; narrows the NPPES query
 *   --limit 500               max NPIs to keep (default 500)
 *   --out   ./clinics_seed.csv   output path (default ./scripts/out/clinics_seed.csv)
 *   --geocode                 geocode addresses and emit lat/lng
 *   --geocoder census|nominatim   (default census) — Census is a free batch
 *                             service; Nominatim is a per-address fallback
 *                             (~1 req/s) for networks where Census is blocked.
 *                             Census rows that come back unmatched are retried
 *                             on Nominatim automatically.
 *   --push                    upsert into clinics (needs SUPABASE_URL +
 *                             SUPABASE_SERVICE_ROLE_KEY in env); implies --geocode
 *   --dry-run                 fetch + map only, print a sample, write nothing
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const NPPES = "https://npiregistry.cms.hhs.gov/api/";
const CENSUS_BATCH = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const CENSUS_BENCHMARK = "Public_AR_Current";

/* ----------------------------- args ----------------------------- */

function parseArgs(argv) {
  const a = { city: [], zip: [], taxonomy: [], limit: 500, geocoder: "census", out: "scripts/out/clinics_seed.csv" };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === "--state") a.state = next()?.toUpperCase();
    else if (k === "--city") a.city.push(next());
    else if (k === "--zip") a.zip.push(...String(next()).split(",").map((s) => s.trim()).filter(Boolean));
    else if (k === "--taxonomy") a.taxonomy.push(next());
    else if (k === "--limit") a.limit = parseInt(next(), 10) || 500;
    else if (k === "--geocoder") a.geocoder = next();
    else if (k === "--out") a.out = next();
    else if (k === "--geocode") a.geocode = true;
    else if (k === "--push") { a.push = true; a.geocode = true; }
    else if (k === "--dry-run") a.dryRun = true;
  }
  return a;
}

/* --------------------------- helpers --------------------------- */

const titleCase = (s) => String(s || "").toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
const zip5 = (s) => String(s || "").replace(/\D/g, "").slice(0, 5);
const US_STATE = /^[A-Za-z]{2}$/;

function providerName(r) {
  const b = r.basic || {};
  if (r.enumeration_type === "NPI-2" || b.organization_name) {
    return titleCase((b.organization_name || b.name || "").trim());
  }
  const name = [b.first_name, b.last_name].filter(Boolean).map((x) => titleCase(x.trim())).join(" ").trim();
  const cred = (b.credential || "").replace(/\.\s*$/, "").trim();
  return cred ? `${name}, ${cred}` : name;
}

function locationAddress(r) {
  const list = Array.isArray(r.addresses) ? r.addresses : [];
  return list.find((x) => x.address_purpose === "LOCATION")
    || list.find((x) => x.address_purpose === "PRIMARY")
    || list[0] || null;
}

function primarySpecialty(r) {
  const t = Array.isArray(r.taxonomies) ? r.taxonomies : [];
  const p = t.find((x) => x.primary) || t[0];
  return p && p.desc ? titleCase(p.desc) : null;
}

function isDeactivated(r) {
  const b = r.basic || {};
  return Boolean(b.deactivation_date) || b.status === "D";
}

/** NPPES record -> seed row, or null if unusable. */
function toRow(r) {
  const npi = String(r.number || "").trim();
  if (!/^\d{10}$/.test(npi) || isDeactivated(r)) return null;
  const name = providerName(r);
  const a = locationAddress(r);
  if (!name || !a) return null;
  const line = [a.address_1, a.address_2].filter(Boolean).map((x) => titleCase(x.trim())).join(" ").trim();
  const city = a.city ? titleCase(a.city.trim()) : "";
  const state = a.state && US_STATE.test(a.state) ? a.state.toUpperCase() : (a.state || "").trim();
  const postal = zip5(a.postal_code);
  if (!line || !city || !state) return null;
  return {
    npi,
    name,
    address_line: line,
    city,
    state,
    postal_code: postal,
    specialty: primarySpecialty(r),
    phone: a.telephone_number ? String(a.telephone_number).trim() : null,
  };
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Minimal RFC-4180-ish CSV row parser (handles quoted fields with commas). */
function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

/* --------------------------- NPPES --------------------------- */

async function fetchNppes({ state, city, zip, taxonomy, limit }) {
  const paramSets = [];
  const tax = taxonomy.length ? taxonomy : [null];
  for (const t of tax) {
    for (const c of city.length ? city : [null]) {
      for (const z of zip.length ? zip : [null]) {
        if (!c && !z) continue; // NPPES needs city or postal_code alongside state
        paramSets.push({ state, city: c, postal_code: z, taxonomy_description: t });
      }
    }
  }
  if (!paramSets.length) throw new Error("Provide at least one --city or --zip (with --state).");

  const seen = new Map();
  for (const p of paramSets) {
    for (let skip = 0; skip <= 1000 && seen.size < limit; skip += 200) {
      const u = new URL(NPPES);
      u.searchParams.set("version", "2.1");
      u.searchParams.set("limit", "200");
      u.searchParams.set("skip", String(skip));
      for (const [k, v] of Object.entries(p)) if (v) u.searchParams.set(k, v);
      const res = await fetch(u);
      if (!res.ok) { console.warn(`  NPPES ${res.status} for`, p); break; }
      const data = await res.json();
      const results = Array.isArray(data.results) ? data.results : [];
      for (const r of results) {
        const row = toRow(r);
        if (row && !seen.has(row.npi)) seen.set(row.npi, row);
      }
      console.log(`  ${JSON.stringify(p)} skip=${skip} → +${results.length} (total ${seen.size})`);
      if (results.length < 200) break;
    }
  }
  return [...seen.values()].slice(0, limit);
}

/* --------------------------- geocode -------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Census batch geocoder (free, no key, ≤10k rows/file). */
async function geocodeCensusBatch(rows) {
  const chunks = [];
  for (let i = 0; i < rows.length; i += 9000) chunks.push(rows.slice(i, i + 9000));

  const byNpi = new Map();
  for (const [idx, chunk] of chunks.entries()) {
    const csv = chunk
      .map((r) => [r.npi, r.address_line, r.city, r.state, r.postal_code].map(csvEscape).join(","))
      .join("\n");
    const form = new FormData();
    form.set("benchmark", CENSUS_BENCHMARK);
    form.set("addressFile", new Blob([csv], { type: "text/csv" }), "addresses.csv");

    console.log(`  Census batch ${idx + 1}/${chunks.length} (${chunk.length} rows)…`);
    let text;
    try {
      const res = await fetch(CENSUS_BATCH, { method: "POST", body: form });
      text = await res.text();
    } catch (e) {
      console.warn(`  Census request failed: ${e.message}`);
      continue;
    }
    if (/Request Rejected|<html/i.test(text)) {
      console.warn("  Census rejected the request (firewall/WAF on this network). Falling back to Nominatim for this batch.");
      const nom = await geocodeNominatim(chunk);
      for (const [k, v] of nom) byNpi.set(k, v);
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const f = parseCsvLine(line);
      // id, input, match, matchType, matchedAddr, "lon,lat", tigerId, side
      const isMatch = f[2] === "Match";
      const [lon, lat] = (f[5] || "").split(",").map(parseFloat);
      if (isMatch && Number.isFinite(lat) && Number.isFinite(lon)) {
        byNpi.set(f[0], { latitude: lat, longitude: lon });
      }
    }
  }
  return byNpi;
}

/** Nominatim per-address geocoder — throttled to be a good OSM citizen. */
async function geocodeNominatim(rows) {
  const byNpi = new Map();
  for (const [i, r] of rows.entries()) {
    const u = new URL("https://nominatim.openstreetmap.org/search");
    u.searchParams.set("format", "jsonv2");
    u.searchParams.set("limit", "1");
    u.searchParams.set("countrycodes", "us");
    u.searchParams.set("q", `${r.address_line}, ${r.city}, ${r.state} ${r.postal_code}`);
    try {
      const res = await fetch(u, { headers: { "User-Agent": "SeeMyWait-seed/1.0 (contact@seemywait.com)" } });
      const d = await res.json();
      const lat = d?.[0] ? parseFloat(d[0].lat) : NaN;
      const lon = d?.[0] ? parseFloat(d[0].lon) : NaN;
      if (Number.isFinite(lat) && Number.isFinite(lon)) byNpi.set(r.npi, { latitude: lat, longitude: lon });
    } catch (e) {
      console.warn(`  Nominatim ${r.npi}: ${e.message}`);
    }
    if ((i + 1) % 25 === 0) console.log(`  Nominatim ${i + 1}/${rows.length}`);
    await sleep(1100); // ~1 req/s
  }
  return byNpi;
}

/**
 * Geocode via the deployed `medical-search` edge function's `geocode` action.
 * Runs Census (works from Supabase's egress even when it's WAF-blocked locally)
 * with a Nominatim fallback, and populates `geocode_cache` — so the app reuses
 * these results. Needs SUPABASE_URL + a key.
 */
async function geocodeEdge(rows) {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("--geocoder edge needs SUPABASE_URL and a key in env.");
  const endpoint = `${url.replace(/\/$/, "")}/functions/v1/medical-search`;
  const byNpi = new Map();
  const CONC = 25;
  for (let i = 0; i < rows.length; i += CONC) {
    const chunk = rows.slice(i, i + CONC);
    await Promise.all(
      chunk.map(async (r) => {
        const q = `${r.address_line}, ${r.city}, ${r.state} ${r.postal_code}`.trim();
        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({ action: "geocode", query: q }),
          });
          const d = await res.json();
          const loc = d?.results?.[0]?.geometry?.location;
          if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
            byNpi.set(r.npi, { latitude: loc.lat, longitude: loc.lng });
          }
        } catch (e) {
          console.warn(`  edge geocode ${r.npi}: ${e.message}`);
        }
      }),
    );
    console.log(`  edge geocode ${Math.min(i + CONC, rows.length)}/${rows.length} (${byNpi.size} hit)`);
  }
  return byNpi;
}

function geocode(rows, which) {
  if (which === "edge") return geocodeEdge(rows);
  if (which === "nominatim") return geocodeNominatim(rows);
  return geocodeCensusBatch(rows);
}

/* --------------------------- push --------------------------- */

async function pushToDb(records) {
  const url = process.env.SUPABASE_URL;
  // Accept either the legacy service_role JWT or the new sb_secret_ key.
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("--push needs SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) in env.");
  }
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/clinics?on_conflict=npi`;
  let ok = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(batch),
    });
    if (!res.ok) console.warn(`  upsert ${res.status}: ${await res.text()}`);
    else ok += batch.length;
    console.log(`  upserted ${Math.min(i + 500, records.length)}/${records.length}`);
  }
  return ok;
}

/* ---------------------------- main ---------------------------- */

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.state) { console.error("--state is required (e.g. --state FL)"); process.exit(1); }

  console.log(`NPPES: state=${args.state} city=${JSON.stringify(args.city)} zip=${JSON.stringify(args.zip)} limit=${args.limit}`);
  const rows = await fetchNppes(args);
  console.log(`\nMapped ${rows.length} usable NPPES records.`);
  if (rows.length) console.log("sample:", JSON.stringify(rows[0], null, 2));

  if (args.dryRun) { console.log("\n--dry-run: nothing written."); return; }

  let geo = new Map();
  if (args.geocode) {
    console.log(`\nGeocoding via ${args.geocoder}…`);
    geo = await geocode(rows, args.geocoder);
    console.log(`  geocoded ${geo.size}/${rows.length}`);
  }

  const records = rows
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

  const outPath = resolve(process.cwd(), args.out);
  await mkdir(dirname(outPath), { recursive: true });
  const header = "npi,name,address,city,state,postal_code,specialty,phone,latitude,longitude";
  const body = records
    .map((r) =>
      [r.npi, r.name, r.address, r.city, r.state, r.postal_code, r.specialty, r.phone, r.latitude, r.longitude]
        .map(csvEscape)
        .join(",")
    )
    .join("\n");
  await writeFile(outPath, `${header}\n${body}\n`, "utf8");
  console.log(`\nWrote ${records.length} rows → ${outPath}`);

  if (args.push) {
    if (!records.length) { console.log("nothing to push."); return; }
    console.log("\nUpserting into clinics (on npi)…");
    const n = await pushToDb(records);
    console.log(`Done — ${n} rows upserted.`);
  } else {
    console.log("\nNext: import the CSV via the admin CSV tool, or re-run with --push");
    console.log("      (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env).");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
