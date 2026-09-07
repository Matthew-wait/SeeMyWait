import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildNppesQueries,
  haversineMiles,
  identityKey,
  isDeactivated,
  nppesUrl,
  toCandidate,
  type NppesResult,
} from "./nppes.ts";

/**
 * `medical-search` — the directory backend after the Google Places -> NPPES swap
 * (cost-reduction plan, Phase 2). No Google key. Actions:
 *
 *   search       DB-first place search; tops up thin results from the NPPES NPI
 *                Registry, geocoding each hit so it can be pinned.
 *   add          Save an NPPES provider (by NPI) into `clinics`. Idempotent on `npi`.
 *   geocode      address -> { lat, lng }         (Census -> Nominatim, cached)
 *   reverse      { lat, lng } -> { address }     (Nominatim)
 *   autocomplete address type-ahead              (Photon; returns coords inline)
 *
 * Always answers HTTP 200 with a typed envelope (except 400 on missing input for
 * geocode/reverse, which those callers handle). `verify_jwt = false`.
 */

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
};

const NPPES_BASE = Deno.env.get("NPPES_API_BASE") || "https://npiregistry.cms.hhs.gov/api/";
const NOMINATIM_BASE = Deno.env.get("NOMINATIM_BASE") || "https://nominatim.openstreetmap.org";
const CENSUS_ONELINE =
  "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
const GEOCODE_UA =
  Deno.env.get("GEOCODE_USER_AGENT") || "SeeMyWait/1.0 (+https://seemywait.com)";
const PHOTON_BASE = Deno.env.get("PHOTON_BASE") || "https://photon.komoot.io/api";

/** How long a cached geocode (incl. a negative result) stays valid. */
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** DB hits at/above this count skip the NPPES round-trip entirely. */
const DB_ENOUGH = 5;
/** Cap on NPPES candidates we bother geocoding per search. */
const NPPES_GEOCODE_CAP = 6;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function admin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function normalizeGeoQuery(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

interface GeoHit {
  lat: number;
  lng: number;
  provider: string;
}

async function geocodeViaCensus(address: string): Promise<GeoHit | null> {
  const u = new URL(CENSUS_ONELINE);
  u.searchParams.set("address", address);
  u.searchParams.set("benchmark", "Public_AR_Current");
  u.searchParams.set("format", "json");
  const res = await fetch(u.toString());
  if (!res.ok) return null;
  const text = await res.text();
  // The Census geocoder sits behind a WAF that can answer 200 with an HTML
  // "Request Rejected" page from some networks — bail to the Nominatim fallback.
  if (!text.trim().startsWith("{")) return null;
  const data = JSON.parse(text);
  const c = data?.result?.addressMatches?.[0]?.coordinates;
  if (c && typeof c.y === "number" && typeof c.x === "number") {
    return { lat: c.y, lng: c.x, provider: "census" };
  }
  return null;
}

async function geocodeViaNominatim(query: string): Promise<GeoHit | null> {
  const u = new URL(`${NOMINATIM_BASE}/search`);
  u.searchParams.set("format", "jsonv2");
  u.searchParams.set("limit", "1");
  u.searchParams.set("countrycodes", "us");
  u.searchParams.set("q", query);
  const res = await fetch(u.toString(), { headers: { "User-Agent": GEOCODE_UA } });
  if (!res.ok) return null;
  const data = await res.json();
  const first = Array.isArray(data) ? data[0] : null;
  const lat = first ? parseFloat(first.lat) : NaN;
  const lng = first ? parseFloat(first.lon) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng)
    ? { lat, lng, provider: "nominatim" }
    : null;
}

/**
 * Cached geocode. `addressLike` routes US street addresses to the Census
 * geocoder first (no rate limit, address-tuned); everything else, and any
 * Census miss, falls through to Nominatim. A NULL lat/lng row is a negative
 * cache entry — we looked it up and got nothing.
 */
async function geocodeCached(
  sb: SupabaseClient,
  query: string,
  opts: { addressLike?: boolean } = {},
): Promise<GeoHit | null> {
  const norm = normalizeGeoQuery(query);
  if (!norm) return null;
  const hash = await sha256Hex(norm);

  const { data: row } = await sb
    .from("geocode_cache")
    .select("latitude, longitude, provider, fetched_at")
    .eq("query_hash", hash)
    .maybeSingle();

  if (row && Date.now() - new Date(row.fetched_at).getTime() < CACHE_TTL_MS) {
    if (row.latitude === null || row.longitude === null) return null;
    return { lat: row.latitude, lng: row.longitude, provider: row.provider ?? "cache" };
  }

  let hit: GeoHit | null = null;
  try {
    if (opts.addressLike) hit = await geocodeViaCensus(query);
    if (!hit) hit = await geocodeViaNominatim(query);
  } catch {
    hit = null;
  }

  await sb.from("geocode_cache").upsert(
    {
      query_hash: hash,
      query: norm,
      latitude: hit?.lat ?? null,
      longitude: hit?.lng ?? null,
      provider: hit?.provider ?? "none",
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "query_hash" },
  );

  return hit;
}

