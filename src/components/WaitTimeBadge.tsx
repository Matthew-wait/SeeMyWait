import { cn } from "@/lib/utils";
import {
  WaitTimeCategory,
  WAIT_TIME_LABELS,
  WAIT_TIME_COLORS,
} from "@/lib/wait-time-utils";
import { Clock } from "lucide-react";

interface WaitTimeBadgeProps {
  category: WaitTimeCategory;
  className?: string;
  showIcon?: boolean;
}

export function WaitTimeBadge({ category, className, showIcon = false }: WaitTimeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform hover:scale-105",
        WAIT_TIME_COLORS[category],
        className
      )}
    >
      {showIcon && <Clock className="h-3 w-3" />}
      {WAIT_TIME_LABELS[category]}
    </span>
  );
}
