import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const items = [
  { color: "#22c55e", label: "On Time" },
  { color: "#eab308", label: "~30 Min" },
  { color: "#f97316", label: "~1 Hour" },
  { color: "#ef4444", label: "1.5+ Hours" },
  { color: "#94a3b8", label: "No Reports" },
];

export function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-[60px] right-3 z-[50]">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-xl bg-card/90 backdrop-blur-xl border border-border/30 px-3 py-2 text-[11px] font-semibold text-card-foreground shadow-lg transition-all hover:bg-card"
      >
        <div className="flex gap-0.5">
          {items.slice(0, 4).map((i) => (
            <span key={i.label} className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          ))}
        </div>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl bg-card/95 backdrop-blur-xl border border-border/30 p-3 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200 min-w-[140px]">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Wait Time Legend</p>
          <div className="space-y-1.5">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full shrink-0 shadow-sm" style={{ background: item.color }} />
                <span className="text-xs text-card-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
