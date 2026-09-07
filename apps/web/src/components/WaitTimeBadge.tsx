import { cn } from "@/lib/utils";
import {
  WaitTimeCategory,
  WAIT_TIME_LABELS,
  WAIT_TIME_COLORS,
} from "@/lib/wait-time-utils";
import { Clock } from "lucide-react";

interface WaitTimeBadgeProps {
  /** `null`/undefined falls back to the green "On Time" default — never a grey state. */
  category?: WaitTimeCategory | null;
  className?: string;
  showIcon?: boolean;
}

export function WaitTimeBadge({ category, className, showIcon = false }: WaitTimeBadgeProps) {
  const cat = category ?? "on_time";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold text-primary-foreground shadow-sm tracking-wide",
        WAIT_TIME_COLORS[cat],
        className
      )}
    >
      {showIcon && <Clock className="h-3 w-3" />}
      {WAIT_TIME_LABELS[cat]}
    </span>
  );
}
