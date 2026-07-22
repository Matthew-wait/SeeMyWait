import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

import { searchMedicalPlaces, addMedicalPlace, isGooglePlaceId } from "@/lib/medical-search";
import { hasValidCoords } from "@/lib/geolocation";

const NEARBY = { latitude: 25.76, longitude: -80.19 };

const googleRow = (over: Record<string, unknown> = {}) => ({
  source: "google",
  place_id: "ChIJgood",
  name: "Good Clinic",
  address: "1 Main St",
  latitude: 25.76,
  longitude: -80.19,
  ...over,
});

// Block body on purpose: `mockReset()` returns the mock, and Vitest treats a
// function returned from a hook as a teardown callback — it would then *call*
// `invoke()` after each test and orphan the rejected promise.
beforeEach(() => {
  invoke.mockReset();
});

describe("hasValidCoords", () => {
  it("rejects anything Leaflet would throw on", () => {
    expect(hasValidCoords(undefined, undefined)).toBe(false);
    expect(hasValidCoords(NaN, 0)).toBe(false);
    expect(hasValidCoords(null, null)).toBe(false);
    expect(hasValidCoords("25.7", "-80.1")).toBe(false);
    expect(hasValidCoords(Infinity, 0)).toBe(false);
    expect(hasValidCoords(91, 0)).toBe(false);
    expect(hasValidCoords(0, 181)).toBe(false);
  });

  it("accepts real coordinates, including 0,0", () => {
    expect(hasValidCoords(25.76, -80.19)).toBe(true);
    expect(hasValidCoords(0, 0)).toBe(true);
  });
});

describe("isGooglePlaceId", () => {
  it("rejects Nominatim's numeric place_id", () => {
    // Regression: the geocode fallback chain ends at Nominatim, whose JSON has
    // a `place_id` that is an internal OSM integer. It was being written into
    // clinics.google_place_id, poisoning the dedup index.
    expect(isGooglePlaceId("305759221")).toBe(false);
    expect(isGooglePlaceId(305759221)).toBe(false);
  });

  it("rejects empty, short, and whitespace-bearing values", () => {
    expect(isGooglePlaceId("")).toBe(false);
    expect(isGooglePlaceId(null)).toBe(false);
    expect(isGooglePlaceId(undefined)).toBe(false);
    expect(isGooglePlaceId("ChIJ")).toBe(false);
    expect(isGooglePlaceId("ChIJ abc def ghi")).toBe(false);
  });

  it("accepts real Google place id shapes", () => {
    expect(isGooglePlaceId("ChIJN1t_tDeuEmsRUsoyG83frY4")).toBe(true);
    expect(isGooglePlaceId("EicRchIJrTLr-GyuEmsRBfy61i59si0")).toBe(true);
    expect(isGooglePlaceId("GhIJQWDl0CIeQUARxks3icF8U8A")).toBe(true);
  });
});

describe("searchMedicalPlaces", () => {
  it("skips the network entirely below the minimum query length", async () => {
    const res = await searchMedicalPlaces("a", NEARBY);
    expect(invoke).not.toHaveBeenCalled();
    expect(res.results).toEqual([]);
  });

  it("drops rows that would crash the map, keeping the good ones", async () => {
    invoke.mockResolvedValue({
      data: {
        ok: true,
        results: [
          googleRow(),
          googleRow({ place_id: "ChIJnull", latitude: null, longitude: null }),
          googleRow({ place_id: "ChIJnan", latitude: NaN, longitude: 0 }),
          googleRow({ place_id: "ChIJmissing", latitude: undefined, longitude: undefined }),
          { source: "db", id: "", name: "No id", address: "x", latitude: 1, longitude: 1 },
        ],
      },
      error: null,
    });

    const res = await searchMedicalPlaces("holy family", NEARBY);
    expect(res.results).toHaveLength(1);
    expect(res.results[0].name).toBe("Good Clinic");
  });

  it("degrades instead of throwing when invoke rejects", async () => {
    invoke.mockRejectedValue(new Error("network down"));
    const res = await searchMedicalPlaces("holy family", NEARBY);
    expect(res).toEqual({ ok: false, results: [], limited: false, degraded: true });
  });

  it("passes through limited/degraded flags with DB results intact", async () => {
    invoke.mockResolvedValue({
      data: {
        ok: true,
        limited: true,
        results: [{ source: "db", id: "u1", name: "Saved", address: "y", latitude: 25, longitude: -80 }],
      },
      error: null,
    });
    const res = await searchMedicalPlaces("holy family", null);
    expect(res.limited).toBe(true);
    expect(res.results).toHaveLength(1);
  });

  it("tolerates a malformed body with no results array", async () => {
    invoke.mockResolvedValue({ data: { ok: true }, error: null });
    const res = await searchMedicalPlaces("holy family", null);
    expect(res.results).toEqual([]);
  });
});

describe("addMedicalPlace", () => {
  const clinic = {
    id: "uuid-1",
    name: "Good Clinic",
    address: "1 Main St",
    latitude: 25.76,
    longitude: -80.19,
  };

  it("returns the saved clinic on success", async () => {
    invoke.mockResolvedValue({ data: { ok: true, existed: false, clinic }, error: null });
    const res = await addMedicalPlace("ChIJgood");
    expect(res.ok).toBe(true);
    expect(res.clinic?.id).toBe("uuid-1");
  });

  it("treats an idempotent re-add as success", async () => {
    invoke.mockResolvedValue({ data: { ok: true, existed: true, clinic }, error: null });
    const res = await addMedicalPlace("ChIJgood");
    expect(res.ok).toBe(true);
    expect(res.existed).toBe(true);
  });

  it("rejects a success envelope whose clinic cannot be mapped", async () => {
    invoke.mockResolvedValue({
      data: { ok: true, clinic: { ...clinic, latitude: null, longitude: null } },
      error: null,
    });
    const res = await addMedicalPlace("ChIJbad");
    expect(res.ok).toBe(false);
    expect(res.error).toBe("no_coordinates");
  });

  it("surfaces typed failures rather than throwing", async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: "not_medical" }, error: null });
    const res = await addMedicalPlace("ChIJshop");
    expect(res).toMatchObject({ ok: false, error: "not_medical" });
  });

  it("does not leave the caller pending when invoke rejects", async () => {
    invoke.mockRejectedValue(new Error("boom"));
    const res = await addMedicalPlace("ChIJgood");
    expect(res).toEqual({ ok: false, error: "lookup_failed" });
  });
});
