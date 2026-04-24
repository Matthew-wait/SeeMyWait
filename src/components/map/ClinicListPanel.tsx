import { useState } from "react";
import { MapPin, Stethoscope, PanelBottomClose, PanelBottomOpen } from "lucide-react";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { WaitTimeCategory } from "@/lib/wait-time-utils";

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
  searchQuery: string;
  expanded: boolean;
  onClinicClick: (clinic: ClinicWithWaitTime) => void;
}

const INITIAL_COUNT = 5;

export function ClinicListPanel({
  clinics,
  nearbyClinics,
  isSearching,
  searchQuery,
  expanded,
  onClinicClick,
}: ClinicListPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const listToShow = isSearching ? clinics : nearbyClinics;
  const displayList = expanded ? listToShow : listToShow.slice(0, INITIAL_COUNT);

  // Collapsed state - just show a toggle bar
  if (collapsed) {
    return (
      <div className="bg-background border-t border-border/30 pb-24 sm:pb-20">
        <button
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-center gap-2 py-3 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
        >
          <PanelBottomOpen className="h-4 w-4" />
          Show Nearby Clinics ({listToShow.length})
        </button>
      </div>
    );
  }

  if (listToShow.length === 0) {
    return (
      <div className="bg-background border-t border-border/30 px-3 py-4 pb-24 sm:pb-20 text-center">
        <p className="text-xs text-muted-foreground">
          {isSearching ? `No results for "${searchQuery}"` : "No nearby clinics found. Try searching for a location."}
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
            : `Nearby Clinics (${nearbyClinics.length})`}
        </h3>
        <button
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
          title="Collapse to see full map"
        >
          <PanelBottomClose className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="px-3 pb-2 space-y-2 max-h-[40vh] overflow-y-auto">
        {displayList.map((clinic) => (
          <button
            key={clinic.id}
            onClick={() => onClinicClick(clinic)}
            className={`w-full text-left rounded-xl border p-3 transition-all hover:shadow-sm active:scale-[0.99] ${
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
                  {clinic.routeDistance !== undefined ? (
                    <>
                      <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                        Driving {clinic.routeDistance.toFixed(1)} mi
                      </span>
                      <Badge variant="outline" className="h-[18px] px-2 text-[9px]">
                        {clinic.routeDistanceSource === "google" ? "Google route" : "Fallback route"}
                      </Badge>
                    </>
                  ) : (
                    <span className="text-[10px] text-amber-600 font-medium">
                      Driving unavailable
                    </span>
                  )}
                  {clinic.distance !== undefined && (
                    <>
                      <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                        Air {clinic.distance.toFixed(1)} mi
                      </span>
                      <Badge variant="outline" className="h-[18px] px-2 text-[9px]">
                        Air distance
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="min-w-[86px] shrink-0">
                {clinic.waitTime ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <WaitTimeBadge category={clinic.waitTime.category} />
                    <span className="text-right text-[9px] text-muted-foreground">
                      {formatDistanceToNow(new Date(clinic.waitTime.lastReported), { addSuffix: true })}
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground italic">No reports</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
