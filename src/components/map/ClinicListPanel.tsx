import { useState } from "react";
import { ChevronDown, ChevronUp, MapPin, Stethoscope } from "lucide-react";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ClinicListPanelProps {
  clinics: ClinicWithWaitTime[];
  nearbyClinics: ClinicWithWaitTime[];
  isSearching: boolean;
  searchQuery: string;
  onClinicClick: (clinic: ClinicWithWaitTime) => void;
}

const INITIAL_COUNT = 5;

export function ClinicListPanel({ clinics, nearbyClinics, isSearching, searchQuery, onClinicClick }: ClinicListPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const listToShow = isSearching ? clinics : nearbyClinics;
  const displayList = expanded ? listToShow : listToShow.slice(0, INITIAL_COUNT);
  const hasMore = listToShow.length > INITIAL_COUNT;

  if (listToShow.length === 0) {
    return (
      <div className="bg-background border-t border-border/30 px-3 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          {isSearching ? `No results for "${searchQuery}"` : "No nearby clinics found. Try searching for a location."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-background border-t border-border/30">
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {isSearching
            ? `${clinics.length} result${clinics.length !== 1 ? "s" : ""} for "${searchQuery}"`
            : `Nearby Clinics (${nearbyClinics.length})`}
        </h3>
      </div>
      <div className="px-3 pb-2 space-y-2 max-h-[40vh] overflow-y-auto">
        {displayList.map((clinic) => (
          <button
            key={clinic.id}
            onClick={() => onClinicClick(clinic)}
            className="w-full text-left rounded-xl border border-border/30 bg-card p-3 transition-all hover:border-primary/20 hover:shadow-sm active:scale-[0.99]"
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
                  {clinic.distance !== undefined && (
                    <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                      {clinic.distance.toFixed(1)} mi
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                {clinic.waitTime ? (
                  <div className="flex flex-col items-end gap-0.5">
                    <WaitTimeBadge category={clinic.waitTime.category} />
                    <span className="text-[9px] text-muted-foreground">
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
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors border-t border-border/20"
        >
          {expanded ? (
            <>Show Less <ChevronUp className="h-3.5 w-3.5" /></>
          ) : (
            <>Explore More ({listToShow.length - INITIAL_COUNT} more) <ChevronDown className="h-3.5 w-3.5" /></>
          )}
        </button>
      )}
    </div>
  );
}
