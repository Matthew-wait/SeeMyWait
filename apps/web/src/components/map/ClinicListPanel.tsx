import { useEffect, useState } from "react";
import { MapPin, Stethoscope, PanelBottomClose, PanelBottomOpen, ChevronDown, ChevronUp, LocateFixed, Loader2 } from "lucide-react";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { WaitTimeCategory, WAIT_TIME_MINUTES_LABEL } from "@/lib/wait-time-utils";
import { useWindowedList } from "@/hooks/use-windowed-list";
import { nearbyCountLabel } from "@/lib/nearby-clinics";

const WAIT_BG: Record<WaitTimeCategory, string> = {
  on_time: "bg-green-500/10 border-green-500/25",
  "30_min": "bg-yellow-500/10 border-yellow-500/25",
  "1_hour": "bg-orange-500/10 border-orange-500/25",
  "1.5_hours_plus": "bg-red-500/10 border-red-500/25",
};

interface ClinicListPanelProps {
  clinics: ClinicWithWaitTime[];
  nearbyClinics: ClinicWithWaitTime[];
  isSearching: boolean;
  /** True while the user is actively typing/picking from the results dropdown
   *  — collapse to keep the map in focus. False again once they've picked a
   *  result (or cleared the search), so the match shows automatically instead
   *  of staying hidden behind a "Show Results" tap. */
  autoCollapse: boolean;
  searchQuery: string;
  /** Admin-configured nearby radius, shown so users understand why the
   *  browse list is limited and know to search instead of assuming a doctor
   *  office just isn't in the directory. */
  radiusMiles: number;
  /** False until the browser has actually returned a coordinate. Without
   *  one, "nearby" can't mean anything — the browse list must show a
   *  location prompt instead of an unfiltered, non-nearby fallback list. */
  hasLocation: boolean;
  locating: boolean;
  /** True while the quick 5-mile pass is shown but the full-radius fetch is
   *  still in flight — shows a small "finding more nearby offices" row so
   *  the initial short list doesn't look like the final result. */
  isLoadingMore?: boolean;
  hasMore?: boolean;
  /** Exact count of offices in the radius, from the server (not the loaded rows). */
  total?: number;
  onLoadMore?: () => void;
  loadError?: boolean;
  onRetryLoad?: () => void;
  onClinicClick: (clinic: ClinicWithWaitTime) => void;
  onSuggestClinic: () => void;
  onRetryLocation: () => void;
}

const INITIAL_COUNT = 50;
const LIST_BATCH = 1000;

/** Shared "why is the list limited" note for the default (non-search) browse view. */
function RadiusNotice({ radiusMiles, onSuggestClinic }: { radiusMiles: number; onSuggestClinic: () => void }) {
  const radiusLabel = radiusMiles < 1 ? `${Math.round(radiusMiles * 1609.34)} meters` : `${radiusMiles} miles`;
  return (
    <p className="pt-0 pb-1.5 text-[11px] leading-snug text-muted-foreground">
      You're seeing doctor offices within <span className="font-medium text-foreground">{radiusLabel}</span> of your location.
      Use search to find a specific one further away — and{" "}
      <button
        type="button"
        onClick={onSuggestClinic}
        className="font-medium text-primary underline-offset-2 hover:underline"
      >
        suggest it to the admin
      </button>{" "}
      if it isn't listed yet.
    </p>
  );
}

