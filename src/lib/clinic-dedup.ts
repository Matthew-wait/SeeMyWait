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

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}
