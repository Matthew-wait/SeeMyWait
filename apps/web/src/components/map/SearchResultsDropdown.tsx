import { Loader2, MapPin, Plus, Stethoscope } from "lucide-react";
import { MedicalSearchResult } from "@/lib/medical-search";
import { getDistanceMiles } from "@/lib/geolocation";

interface SearchResultsDropdownProps {
  results: MedicalSearchResult[];
  loading: boolean;
  limited: boolean;
  degraded: boolean;
  /** True once a search for the current query has completed. */
  searched: boolean;
  userLocation: { lat: number; lng: number } | null;
  onSelect: (result: MedicalSearchResult) => void;
  onSuggestClinic: () => void;
}

function formatDistance(
  userLocation: { lat: number; lng: number } | null,
  latitude: number,
  longitude: number
): string | null {
  if (!userLocation) return null;
  const miles = getDistanceMiles(userLocation.lat, userLocation.lng, latitude, longitude);
  // Better to omit the distance than to render "NaN mi".
  if (!Number.isFinite(miles)) return null;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

export function SearchResultsDropdown({
  results,
  loading,
  limited,
  degraded,
  searched,
  userLocation,
  onSelect,
  onSuggestClinic,
}: SearchResultsDropdownProps) {
  if (loading) {
    return (
      <div className="border-t border-border/20 flex items-center gap-2 px-4 py-3">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
        <span className="text-[11px] text-muted-foreground">Searching doctor offices…</span>
      </div>
    );
  }

  if (!searched) return null;

  const notice = limited
    ? "Search limit reached — showing saved offices only."
    : degraded
      ? "Registry search unavailable — showing saved offices."
      : null;

  if (results.length === 0) {
    return (
      <div className="border-t border-border/20 px-4 py-3 space-y-2">
        <p className="text-[11px] text-muted-foreground">
          {notice ?? "No doctor offices found for this search."}
        </p>
        <button
          type="button"
          onClick={onSuggestClinic}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
        >
          <Plus className="h-3 w-3" />
          Suggest a Doctor Office
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border/20">
      {notice && (
        <p className="px-4 pt-2 text-[11px] text-amber-600 dark:text-amber-400">{notice}</p>
      )}
      <ul className="max-h-72 overflow-y-auto py-1">
        {results.map((result) => {
          const key = result.source === "db" ? `db:${result.id}` : `npi:${result.npi}`;
          const distance = formatDistance(userLocation, result.latitude, result.longitude);

          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelect(result)}
                className="flex w-full items-start gap-2.5 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    result.source === "db"
                      ? "bg-primary/10 text-primary"
                      : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  }`}
                >
                  {result.source === "db" ? (
                    <Stethoscope className="h-3.5 w-3.5" />
                  ) : (
                    <MapPin className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-card-foreground">
                    {result.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {result.address}
                    {distance && <span className="text-muted-foreground/70"> · {distance}</span>}
                  </span>
                </span>
                {result.source === "npi" && (
                  <span className="mt-0.5 shrink-0 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                    Verify
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
