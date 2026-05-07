import { Plus, Minus } from "lucide-react";

interface MapZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/**
 * Compact zoom box that sits just above the FindMeButton in the bottom-left
 * corner of the map. Uses the same surface treatment as FindMeButton so the
 * two read as a single control cluster.
 */
export function MapZoomControls({ onZoomIn, onZoomOut }: MapZoomControlsProps) {
  return (
    <div
      className="absolute bottom-16 left-3 z-[50] flex flex-col overflow-hidden rounded-xl border border-border/30 bg-card/90 shadow-lg backdrop-blur-xl"
      role="group"
      aria-label="Map zoom controls"
    >
      <button
        type="button"
        onClick={onZoomIn}
        title="Zoom in"
        aria-label="Zoom in"
        className="flex h-10 w-10 items-center justify-center border-b border-border/20 transition-all hover:bg-muted/40 active:scale-95"
      >
        <Plus className="h-4 w-4 text-foreground" />
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        title="Zoom out"
        aria-label="Zoom out"
        className="flex h-10 w-10 items-center justify-center transition-all hover:bg-muted/40 active:scale-95"
      >
        <Minus className="h-4 w-4 text-foreground" />
      </button>
    </div>
  );
}
