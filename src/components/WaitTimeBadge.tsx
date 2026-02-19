import { cn } from "@/lib/utils";
import {
  WaitTimeCategory,
  WAIT_TIME_LABELS,
  WAIT_TIME_COLORS,
} from "@/lib/wait-time-utils";

interface WaitTimeBadgeProps {
  category: WaitTimeCategory;
  className?: string;
}

export function WaitTimeBadge({ category, className }: WaitTimeBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold text-primary-foreground",
        WAIT_TIME_COLORS[category],
        className
      )}
    >
      {WAIT_TIME_LABELS[category]}
    </span>
  );
}
