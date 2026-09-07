/**
 * Pure NPPES NPI Registry helpers.
 *
 * No `Deno.*`, `fetch`, or Node APIs in this module — it must run unchanged in
 * the edge function (Deno) and in vitest (Node). All I/O is done by the caller;
 * these functions only shape data.
 *
 * NPPES API: https://npiregistry.cms.hhs.gov/api/  (version 2.1, no key required)
 */

export interface NppesAddress {
  address_purpose?: string; // "LOCATION" | "MAILING" | "PRIMARY" | "SECONDARY"
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  telephone_number?: string;
}

export interface NppesTaxonomy {
  code?: string;
  desc?: string;
  primary?: boolean;
}

export interface NppesBasic {
  first_name?: string;
  last_name?: string;
  credential?: string;
  organization_name?: string;
  name?: string;
  status?: string; // "A" active, "D" deactivated
  deactivation_date?: string | null;
}

export interface NppesResult {
  number?: number | string;
  enumeration_type?: string; // "NPI-1" individual | "NPI-2" organisation
  basic?: NppesBasic;
  addresses?: NppesAddress[];
  taxonomies?: NppesTaxonomy[];
}

/** Our internal candidate shape — coordinates are added by the caller after geocoding `address`. */
export interface DirectoryCandidate {
  source: "npi";
  npi: string;
  name: string;
  /** Formatted single-line address: "street suite, city, ST ZIP". */
  address: string;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  specialty: string | null;
  phone: string | null;
}

const US_STATE = /^[A-Za-z]{2}$/;

/** ZIP to 5 digits: "331361234" -> "33136", "33136-1234" -> "33136". */
export function normalizeZip(zip?: string): string {
  return (zip ?? "").replace(/\D/g, "").slice(0, 5);
}

/** Title-case a SCREAMING NPPES string. "MIAMI" -> "Miami", "DR. SMITH" -> "Dr. Smith". */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b[a-z]/g, (m) => m.toUpperCase());
}

/** Stable identity used for name+address dedup — mirrors src/lib/clinic-dedup.ts. */
export function identityKey(name: string, address: string): string {
  return `${name.trim().toLowerCase()}|${address.trim().toLowerCase()}`;
}

export function pickLocationAddress(addresses?: NppesAddress[]): NppesAddress | null {
  if (!Array.isArray(addresses) || addresses.length === 0) return null;
  return (
    addresses.find((a) => a.address_purpose === "LOCATION") ??
    addresses.find((a) => a.address_purpose === "PRIMARY") ??
    addresses[0]
  );
}

export interface AddressParts {
  /** street + suite, title-cased */
  line: string;
  city: string;
  /** 2-letter USPS when recognisable, else as-supplied */
  state: string;
  /** 5-digit ZIP */
  postalCode: string;
  /** "line, city, ST ZIP" */
  formatted: string;
}

export function addressParts(a: NppesAddress | null): AddressParts | null {
  if (!a) return null;
  const line = [a.address_1, a.address_2]
    .filter(Boolean)
    .map((x) => titleCase(String(x).trim()))
    .join(" ")
    .trim();
  const city = a.city ? titleCase(a.city.trim()) : "";
  const state = a.state && US_STATE.test(a.state) ? a.state.toUpperCase() : (a.state ?? "").trim();
  const postalCode = normalizeZip(a.postal_code);
  if (!line && !city) return null;
  const region = [state, postalCode].filter(Boolean).join(" ");
  const formatted = [line, city, region].filter(Boolean).join(", ");
  return { line, city, state, postalCode, formatted };
}

/** Back-compat: the concatenated single-line address (or "" when unavailable). */
export function formatAddress(a: NppesAddress | null): string {
  return addressParts(a)?.formatted ?? "";
}

export function providerName(r: NppesResult): string {
  const b = r.basic ?? {};
  if (r.enumeration_type === "NPI-2" || b.organization_name) {
    return titleCase((b.organization_name ?? b.name ?? "").trim());
  }
  const name = [b.first_name, b.last_name]
    .filter(Boolean)
    .map((x) => titleCase(String(x).trim()))
    .join(" ")
    .trim();
  const cred = (b.credential ?? "").replace(/\.\s*$/, "").trim();
  return cred ? `${name}, ${cred}` : name;
}

export function primarySpecialty(r: NppesResult): string | null {
  const list = r.taxonomies ?? [];
  const primary = list.find((t) => t.primary) ?? list[0];
  return primary?.desc ? titleCase(primary.desc) : null;
}

export function isDeactivated(r: NppesResult): boolean {
  const b = r.basic ?? {};
  return Boolean(b.deactivation_date) || b.status === "D";
}

/** NPPES result -> candidate, or null if it can't be placed on the map. */
export function toCandidate(r: NppesResult): DirectoryCandidate | null {
  const npi = String(r?.number ?? "").trim();
  if (!/^\d{10}$/.test(npi)) return null;
  if (isDeactivated(r)) return null;

  const name = providerName(r);
  if (!name) return null;

  const loc = pickLocationAddress(r.addresses);
  const parts = addressParts(loc);
  if (!parts || !parts.formatted) return null;

  const phone = loc?.telephone_number ? String(loc.telephone_number).trim() : null;
  return {
    source: "npi",
    npi,
    name,
    address: parts.formatted,
    city: parts.city || null,
    state: parts.state || null,
    postalCode: parts.postalCode || null,
    specialty: primarySpecialty(r),
    phone,
  };
}

export interface NppesQuery {
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  taxonomy_description?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  number?: string;
}

/**
 * Free-text search box value -> ordered list of NPPES query param sets to try.
 *
 * - 10 digits            -> exact NPI lookup
 * - "Jane Smith"         -> {first_name: "Jane*", last_name: "Smith*"} then {organization_name: "*Jane Smith*"}
 * - "Smith"              -> {last_name: "Smith*"} then {organization_name: "*Smith*"}
 * - "Miami Pediatrics"   -> {first_name,last_name} attempt + {organization_name: "*Miami Pediatrics*"}
 *
 * NPPES wildcard rule: a trailing/leading `*` needs >= 2 literal chars.
 */
export function buildNppesQueries(raw: string): NppesQuery[] {
  const q = raw.trim().replace(/\s+/g, " ");
  if (/^\d{10}$/.test(q)) return [{ number: q }];
  if (q.length < 2) return [];

  const words = q.split(" ").filter(Boolean);
  const queries: NppesQuery[] = [];

  if (words.length >= 2) {
    const first = words[0];
    const last = words[words.length - 1];
    if (first.length >= 2 && last.length >= 2) {
      queries.push({ first_name: `${first}*`, last_name: `${last}*` });
    }
  } else if (q.length >= 2) {
    queries.push({ last_name: `${q}*` });
  }
  queries.push({ organization_name: `*${q}*` });
  return queries;
}

/** Build a full NPPES API request URL. */
export function nppesUrl(base: string, params: NppesQuery, limit = 20): string {
  const u = new URL(base);
  u.searchParams.set("version", "2.1");
  u.searchParams.set("limit", String(Math.max(1, Math.min(200, limit))));
  for (const [k, v] of Object.entries(params)) {
    if (v) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

/** Straight-line miles between two points (for ranking NPPES hits by proximity). */
export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}