/* ------------------------------- actions -------------------------------- */

async function handleSearch(sb: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const query = String(body.query ?? "").trim();
  const rawLoc = body.location as { latitude?: number; longitude?: number } | null | undefined;
  const location =
    rawLoc && typeof rawLoc.latitude === "number" && typeof rawLoc.longitude === "number"
      ? { lat: rawLoc.latitude, lng: rawLoc.longitude }
      : null;

  if (query.length < 2) {
    return json({ ok: true, results: [], limited: false, degraded: false });
  }

  // ── DB first ──
  const safe = query.replace(/[,()*%]/g, " ").trim();
  const { data: dbRows } = await sb
    .from("clinics")
    .select("id, name, address, latitude, longitude, npi")
    .eq("is_active", true)
    .or(`name.ilike.*${safe}*,address.ilike.*${safe}*`)
    .limit(10);

  const dbResults = (dbRows ?? []).map((c) => ({
    source: "db" as const,
    id: c.id,
    name: c.name,
    address: c.address,
    latitude: c.latitude,
    longitude: c.longitude,
  }));

  if (dbResults.length >= DB_ENOUGH) {
    return json({ ok: true, results: dbResults, limited: false, degraded: false });
  }

  const knownNpi = new Set((dbRows ?? []).map((c) => c.npi).filter(Boolean) as string[]);
  const knownIdentity = new Set((dbRows ?? []).map((c) => identityKey(c.name, c.address)));

  // ── NPPES top-up ──
  let degraded = false;
  let npiResults: Array<Record<string, unknown>> = [];

  try {
    const queries = buildNppesQueries(query).slice(0, 2);
    const seen = new Set<string>();
    const raw: NppesResult[] = [];

    for (const q of queries) {
      const res = await fetch(nppesUrl(NPPES_BASE, q, 15));
      if (!res.ok) {
        degraded = true;
        continue;
      }
      const data = await res.json();
      for (const r of (data?.results ?? []) as NppesResult[]) {
        const npi = String(r?.number ?? "");
        if (npi && !seen.has(npi)) {
          seen.add(npi);
          raw.push(r);
        }
      }
    }

    const candidates = raw
      .map(toCandidate)
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .filter((c) => !knownNpi.has(c.npi) && !knownIdentity.has(identityKey(c.name, c.address)))
      .slice(0, NPPES_GEOCODE_CAP);

    const geocoded = await Promise.allSettled(
      candidates.map(async (c) => {
        const hit = await geocodeCached(sb, c.address, { addressLike: true });
        return hit
          ? {
              source: "npi" as const,
              npi: c.npi,
              name: c.name,
              address: c.address,
              city: c.city,
              state: c.state,
              postal_code: c.postalCode,
              latitude: hit.lat,
              longitude: hit.lng,
              specialty: c.specialty,
              phone: c.phone,
            }
          : null;
      }),
    );

    npiResults = geocoded
      .filter(
        (r): r is PromiseFulfilledResult<Record<string, unknown>> =>
          r.status === "fulfilled" && r.value !== null,
      )
      .map((r) => r.value);

    if (location) {
      npiResults.sort(
        (a, b) =>
          haversineMiles(location, { lat: a.latitude as number, lng: a.longitude as number }) -
          haversineMiles(location, { lat: b.latitude as number, lng: b.longitude as number }),
      );
    }
  } catch {
    degraded = true;
  }

  return json({
    ok: true,
    results: [...dbResults, ...npiResults].slice(0, 15),
    limited: false,
    degraded,
  });
}

interface ClinicRow {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  specialty: string | null;
  npi: string | null;
  google_place_id: string | null;
  is_active: boolean;
}

function toAddedClinic(c: Partial<ClinicRow> & { id: string }) {
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    city: c.city ?? null,
    state: c.state ?? null,
    postal_code: c.postal_code ?? null,
    latitude: c.latitude,
    longitude: c.longitude,
    phone: c.phone ?? null,
    specialty: c.specialty ?? null,
    npi: c.npi ?? null,
    google_place_id: c.google_place_id ?? null,
    source: "npi",
    verified: true,
    is_active: c.is_active ?? true,
  };
}

