import { useState } from "react";
import { MapPin, Loader2, X } from "lucide-react";
import { WaitTimeCategory } from "@/lib/wait-time-utils";
import { getCurrentPosition, isWithinRadius } from "@/lib/geolocation";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { supabase } from "@/integrations/supabase/client";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { toast } from "sonner";

const QUICK_OPTIONS: { value: WaitTimeCategory; label: string; emoji: string }[] = [
  { value: "on_time", label: "On Time", emoji: "✅" },
  { value: "30_min", label: "30 Min", emoji: "🟡" },
  { value: "1_hour", label: "1 Hour", emoji: "🟠" },
  { value: "1.5_hours_plus", label: "1.5+ Hrs", emoji: "🔴" },
];

interface ProximityPromptProps {
  clinic: ClinicWithWaitTime;
  onDismiss: () => void;
  onReported: () => void;
}

export function ProximityPrompt({ clinic, onDismiss, onReported }: ProximityPromptProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<WaitTimeCategory | null>(null);

  const handleQuickReport = async (category: WaitTimeCategory) => {
    setSelected(category);
    setSubmitting(true);

    try {
      const pos = await getCurrentPosition();
      if (!isWithinRadius(pos.coords.latitude, pos.coords.longitude, clinic.latitude, clinic.longitude, 150)) {
        toast.error("You're no longer near this clinic.");
        setSubmitting(false);
        setSelected(null);
        return;
      }

      const fingerprint = getDeviceFingerprint();
      const sixtyMinAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("wait_time_reports")
        .select("id")
        .eq("device_fingerprint", fingerprint)
        .gte("reported_at", sixtyMinAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.info("You already reported recently for this clinic.");
        onDismiss();
        return;
      }

      await supabase.from("wait_time_reports").insert({
        clinic_id: clinic.id,
        wait_time: category,
        device_fingerprint: fingerprint,
      });

      toast.success("Thank you! Report submitted.");
      onReported();
    } catch {
      toast.error("Failed to submit report.");
    } finally {
      setSubmitting(false);
      setSelected(null);
    }
  };

  return (
    <div className="absolute bottom-[80px] left-3 right-3 z-[55] mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="rounded-2xl border border-primary/20 bg-card/95 backdrop-blur-xl p-4 shadow-xl shadow-primary/10">
        <button
          onClick={onDismiss}
          className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <MapPin className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-card-foreground">You're near {clinic.name}</p>
            <p className="text-[11px] text-muted-foreground">Report the current wait time?</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`flex flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2 text-[10px] font-semibold transition-all active:scale-95 ${
                selected === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/30 text-card-foreground hover:border-primary/30"
              } ${submitting ? "opacity-50 pointer-events-none" : ""}`}
              disabled={submitting}
              onClick={() => handleQuickReport(opt.value)}
            >
              {submitting && selected === opt.value ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <span className="text-base">{opt.emoji}</span>
              )}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
