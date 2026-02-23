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
  waitTime?: {
    category: WaitTimeCategory;
    label: string;
    lastReported: string;
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
      className="group relative w-full text-left rounded-2xl border border-border/40 bg-card p-3.5 transition-all duration-200 hover:shadow-md hover:shadow-primary/5 hover:border-primary/20 active:scale-[0.99] sm:p-4"
      onClick={() => navigate(`/clinic/${id}`)}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 mt-0.5">
          <Stethoscope className="h-5 w-5 text-primary" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-card-foreground group-hover:text-primary transition-colors sm:text-[15px]">
            {name}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-muted-foreground">
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
        <div className="shrink-0 flex items-center gap-1.5">
          {waitTime ? (
            <div className="flex flex-col items-end gap-1">
              <WaitTimeBadge category={waitTime.category} />
              <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(waitTime.lastReported), {
                  addSuffix: true,
                })}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-muted-foreground whitespace-nowrap italic">No reports</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
        </div>
      </div>
    </button>
  );
}