async function handleAdd(sb: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const npi = String(body.npi ?? body.placeId ?? "").trim();
  if (!/^\d{10}$/.test(npi)) return json({ ok: false, error: "lookup_failed" });

  // Already saved by NPI?
  const { data: existing } = await sb
    .from("clinics")
    .select("*")
    .eq("npi", npi)
    .maybeSingle();
  if (existing) {
    return json({ ok: true, existed: true, clinic: toAddedClinic(existing as ClinicRow) });
  }

  // Look the provider up.
  let record: NppesResult | null = null;
  try {
    const res = await fetch(nppesUrl(NPPES_BASE, { number: npi }, 1));
    const data = await res.json();
    record = (data?.results?.[0] as NppesResult) ?? null;
  } catch {
    return json({ ok: false, error: "lookup_failed" });
  }
  if (!record) return json({ ok: false, error: "lookup_failed" });

  const cand = toCandidate(record);
  if (!cand) {
    return json({
      ok: false,
      error: isDeactivated(record) ? "permanently_closed" : "not_medical",
    });
  }

  const hit = await geocodeCached(sb, cand.address, { addressLike: true });
  if (!hit) return json({ ok: false, error: "no_coordinates" });

  // Same name+address already in the directory (no NPI yet) -> adopt it.
  const idKey = identityKey(cand.name, cand.address);
  const { data: allRows } = await sb.from("clinics").select("*");
  const twin = (allRows ?? []).find(
    (c) => identityKey((c as ClinicRow).name, (c as ClinicRow).address) === idKey,
  ) as ClinicRow | undefined;
  if (twin) {
    if (!twin.npi) await sb.from("clinics").update({ npi }).eq("id", twin.id);
    return json({ ok: true, existed: true, clinic: toAddedClinic({ ...twin, npi }) });
  }

  const { data: inserted, error } = await sb
    .from("clinics")
    .insert({
      name: cand.name,
      address: cand.address,
      city: cand.city,
      state: cand.state,
      postal_code: cand.postalCode,
      latitude: hit.lat,
      longitude: hit.lng,
      phone: cand.phone,
      specialty: cand.specialty,
      npi,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) {
    // Lost an insert race on the partial-unique npi index — return the winner.
    if ((error as { code?: string }).code === "23505") {
      const { data: race } = await sb.from("clinics").select("*").eq("npi", npi).maybeSingle();
      if (race) {
        return json({ ok: true, existed: true, clinic: toAddedClinic(race as ClinicRow) });
      }
    }
    return json({ ok: false, error: "insert_failed" });
  }

  return json({ ok: true, existed: false, clinic: toAddedClinic(inserted as ClinicRow) });
}

async function handleGeocode(sb: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const query = String(body.query ?? "").trim();
  if (!query) return json({ error: "query is required" }, 400);

  const hit = await geocodeCached(sb, query, { addressLike: true });
  if (!hit) return json({ results: [], provider: "none" });

  return json({
    results: [
      {
        formatted_address: query,
        geometry: { location: { lat: hit.lat, lng: hit.lng } },
        place_id: null,
      },
    ],
    provider: hit.provider,
  });
}

async function handleReverse(body: Record<string, unknown>): Promise<Response> {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: "lat and lng are required" }, 400);
  }
  try {
    const u = new URL(`${NOMINATIM_BASE}/reverse`);
    u.searchParams.set("format", "jsonv2");
    u.searchParams.set("lat", String(lat));
    u.searchParams.set("lon", String(lng));
    const res = await fetch(u.toString(), { headers: { "User-Agent": GEOCODE_UA } });
    const data = await res.json();
    return json({ address: data?.display_name ?? null, placeId: null });
  } catch {
    return json({ address: null, placeId: null });
  }
}

async function handleAutocomplete(body: Record<string, unknown>): Promise<Response> {
  const query = String(body.query ?? "").trim();
  if (query.length < 3) return json({ ok: true, predictions: [] });

  const rawLoc = body.location as { latitude?: number; longitude?: number } | null | undefined;
  try {
    const u = new URL(PHOTON_BASE);
    u.searchParams.set("q", query);
    u.searchParams.set("limit", "8");
    if (rawLoc && typeof rawLoc.latitude === "number") {
      u.searchParams.set("lat", String(rawLoc.latitude));
      u.searchParams.set("lon", String(rawLoc.longitude));
    }
    const res = await fetch(u.toString(), { headers: { "User-Agent": GEOCODE_UA } });
    const data = await res.json();

    const predictions = ((data?.features ?? []) as Array<Record<string, any>>)
      .map((f) => {
        const p = f?.properties ?? {};
        const coords = f?.geometry?.coordinates ?? [];
        const lng = coords[0];
        const lat = coords[1];
        const description = [
          p.name,
          [p.housenumber, p.street].filter(Boolean).join(" ").trim() || null,
          p.city ?? p.county,
          p.state,
          p.postcode,
        ]
          .filter(Boolean)
          .join(", ");
        const hasCoords = typeof lat === "number" && typeof lng === "number";
        return {
          description,
          // Synthetic id the client can resolve locally, no details round-trip.
          place_id: hasCoords ? `geo:${lat},${lng}` : "",
          latitude: hasCoords ? lat : null,
          longitude: hasCoords ? lng : null,
        };
      })
      .filter((x) => x.description && x.place_id);

    return json({ ok: true, predictions });
  } catch {
    return json({ ok: true, predictions: [] });
  }
}

/* -------------------------------- entry --------------------------------- */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body?.action ?? "");
    const sb = admin();

    switch (action) {
      case "search":
        return await handleSearch(sb, body);
      case "add":
        return await handleAdd(sb, body);
      case "geocode":
        return await handleGeocode(sb, body);
      case "reverse":
        return await handleReverse(body);
      case "autocomplete":
        return await handleAutocomplete(body);
      default:
        return json(
          { ok: false, error: "Invalid action. Use: search, add, geocode, reverse, autocomplete" },
          400,
        );
    }
  } catch (error) {
    // Keep the typed-envelope contract: the client branches on the body, not the status.
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
