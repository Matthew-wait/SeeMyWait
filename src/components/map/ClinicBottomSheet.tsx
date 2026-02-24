import { useState } from "react";
import { MapPin, Clock, Navigation, Loader2, X, Stethoscope, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeCategory } from "@/lib/wait-time-utils";
import { getCurrentPosition, isWithinRadius } from "@/lib/geolocation";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const WAIT_OPTIONS: { value: WaitTimeCategory; label: string; emoji: string }[] = [
  { value: "on_time", label: "On Time", emoji: "✅" },
  { value: "30_min", label: "30 Min", emoji: "🟡" },
  { value: "1_hour", label: "1 Hour", emoji: "🟠" },
  { value: "1.5_hours_plus", label: "1.5+ Hrs", emoji: "🔴" },
];

interface ClinicBottomSheetProps {
  clinic: ClinicWithWaitTime;
  onClose: () => void;
  onReported: () => void;
  userLocation: { lat: number; lng: number } | null;
}

export function ClinicBottomSheet({ clinic, onClose, onReported, userLocation }: ClinicBottomSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<WaitTimeCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isNearby = userLocation
    ? isWithinRadius(userLocation.lat, userLocation.lng, clinic.latitude, clinic.longitude, 150)
    : false;

  const handleReport = async (category: WaitTimeCategory) => {
    setSelectedOption(category);
    setError(null);
    setSubmitting(true);

    try {
      const pos = await getCurrentPosition();
      const withinRange = isWithinRadius(
        pos.coords.latitude, pos.coords.longitude,
        clinic.latitude, clinic.longitude, 150
      );
      if (!withinRange) {
        setError("You must be at or near this clinic to report.");
        setSubmitting(false);
        setSelectedOption(null);
        return;
      }

      if (pos.coords.accuracy > 100) {
        setError("Location signal weak. Move closer to verify.");
        setSubmitting(false);
        setSelectedOption(null);
        return;
      }

      const fingerprint = getDeviceFingerprint();
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("wait_time_reports")
        .select("id")
        .eq("clinic_id", clinic.id)
        .eq("device_fingerprint", fingerprint)
        .gte("reported_at", thirtyMinAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        setError("You already reported recently. Try again in 30 minutes.");
        setSubmitting(false);
        setSelectedOption(null);
        return;
      }

      const { error: insertError } = await supabase.from("wait_time_reports").insert({
        clinic_id: clinic.id,
        wait_time: category,
        device_fingerprint: fingerprint,
      });

      if (insertError) throw insertError;
      toast.success("Thank you! Your report has been submitted.");
      onReported();
    } catch (e) {
      if (!error) toast.error("Failed to submit report.");
    } finally {
      setSubmitting(false);
      setSelectedOption(null);
    }
  };

  const openDirections = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${clinic.latitude},${clinic.longitude}`;
    window.open(url, "_blank");
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-2 mb-[72px] animate-in slide-in-from-bottom-8 duration-400 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-muted/20 text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pb-5 pt-1 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-card-foreground truncate">{clinic.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground truncate">{clinic.address}</p>
              </div>
              {clinic.specialty && (
                <Badge variant="secondary" className="mt-1.5 text-[10px] px-2 py-0 h-[18px] font-medium rounded-md">
                  {clinic.specialty}
                </Badge>
              )}
            </div>
          </div>

          {/* Wait status */}
          <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
            {clinic.waitTime ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <WaitTimeBadge category={clinic.waitTime.category} showIcon />
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(clinic.waitTime.lastReported), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No recent reports — be the first!</p>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive font-medium">{error}</p>
            </div>
          )}

          {/* Report buttons */}
          <div>
            <p className="text-xs font-semibold text-card-foreground mb-2">Report Wait Time</p>
            <div className="grid grid-cols-4 gap-2">
              {WAIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-[11px] font-semibold transition-all duration-200 active:scale-95 ${
                    selectedOption === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/30 bg-card text-card-foreground hover:border-primary/30"
                  } ${submitting ? "opacity-50 pointer-events-none" : ""}`}
                  disabled={submitting}
                  onClick={() => handleReport(opt.value)}
                >
                  {submitting && selectedOption === opt.value ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-lg">{opt.emoji}</span>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Directions button */}
          <Button onClick={openDirections} variant="outline" className="w-full gap-2 rounded-xl">
            <Navigation className="h-4 w-4" />
            Get Directions
          </Button>
        </div>
      </div>
    </div>
  );
}
