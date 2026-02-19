import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { WaitTimeBadge } from "./WaitTimeBadge";
import { WaitTimeCategory } from "@/lib/wait-time-utils";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface ClinicCardProps {
  id: string;
  name: string;
  address: string;
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
  distance,
  waitTime,
}: ClinicCardProps) {
  const navigate = useNavigate();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/clinic/${id}`)}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <MapPin className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-card-foreground">{name}</h3>
          <p className="truncate text-sm text-muted-foreground">{address}</p>
          {distance !== undefined && (
            <p className="text-xs text-muted-foreground">
              {distance.toFixed(1)} mi away
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
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
        </div>
      </CardContent>
    </Card>
  );
}
