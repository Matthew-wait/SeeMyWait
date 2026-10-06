import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MapPin, Stethoscope, X } from "lucide-react";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { WAIT_TIME_BG_COLORS } from "@/lib/wait-time-utils";

interface ClinicStackPickerProps {
  clinics: ClinicWithWaitTime[];
  /** Viewport pixel position of the tapped pin, to anchor the popup near it. */
  anchor: { x: number; y: number };
  onSelect: (clinic: ClinicWithWaitTime) => void;
  onClose: () => void;
}

/** Small popup shown when a pin is standing in for 2+ offices at the same
 *  spot (e.g. same building) — lets the user pick which one to open/report
 *  on, instead of only ever reaching whichever one happened to render on top. */
export function ClinicStackPicker({ clinics, anchor, onSelect, onClose }: ClinicStackPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [onClose]);

  // Keep the popup on screen even when the tapped pin is near an edge — and
  // never under the floating search bar, which sits in roughly the top 80px
  // of the map regardless of how close to the top the tapped pin is.
  const width = 272;
  const SEARCH_BAR_CLEARANCE = 80;
  const left = Math.max(12, Math.min(anchor.x - width / 2, window.innerWidth - width - 12));
  const openUpward = anchor.y > 320;

  // Portaled to <body> (position: fixed, viewport-relative coords) so the
  // popup is never clipped by a map container with overflow-hidden — the
  // admin dashboard's rounded-corner map has one, the public page's doesn't.
  return createPortal(
    <div
      ref={ref}
      className="pointer-events-auto fixed z-[80] animate-in fade-in zoom-in-95 duration-150 rounded-2xl border border-border/40 bg-card/95 shadow-2xl backdrop-blur-xl"
      style={{
        left,
        width,
        top: openUpward ? undefined : Math.max(anchor.y + 12, SEARCH_BAR_CLEARANCE),
        bottom: openUpward ? `calc(100% - ${anchor.y - 12}px)` : undefined,
      }}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/20 px-3 py-2">
        <p className="text-xs font-semibold text-foreground">{clinics.length} doctor offices at this spot</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto p-1.5">
        {clinics.map((clinic) => (
          <button
            key={clinic.id}
            type="button"
            onClick={() => onSelect(clinic)}
            className={`mb-1.5 flex w-full items-start gap-2.5 rounded-xl border px-2 py-2 text-left transition-colors last:mb-0 hover:brightness-95 ${
              clinic.waitTime ? WAIT_TIME_BG_COLORS[clinic.waitTime.category] : "border-border/30 bg-card"
            }`}
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 border border-primary/10">
              <Stethoscope className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-card-foreground">{clinic.name}</p>
              {clinic.specialty && (
                <p className="truncate text-[11px] text-muted-foreground">{clinic.specialty}</p>
              )}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5 shrink-0" />
                  {clinic.address}
                </span>
                <WaitTimeBadge category={clinic.waitTime?.category ?? null} className="shrink-0 text-[9px]" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
