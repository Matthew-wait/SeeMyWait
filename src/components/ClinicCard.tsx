import { MapPin, ChevronRight, Stethoscope } from "lucide-react";
import { WaitTimeBadge } from "./WaitTimeBadge";
import { WaitTimeCategory } from "@/lib/wait-time-utils";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";

interface ClinicCardProps {
  id: string;
  name: string;
  address: string;
  specialty?: string | null;
  distance?: number;
  /** `null`/omitted means no active report — rendered as the green "On Time" default. */
  waitTime?: {
    category: WaitTimeCategory;
    label: string;
    lastReported: string | null;
  } | null;
}

export function ClinicCard({
  id,
  name,
  address,
  specialty,
  distance,
  waitTime,
}: ClinicCardProps) {
  const navigate = useNavigate();

  return (
    <button
      className="group relative w-full text-left rounded-2xl border border-border/30 bg-card p-4 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20 hover:-translate-y-0.5 active:scale-[0.99] sm:p-4"
      onClick={() => navigate(`/clinic/${id}`)}
    >
      <div className="flex items-start gap-3.5">
        {/* Icon */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 mt-0.5 transition-all duration-300 group-hover:shadow-md group-hover:shadow-primary/10">
          <Stethoscope className="h-5 w-5 text-primary" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-card-foreground group-hover:text-primary transition-colors sm:text-[15px]">
            {name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <p className="truncate text-xs">{address}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {specialty && (
              <Badge variant="secondary" className="text-[10px] px-2 py-0 h-[18px] font-medium rounded-md">
                {specialty}
              </Badge>
            )}
            {distance !== undefined && (
              <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                {distance.toFixed(1)} mi away
              </span>
            )}
          </div>
        </div>

        {/* Wait + Arrow */}
        <div className="shrink-0 flex items-center gap-2">
          <div className="flex flex-col items-end gap-1">
            <WaitTimeBadge category={waitTime?.category ?? null} />
            {waitTime?.lastReported && (
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(waitTime.lastReported), {
                  addSuffix: true,
                })}
              </span>
            )}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/60 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </button>
  );
}
