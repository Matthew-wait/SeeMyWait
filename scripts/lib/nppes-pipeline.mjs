/**
 * Shared geocode + push helpers used by both the live-API seed script
 * (scripts/seed-nppes.mjs) and the bulk-file pipeline
 * (scripts/seed-nppes-bulk.mjs), so the two never drift apart.
 */

const CENSUS_BATCH = "https://geocoding.geo.census.gov/geocoder/locations/addressbatch";
const CENSUS_BENCHMARK = "Public_AR_Current";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const titleCase = (s) =>
  String(s || "").toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());

export const zip5 = (s) => String(s || "").replace(/\D/g, "").slice(0, 5);

export const csvEscape = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Minimal RFC-4180-ish CSV row parser (handles quoted fields with commas). */
export function parseCsvLine(line) {
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

/** Census batch geocoder (free, no key, <=10k rows/file). */
export async function geocodeCensusBatch(rows, { onProgress } = {}) {
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

    onProgress?.(`Census batch ${idx + 1}/${chunks.length} (${chunk.length} rows)…`);
    let text;
    try {
      const res = await fetch(CENSUS_BATCH, { method: "POST", body: form });
      text = await res.text();
    } catch (e) {
      onProgress?.(`  Census request failed: ${e.message}`);
      continue;
    }
    if (/Request Rejected|<html/i.test(text)) {
      onProgress?.("  Census rejected the request (firewall/WAF). Falling back to Nominatim for this batch.");
      const nom = await geocodeNominatim(chunk, { onProgress });
      for (const [k, v] of nom) byNpi.set(k, v);
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const f = parseCsvLine(line);
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
export async function geocodeNominatim(rows, { onProgress } = {}) {
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
      onProgress?.(`  Nominatim ${r.npi}: ${e.message}`);
    }
    if ((i + 1) % 25 === 0) onProgress?.(`  Nominatim ${i + 1}/${rows.length}`);
    await sleep(1100); // ~1 req/s
  }
  return byNpi;
}

export function geocode(rows, which, opts) {
  if (which === "nominatim") return geocodeNominatim(rows, opts);
  return geocodeCensusBatch(rows, opts);
}

/** Bulk upsert into `clinics`, keyed on npi — safe to re-run/resume. */
export async function pushToDb(records, { supabaseUrl, supabaseKey, onProgress } = {}) {
  const url = supabaseUrl || process.env.SUPABASE_URL;
  const key =
    supabaseKey ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("pushToDb needs a Supabase URL and a service-role/secret key.");
  }
  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/clinics?on_conflict=npi`;

  async function postBatch(batch) {
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
    return res;
  }

  // The `on_conflict=npi` upsert still enforces the separate
  // clinics_unique_name_address_lower constraint. One colliding row in a
  // multi-row INSERT rolls back the *whole* statement (Postgres is
  // atomic per statement), which was silently dropping every sibling in
  // that batch too. Halving on a 409/23505 isolates the actual offender
  // instead of discarding everyone sharing its batch, down to single-row
  // inserts where a genuine duplicate is finally just skipped by itself.
  async function postWithRetry(batch, timeoutRetriesLeft = 3) {
    if (!batch.length) return 0;
    const res = await postBatch(batch);
    if (res.ok) return batch.length;

    const text = await res.text();
    const isConflict = res.status === 409 || /23505/.test(text);
    // Statement timeout under heavy concurrent write load (many parallel
    // states hitting the DB at once) — not a data problem, a load one. A
    // short backoff-and-retry at the same size often clears it once load
    // eases; if it keeps timing out, a smaller batch completes faster and
    // is less likely to hit the same ceiling.
    const isTimeout = res.status === 500 && /57014|statement timeout/i.test(text);
    if (isTimeout && timeoutRetriesLeft > 0) {
      await sleep(2000);
      return postWithRetry(batch, timeoutRetriesLeft - 1);
    }

    if ((!isConflict && !isTimeout) || batch.length === 1) {
      if (isConflict) onProgress?.(`  skipped duplicate (name+address already exists): ${batch[0].npi} ${batch[0].name}`);
      else onProgress?.(`  upsert ${res.status}: ${text}`);
      return 0;
    }

    const mid = Math.ceil(batch.length / 2);
    const left = await postWithRetry(batch.slice(0, mid));
    const right = await postWithRetry(batch.slice(mid));
    return left + right;
  }

  let ok = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    ok += await postWithRetry(batch);
    onProgress?.(`  upserted ${Math.min(i + 500, records.length)}/${records.length}`);
  }
  return ok;
}
