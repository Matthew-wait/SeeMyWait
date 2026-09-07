import { Crosshair } from "lucide-react";

interface FindMeButtonProps {
  onClick: () => void;
  visible: boolean;
}

export function FindMeButton({ onClick, visible }: FindMeButtonProps) {
  if (!visible) return null;

  return (
    <button
      onClick={onClick}
      className="absolute bottom-4 left-3 z-[50] flex h-10 w-10 items-center justify-center rounded-xl bg-card/90 backdrop-blur-xl border border-border/30 shadow-lg transition-all hover:bg-card active:scale-95"
      title="Center on my location"
    >
      <Crosshair className="h-5 w-5 text-primary" />
    </button>
  );
}
