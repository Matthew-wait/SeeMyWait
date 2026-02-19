import { MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card
      className="cursor-pointer border-border/50 transition-all duration-200 hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
      onClick={() => navigate(`/clinic/${id}`)}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-card-foreground">{name}</h3>
          <p className="truncate text-sm text-muted-foreground">{address}</p>
          <div className="mt-1 flex items-center gap-2">
            {specialty && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                {specialty}
              </Badge>
            )}
            {distance !== undefined && (
              <span className="text-[11px] text-muted-foreground">
                {distance.toFixed(1)} mi
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {waitTime ? (
            <div className="flex flex-col items-end gap-1">
              <WaitTimeBadge category={waitTime.category} />
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(waitTime.lastReported), {
                  addSuffix: true,
                })}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">No reports</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
        </div>
      </CardContent>
    </Card>
  );
}