export function ClinicListPanel({
  clinics,
  nearbyClinics,
  isSearching,
  autoCollapse,
  searchQuery,
  radiusMiles,
  hasLocation,
  locating,
  isLoadingMore = false,
  hasMore = false,
  total,
  onLoadMore,
  loadError = false,
  onRetryLoad,
  onClinicClick,
  onSuggestClinic,
  onRetryLocation,
}: ClinicListPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set());

  // Collapse while the user is actively typing/browsing the dropdown so the
  // map keeps focus, then auto-expand as soon as they pick a result (or clear
  // the search) so a match shows immediately instead of needing an extra tap.
  useEffect(() => {
    setCollapsed(autoCollapse);
  }, [autoCollapse]);

  const toggleHistory = (id: string) => {
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const listToShow = isSearching ? clinics : nearbyClinics;
  const [listCap, setListCap] = useState(LIST_BATCH);
  const displayList = expanded ? listToShow.slice(0, listCap) : listToShow.slice(0, INITIAL_COUNT);
  const windowed = useWindowedList(displayList, expanded);
  const canExpandList = listToShow.length > INITIAL_COUNT;
  // The browse view now also carries the radius notice above the list, so its
  // scroll area gets a smaller cap than search results (which don't show that
  // notice) — otherwise the extra height pushed "Explore More" far enough
  // down to be clipped by the page's overflow-hidden root, behind BottomNav.
  const listMaxHeightClass = isSearching
    ? expanded
      ? "max-h-[55vh]"
      : "max-h-[40vh]"
    : expanded
      ? "max-h-[49vh]"
      : "max-h-[34vh]";

  // Collapsed state - just show a toggle bar
  if (collapsed) {
    return (
      <div className="shrink-0 bg-background border-t border-border/30">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <PanelBottomOpen className="h-4 w-4" />
          {isSearching
            ? `Show Results (${listToShow.length})`
            : `Show Nearby Doctor Offices (${nearbyCountLabel(listToShow.length, hasMore)})`}
        </button>
      </div>
    );
  }

  // Location genuinely unknown (denied/failed/still resolving) and not
  // searching: never show the raw, non-geo fallback list as if it were
  // "nearby" — ask for location instead, with a way to retry or search.
  if (!isSearching && !hasLocation) {
    return (
      <div className="shrink-0 bg-background border-t border-border/30 px-3 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          We couldn't determine your location, so nearby doctor offices can't be shown reliably.
          Enable location access, or use search to find a specific one by name.
        </p>
        <button
          type="button"
          onClick={onRetryLocation}
          disabled={locating}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {locating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
          {locating ? "Locating…" : "Enable Location"}
        </button>
      </div>
    );
  }

  if (listToShow.length === 0 && loadError) {
    return <div className="shrink-0 bg-background border-t border-border/30 pb-4 text-center">
      <p className="px-3 pt-4 text-xs text-muted-foreground">Nearby doctor offices could not be loaded.</p>
      <button onClick={onRetryLoad} className="px-3 py-2 text-xs font-semibold text-primary">Try Again</button>
    </div>;
  }
  if (listToShow.length === 0) {
    // The quick 5-mile pass came back empty, but the full-radius fetch is
    // still running — don't tell the user "none found" when more could
    // still show up any second.
    if (!isSearching && isLoadingMore) {
      return (
        <div className="shrink-0 bg-background border-t border-border/30 pb-4 text-center">
          <div className="flex items-center justify-center gap-2 px-3 pt-4 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Looking for nearby doctor offices…
          </div>
        </div>
      );
    }
    return (
      <div className="shrink-0 bg-background border-t border-border/30 pb-4 text-center">
        <p className="px-3 pt-4 text-xs text-muted-foreground">
          {isSearching ? `No results for "${searchQuery}"` : "No nearby doctor offices found."}
        </p>
        {!isSearching && (
          <div className="text-left">
            <RadiusNotice radiusMiles={radiusMiles} onSuggestClinic={onSuggestClinic} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 max-h-[60dvh] flex-col bg-background border-t border-border/30">
      <div className="shrink-0 flex items-start justify-between gap-2 px-3 pb-0 pt-1.5">
        <div className="min-w-0">
          <h3 className="min-w-0 text-sm font-semibold text-foreground">
            {isSearching
              ? `${clinics.length} result${clinics.length !== 1 ? "s" : ""} for "${searchQuery}"`
              : `Nearby Doctor Offices (${total !== undefined ? total.toLocaleString("en-US") : nearbyCountLabel(nearbyClinics.length, hasMore)})`}
          </h3>
          {!isSearching && hasLocation && <RadiusNotice radiusMiles={radiusMiles} onSuggestClinic={onSuggestClinic} />}
          {!isSearching && isLoadingMore && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Finding more within {radiusMiles} {radiusMiles === 1 ? "mile" : "miles"}…
            </p>
          )}
          {loadError && <p className="mt-0.5 text-[10px] text-muted-foreground">
            Some offices are still missing. <button onClick={onRetryLoad} className="text-primary">Try Again</button>
          </p>}
        </div>
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          title="Collapse to see full map"
        >
          <PanelBottomClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        ref={windowed.ref}
        className={`min-h-0 flex-1 px-3 pb-1 overflow-y-auto ${listMaxHeightClass}`}
      >
        <div style={{ height: windowed.top }} />
        <div className="space-y-2">
        {displayList.slice(windowed.start, windowed.end).map((clinic) => {
          const historyOpen = expandedHistory.has(clinic.id);
          const hasHistory = clinic.recentReports && clinic.recentReports.length > 0;
          return (
            <div
              key={clinic.id}
              data-clinic-row={clinic.id}
              role="button"
              tabIndex={0}
              onClick={() => onClinicClick(clinic)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClinicClick(clinic);
                }
              }}
              className={`w-full cursor-pointer text-left rounded-xl border p-3 transition-all hover:shadow-sm active:scale-[0.99] ${
                clinic.waitTime ? WAIT_BG[clinic.waitTime.category] : "border-border/30 bg-card"
              } hover:border-primary/20`}
            >
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/10">
                  <Stethoscope className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-card-foreground">{clinic.name}</p>
                  <div className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <p className="truncate text-xs">{clinic.address}</p>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {clinic.specialty && (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0 h-[18px] font-medium rounded-md">
                        {clinic.specialty}
                      </Badge>
                    )}
                    {/* Only render a distance line when we actually have one — never "n/a". */}
                    {Number.isFinite(clinic.distance) && (
                      <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                        {clinic.distance! < 10
                          ? `${clinic.distance!.toFixed(1)} mi`
                          : `${Math.round(clinic.distance!)} mi`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="min-w-[86px] shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <WaitTimeBadge category={clinic.waitTime?.category ?? null} />
                    {clinic.waitTime?.lastReported && (
                      <span className="text-right text-[9px] text-muted-foreground">
                        {formatDistanceToNow(new Date(clinic.waitTime.lastReported), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {hasHistory && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHistory(clinic.id);
                    }}
                    aria-expanded={historyOpen}
                    className="flex w-full items-center justify-between rounded-lg px-1 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-primary"
                  >
                    <span>
                      View last 3hr reports ({clinic.recentReports.length})
                    </span>
                    {historyOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {historyOpen && (
                    <div className="mt-1.5 space-y-1">
                      {clinic.recentReports.map((r, idx) => (
                        <div
                          key={`${r.reported_at}-${idx}`}
                          className="flex items-center justify-between rounded-lg bg-background/50 px-2 py-1 text-[11px]"
                        >
                          <span className="font-mono tabular-nums text-muted-foreground">
                            {format(new Date(r.reported_at), "HH:mm")}
                          </span>
                          <span className="font-semibold text-card-foreground">
                            {r.wait_time
                              ? WAIT_TIME_MINUTES_LABEL[r.wait_time]
                              : "No report value"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </div>
        <div style={{ height: windowed.bottom }} />
        {!isSearching && expanded && listToShow.length > listCap && (
          <div className="pt-1 pb-1 text-center">
            <button type="button" disabled={isLoadingMore} onClick={() => { setListCap((c) => c + LIST_BATCH); if (hasMore) onLoadMore?.(); }}
              className="h-7 px-3 rounded-lg text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-50">
              {isLoadingMore ? "Loading…" : "Load more (next 1,000)"}
            </button>
          </div>
        )}
      </div>

      {/*
        "Explore More" toggle used to live in a separate fixed bar above the
        BottomNav, which made the bottom of the screen taller on the map page
        than on the other pages. Embedding it inside the panel keeps the
        BottomNav exactly the same height across the whole app.
      */}
      {canExpandList && (
        <div className="shrink-0 border-t border-border/20 px-3">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="h-8 w-full text-center text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors"
          >
            {expanded
              ? "Show Less"
              : `Explore More (${listToShow.length - INITIAL_COUNT} more)`}
          </button>
        </div>
      )}
    </div>
  );
}
