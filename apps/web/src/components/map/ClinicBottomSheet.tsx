import { useState, useEffect } from "react";
import { MapPin, Navigation, Loader2, X, Stethoscope, AlertTriangle, TimerOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";
import { WaitTimeCategory } from "@/lib/wait-time-utils";
import { getCurrentPosition, getFreshPosition, isWithinRadius } from "@/lib/geolocation";
import { directionsUrl, viewOnMapUrl } from "@/lib/medical-search";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  REPORT_WAIT_GEOFENCE_METERS,
  REPORT_MAX_GPS_ACCURACY_METERS,
} from "@/lib/report-geofence";

const WAIT_OPTIONS: { value: WaitTimeCategory; label: string; emoji: string }[] = [
  { value: "on_time", label: "On Time", emoji: "🟢" },
  { value: "30_min", label: "30 min", emoji: "🟡" },
  { value: "1_hour", label: "60 min", emoji: "🟠" },
  { value: "1.5_hours_plus", label: "90+ min", emoji: "🔴" },
];

type ReportEligibility =
  | "loading"
  | "ready"
  | "too_far"
  | "low_accuracy"
  | "gps_off";

interface ClinicBottomSheetProps {
  clinic: ClinicWithWaitTime;
  onClose: () => void;
  onReported: () => void;
  cooldownMinutes?: number;
}

export function ClinicBottomSheet({ clinic, onClose, onReported, cooldownMinutes = 60 }: ClinicBottomSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedOption, setSelectedOption] = useState<WaitTimeCategory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eligibility, setEligibility] = useState<ReportEligibility>("loading");
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    const checkEligibility = async () => {
      setEligibility("loading");
      try {
        const pos = await getCurrentPosition();
        if (cancelled) return;

        if (pos.coords.accuracy > REPORT_MAX_GPS_ACCURACY_METERS) {
          setEligibility("low_accuracy");
          return;
        }

        const withinRange = isWithinRadius(
          pos.coords.latitude,
          pos.coords.longitude,
          clinic.latitude,
          clinic.longitude,
          REPORT_WAIT_GEOFENCE_METERS
        );
        setEligibility(withinRange ? "ready" : "too_far");
      } catch {
        if (!cancelled) setEligibility("gps_off");
      }
    };

    checkEligibility();
    return () => {
      cancelled = true;
    };
  }, [clinic.id, clinic.latitude, clinic.longitude]);

  const isExpiringSoon = clinic.waitTime?.lastReported
    ? Date.now() - new Date(clinic.waitTime.lastReported).getTime() > 2.5 * 60 * 60 * 1000
    : false;

  // The user can't submit a report (too far / weak GPS / GPS off) — surface it as danger.
  const cannotReport = eligibility !== "loading" && eligibility !== "ready";

  const handleReport = async (category: WaitTimeCategory) => {
    setSelectedOption(category);
    setError(null);
    setSubmitting(true);

    try {
      // Fresh (uncached) fix: the eligibility check above may be minutes old.
      const pos = await getFreshPosition();
      const withinRange = isWithinRadius(
        pos.coords.latitude,
        pos.coords.longitude,
        clinic.latitude,
        clinic.longitude,
        REPORT_WAIT_GEOFENCE_METERS
      );
      if (!withinRange) {
        setError(`You must be within ${REPORT_WAIT_GEOFENCE_METERS} meters of this doctor office to report.`);
        setSubmitting(false);
        setSelectedOption(null);
        setEligibility("too_far");
        return;
      }

      if (pos.coords.accuracy > REPORT_MAX_GPS_ACCURACY_METERS) {
        setError("GPS signal too weak. Try stepping outside or near a window.");
        setSubmitting(false);
        setSelectedOption(null);
        setEligibility("low_accuracy");
        return;
      }

      const fingerprint = getDeviceFingerprint();
      const cooldownAgo = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("wait_time_reports")
        .select("id")
        .eq("clinic_id", clinic.id)
        .eq("device_fingerprint", fingerprint)
        .gte("reported_at", cooldownAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        setError(`You already reported recently. Try again in ${cooldownMinutes} minutes.`);
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

      await queryClient.invalidateQueries({ queryKey: ["clinics"] });
      await queryClient.invalidateQueries({ queryKey: ["reports", clinic.id] });

      toast.success("Thank you! Your report has been submitted.");
      onReported();
    } catch {
      if (!error) toast.error("Failed to submit report.");
    } finally {
      setSubmitting(false);
      setSelectedOption(null);
    }
  };

  // Hand off to the external maps app — we never rebuild navigation in-app.
  const openDirections = () => {
    window.open(directionsUrl(clinic.latitude, clinic.longitude), "_blank", "noopener,noreferrer");
  };

  const openInGoogleMaps = () => {
    window.open(
      viewOnMapUrl(clinic.name, clinic.latitude, clinic.longitude),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const eligibilityMessage = (): string => {
    switch (eligibility) {
      case "too_far":
        return `You need to be within ${REPORT_WAIT_GEOFENCE_METERS} meters of this doctor office to report a wait time.`;
      case "low_accuracy":
        return `Your GPS accuracy needs to be within ${REPORT_MAX_GPS_ACCURACY_METERS} meters to report. Move outdoors or closer to an entrance and try again.`;
      case "gps_off":
        return "Location is required to verify reporting. Enable GPS and try again.";
      default:
        return "";
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-2 mb-[calc(110px+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 duration-400 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/20" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-muted/20 text-muted-foreground hover:bg-muted/40 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4 px-3 pb-4 pt-1 sm:px-5 sm:pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
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

          <div className="rounded-xl bg-muted/10 border border-border/20 p-3">
            {/*
              No active report defaults to green "On Time"; the "reported X ago"
              line only shows when there is a real report (lastReported set).
              Labeled row (left) + badge (right) so the card fills its width
              instead of leaving a gap beside the pill.
            */}
            <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Current wait</span>
                  <div className="flex items-center gap-2">
                    {clinic.waitTime?.lastReported && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(clinic.waitTime.lastReported), { addSuffix: true })}
                      </span>
                    )}
                    <WaitTimeBadge category={clinic.waitTime?.category} showIcon />
                  </div>
                </div>
                {isExpiringSoon && (
                  <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 animate-in fade-in duration-300">
                    <TimerOff className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      This wait time is expiring soon. Help update it!
                    </p>
                  </div>
                )}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 p-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive font-medium">{error}</p>
            </div>
          )}

          <div
            className={`rounded-xl border p-3 transition-colors ${
              cannotReport
                ? "border-destructive/30 bg-destructive/5"
                : "border-border/30 bg-muted/5"
            }`}
          >
            <p
              className={`text-xs font-semibold mb-2 ${
                cannotReport ? "text-destructive" : "text-card-foreground"
              }`}
            >
              Report Wait Time
            </p>

            {eligibility === "loading" && (
              <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-xs">Checking location…</span>
              </div>
            )}

            {eligibility === "ready" && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {WAIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-2.5 text-[10px] font-semibold transition-all duration-200 active:scale-95 sm:text-[11px] ${
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
            )}

            {cannotReport && (
              <div className="flex gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <p className="text-[11px] leading-relaxed text-destructive font-medium">{eligibilityMessage()}</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" onClick={openDirections} variant="outline" className="w-full gap-2 rounded-xl sm:flex-1">
              <Navigation className="h-4 w-4" />
              Get Directions
            </Button>
            <Button
              type="button"
              onClick={openInGoogleMaps}
              variant="ghost"
              className="w-full gap-2 rounded-xl text-muted-foreground sm:w-auto"
            >
              <ExternalLink className="h-4 w-4" />
              View on Google Maps
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
