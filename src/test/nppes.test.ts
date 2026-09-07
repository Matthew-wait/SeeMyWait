import { describe, it, expect } from "vitest";
import {
  addressParts,
  buildNppesQueries,
  formatAddress,
  identityKey,
  isDeactivated,
  normalizeZip,
  nppesUrl,
  primarySpecialty,
  providerName,
  titleCase,
  toCandidate,
  type NppesResult,
} from "../../supabase/functions/medical-search/nppes.ts";

const individual: NppesResult = {
  number: 1234567893,
  enumeration_type: "NPI-1",
  basic: {
    first_name: "MARIA",
    last_name: "SANTOS",
    credential: "M.D.",
    status: "A",
  },
  addresses: [
    {
      address_purpose: "MAILING",
      address_1: "PO BOX 1",
      city: "MIAMI",
      state: "FL",
      postal_code: "33101",
    },
    {
      address_purpose: "LOCATION",
      address_1: "1500 NW 12TH AVE",
      address_2: "SUITE 3",
      city: "MIAMI",
      state: "FL",
      postal_code: "331361153",
      telephone_number: "305-555-0101",
    },
  ],
  taxonomies: [
    { code: "207Q00000X", desc: "Family Medicine", primary: true },
    { code: "208D00000X", desc: "General Practice", primary: false },
  ],
};

const organisation: NppesResult = {
  number: 1987654320,
  enumeration_type: "NPI-2",
  basic: { organization_name: "MIAMI PEDIATRIC ASSOCIATES", status: "A" },
  addresses: [
    {
      address_purpose: "LOCATION",
      address_1: "8940 N KENDALL DR",
      city: "MIAMI",
      state: "FL",
      postal_code: "33176",
      telephone_number: "3055550102",
    },
  ],
  taxonomies: [{ desc: "Pediatrics", primary: true }],
};

describe("titleCase / normalizeZip", () => {
  it("title-cases screaming strings", () => {
    expect(titleCase("MIAMI")).toBe("Miami");
    expect(titleCase("1500 NW 12TH AVE")).toBe("1500 Nw 12th Ave");
  });
  it("trims ZIP to 5 digits", () => {
    expect(normalizeZip("331361153")).toBe("33136");
    expect(normalizeZip("33136-1234")).toBe("33136");
    expect(normalizeZip(undefined)).toBe("");
  });
});

describe("formatAddress / addressParts", () => {
  it("builds a street, city, state ZIP string from the LOCATION address", () => {
    expect(formatAddress(individual.addresses![1])).toBe(
      "1500 Nw 12th Ave Suite 3, Miami, FL 33136",
    );
  });
  it("returns empty / null for a null address", () => {
    expect(formatAddress(null)).toBe("");
    expect(addressParts(null)).toBeNull();
  });
  it("splits the address into components", () => {
    expect(addressParts(individual.addresses![1])).toEqual({
      line: "1500 Nw 12th Ave Suite 3",
      city: "Miami",
      state: "FL",
      postalCode: "33136",
      formatted: "1500 Nw 12th Ave Suite 3, Miami, FL 33136",
    });
  });
});

describe("providerName", () => {
  it("names an individual with credential", () => {
    expect(providerName(individual)).toBe("Maria Santos, M.D");
  });
  it("names an organisation", () => {
    expect(providerName(organisation)).toBe("Miami Pediatric Associates");
  });
});

describe("primarySpecialty", () => {
  it("prefers the primary taxonomy", () => {
    expect(primarySpecialty(individual)).toBe("Family Medicine");
    expect(primarySpecialty(organisation)).toBe("Pediatrics");
  });
  it("returns null when there are no taxonomies", () => {
    expect(primarySpecialty({ number: 1 } as NppesResult)).toBeNull();
  });
});

describe("isDeactivated", () => {
  it("flags a deactivation date or a D status", () => {
    expect(isDeactivated({ basic: { deactivation_date: "2020-01-01" } } as NppesResult)).toBe(true);
    expect(isDeactivated({ basic: { status: "D" } } as NppesResult)).toBe(true);
    expect(isDeactivated(individual)).toBe(false);
  });
});

describe("toCandidate", () => {
  it("maps an individual, using the LOCATION address and its phone", () => {
    expect(toCandidate(individual)).toEqual({
      source: "npi",
      npi: "1234567893",
      name: "Maria Santos, M.D",
      address: "1500 Nw 12th Ave Suite 3, Miami, FL 33136",
      city: "Miami",
      state: "FL",
      postalCode: "33136",
      specialty: "Family Medicine",
      phone: "305-555-0101",
    });
  });
  it("maps an organisation", () => {
    expect(toCandidate(organisation)).toMatchObject({
      npi: "1987654320",
      name: "Miami Pediatric Associates",
      city: "Miami",
      state: "FL",
      postalCode: "33176",
      specialty: "Pediatrics",
      phone: "3055550102",
    });
  });
  it("drops a deactivated provider", () => {
    expect(toCandidate({ ...individual, basic: { ...individual.basic, deactivation_date: "2021-05-05" } })).toBeNull();
  });
  it("drops a record with no placeable address", () => {
    expect(toCandidate({ number: 1234567893, basic: { last_name: "NOADDR" }, addresses: [] })).toBeNull();
  });
  it("drops a record whose NPI is not 10 digits", () => {
    expect(toCandidate({ ...individual, number: 12345 })).toBeNull();
  });
});

describe("buildNppesQueries", () => {
  it("returns an exact NPI lookup for 10 digits", () => {
    expect(buildNppesQueries("1234567893")).toEqual([{ number: "1234567893" }]);
  });
  it("splits a two-word query into first/last + org fallback", () => {
    expect(buildNppesQueries("Jane Smith")).toEqual([
      { first_name: "Jane*", last_name: "Smith*" },
      { organization_name: "*Jane Smith*" },
    ]);
  });
  it("treats a single word as last name + org fallback", () => {
    expect(buildNppesQueries("Santos")).toEqual([
      { last_name: "Santos*" },
      { organization_name: "*Santos*" },
    ]);
  });
  it("returns nothing for a 1-char query", () => {
    expect(buildNppesQueries("a")).toEqual([]);
  });
});

describe("nppesUrl", () => {
  it("assembles version, limit and params, clamping the limit", () => {
    const url = new URL(nppesUrl("https://npiregistry.cms.hhs.gov/api/", { last_name: "Smith*" }, 999));
    expect(url.searchParams.get("version")).toBe("2.1");
    expect(url.searchParams.get("limit")).toBe("200");
    expect(url.searchParams.get("last_name")).toBe("Smith*");
  });
});

describe("identityKey", () => {
  it("matches src/lib/clinic-dedup.ts: trimmed + lowercased, pipe-joined", () => {
    expect(identityKey("  Dr. X ", " 1 Main St ")).toBe("dr. x|1 main st");
  });
});
