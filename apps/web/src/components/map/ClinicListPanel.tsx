import { useEffect, useState } from "react";
import { MapPin, Stethoscope, PanelBottomClose, PanelBottomOpen, ChevronDown, ChevronUp } from "lucide-react";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { WaitTimeCategory, WAIT_TIME_MINUTES_LABEL } from "@/lib/wait-time-utils";

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
  onClinicClick: (clinic: ClinicWithWaitTime) => void;
}

const INITIAL_COUNT = 5;

export function ClinicListPanel({
  clinics,
  nearbyClinics,
  isSearching,
  autoCollapse,
  searchQuery,
  onClinicClick,
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
  const displayList = expanded ? listToShow : listToShow.slice(0, INITIAL_COUNT);
  const canExpandList = listToShow.length > INITIAL_COUNT;

  // Collapsed state - just show a toggle bar
  if (collapsed) {
    return (
      <div className="bg-background border-t border-border/30 pb-24 sm:pb-20">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <PanelBottomOpen className="h-4 w-4" />
          {isSearching
            ? `Show Results (${listToShow.length})`
            : `Show Nearby Doctor Offices (${listToShow.length})`}
        </button>
      </div>
    );
  }

  if (listToShow.length === 0) {
    return (
      <div className="bg-background border-t border-border/30 px-3 py-4 pb-24 sm:pb-20 text-center">
        <p className="text-xs text-muted-foreground">
          {isSearching ? `No results for "${searchQuery}"` : "No nearby doctor offices found. Try searching for a location."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background border-t border-border/30 pb-24 sm:pb-20">
      <div className="flex items-start justify-between gap-2 px-3 pb-1 pt-3">
        <h3 className="min-w-0 text-sm font-semibold text-foreground">
          {isSearching
            ? `${clinics.length} result${clinics.length !== 1 ? "s" : ""} for "${searchQuery}"`
            : `Nearby Doctor Offices (${nearbyClinics.length})`}
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          title="Collapse to see full map"
        >
          <PanelBottomClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={`px-3 pb-2 space-y-2 overflow-y-auto ${expanded ? "max-h-[55vh]" : "max-h-[40vh]"}`}
      >
        {displayList.map((clinic) => {
          const historyOpen = expandedHistory.has(clinic.id);
          const hasHistory = clinic.recentReports && clinic.recentReports.length > 0;
          return (
            <div
              key={clinic.id}
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

      {/*
        "Explore More" toggle used to live in a separate fixed bar above the
        BottomNav, which made the bottom of the screen taller on the map page
        than on the other pages. Embedding it inside the panel keeps the
        BottomNav exactly the same height across the whole app.
      */}
      {canExpandList && (
        <div className="border-t border-border/20 px-3">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="h-9 w-full text-center text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors"
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
