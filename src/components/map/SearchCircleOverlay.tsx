import { MapPin, Plus } from "lucide-react";

interface SearchCircleOverlayProps {
  clinicCount: number;
  searchName: string;
  onSuggestClinic: () => void;
}

export function SearchCircleOverlay({ clinicCount, searchName, onSuggestClinic }: SearchCircleOverlayProps) {
  if (clinicCount > 0) return null;

  return (
    <div className="absolute bottom-[140px] left-3 right-3 z-[55] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl p-4 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/20 border border-border/30">
            <MapPin className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-card-foreground">No doctor offices found</p>
            <p className="text-xs text-muted-foreground truncate">
              No registered doctor offices near "{searchName}"
            </p>
          </div>
        </div>
        <button
          onClick={onSuggestClinic}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/20 transition-colors active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Suggest a Doctor Office Here
        </button>
      </div>
    </div>
  );
}
