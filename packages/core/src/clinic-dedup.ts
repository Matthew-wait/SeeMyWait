/** Stable identity for duplicate detection; matches DB index on lower(trim(name)), lower(trim(address)). */
export function clinicIdentityKey(name: string, address: string): string {
  return `${name.trim().toLowerCase()}|${address.trim().toLowerCase()}`;
}

export function findDuplicateClinicIdentity<
  T extends { id: string; name: string; address: string },
>(
  rows: T[] | undefined,
  name: string,
  address: string,
  excludeId?: string
): T | undefined {
  const key = clinicIdentityKey(name, address);
  return rows?.find(
    (r) => r.id !== excludeId && clinicIdentityKey(r.name, r.address) === key
  );
}

/**
 * NPI is the stable identity for directory-sourced offices (`clinics.npi`,
 * partial-unique). Prefer this over name+address when an NPI is present.
 */
export function findClinicByNpi<T extends { id: string; npi?: string | null }>(
  rows: T[] | undefined,
  npi: string | null | undefined,
  excludeId?: string
): T | undefined {
  if (!npi || !/^\d{10}$/.test(npi)) return undefined;
  return rows?.find((r) => r.id !== excludeId && r.npi === npi);
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
