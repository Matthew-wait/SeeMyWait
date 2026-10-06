import { REPORT_WAIT_GEOFENCE_METERS } from "@/lib/report-geofence";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Phone, Loader2, Clock, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { BottomNav } from "@/components/BottomNav";
import { LocationErrorOverlay } from "@/components/LocationErrorOverlay";
import { MiniMap } from "@/components/map/MiniMap";
import {
  WaitTimeCategory,
  ReportExpiryByCategory,
  getAverageWaitTime,
} from "@/lib/wait-time-utils";
import {
} from "@/lib/report-geofence";
import { getCurrentPosition, getFreshPosition, isWithinRadius } from "@/lib/geolocation";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { useAppSettings } from "@/hooks/use-app-settings";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

/** How far back the "recent reports" history list looks — independent of
 *  both the device cooldown and each category's own expiry window. */
const HISTORY_WINDOW_MINUTES = 180;

const DEFAULT_REPORT_EXPIRY: ReportExpiryByCategory = {
  report_expiry_30min_minutes: 30,
  report_expiry_60min_minutes: 60,
  report_expiry_90plus_minutes: 90,
};

const WAIT_OPTIONS: { value: WaitTimeCategory; label: string; emoji: string }[] = [
  { value: "on_time", label: "On Time", emoji: "🟢" },
  { value: "30_min", label: "30 Min", emoji: "🟡" },
  { value: "1_hour", label: "1 Hour", emoji: "🟠" },
  { value: "1.5_hours_plus", label: "1.5+ Hrs", emoji: "🔴" },
];

export default function ClinicDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [selectedOption, setSelectedOption] = useState<WaitTimeCategory | null>(null);
  const [locationError, setLocationError] = useState<
    "gps_off" | "too_far" | "low_accuracy" | "rate_limited" | null
  >(null);
  const [locationState, setLocationState] = useState<"checking" | "ready" | "gps_off" | "low_accuracy" | "too_far">("checking");
  const { data: appSettings } = useAppSettings();
  const geofenceM = appSettings?.report_geofence_meters ?? REPORT_WAIT_GEOFENCE_METERS;
  const reportWindowMinutes = appSettings?.report_cooldown_minutes ?? 60;
  // Each wait-time category reverts to On Time on its own schedule — not one
  // flat window shared with the device cooldown above.
  const reportExpiry: ReportExpiryByCategory = appSettings ?? DEFAULT_REPORT_EXPIRY;

  const { data: clinic, isLoading: clinicLoading } = useQuery({
    queryKey: ["clinic", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const {
    data: reports,
    isLoading: reportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["reports", id],
    queryFn: async () => {
      // Flagged rows are NOT filtered out here — see the comment on
      // getAverageWaitTime for why it needs to see them.
      const { data, error } = await supabase
        .from("wait_time_reports")
        .select("wait_time, reported_at, is_flagged")
        .eq("clinic_id", id!)
        .order("reported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((r) => ({
        wait_time: r.wait_time as WaitTimeCategory,
        reported_at: r.reported_at,
        is_flagged: r.is_flagged,
      }));
    },
    enabled: !!id,
    // Fallback for a tab that's open and sitting on this exact page (the
    // realtime subscription below handles the common case within ~1s; this
    // just covers reconnects/missed events).
    refetchInterval: 60_000,
  });

  // Push-based refresh: this page previously only refreshed on the viewer's
  // OWN report submit (refetchReports below) or a window refocus — another
  // user's report never showed up while you just sat on the page looking at it.
  const refetchReportsRef = useRef(refetchReports);
  refetchReportsRef.current = refetchReports;
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`wait-time-reports-live-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wait_time_reports", filter: `clinic_id=eq.${id}` },
        () => { void refetchReportsRef.current(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id]);

  const waitTime = getAverageWaitTime(reports || [], reportExpiry);
  // Unlike waitTime above, the visible "recent activity" history should
  // never show a flagged report.
  const recentReportCount = useMemo(() => {
    if (!reports) return 0;
    const cutoff = Date.now() - HISTORY_WINDOW_MINUTES * 60 * 1000;
    return reports.filter((r) => !r.is_flagged && new Date(r.reported_at).getTime() >= cutoff).length;
  }, [reports]);
  const recentReports = useMemo(() => {
    if (!reports) return [];
    const historyCutoff = Date.now() - HISTORY_WINDOW_MINUTES * 60 * 1000;
    return reports
      .filter((r) => !r.is_flagged && new Date(r.reported_at).getTime() >= historyCutoff)
      .slice(0, 5);
  }, [reports]);

  useEffect(() => {
    if (!clinic) return;

    const validateLocationForReporting = async () => {
      setLocationState("checking");
      try {
        const pos = await getCurrentPosition();
        if (pos.coords.accuracy > geofenceM) {
          setLocationState("low_accuracy");
          return;
        }
        const withinRange = isWithinRadius(
          pos.coords.latitude,
          pos.coords.longitude,
          clinic.latitude,
          clinic.longitude,
          geofenceM
        );
        setLocationState(withinRange ? "ready" : "too_far");
      } catch {
        setLocationState("gps_off");
      }
    };

    validateLocationForReporting();
  }, [clinic]);

  const reportButtonsDisabled = submitting || checkingLocation || locationState !== "ready";

  // "On Time" is already the default when nobody has reported — only offer it
  // as a reportable option when there's an active non-on-time report to correct.
  const hasActiveDelay = Boolean(waitTime?.lastReported) && waitTime?.category !== "on_time";
  const visibleWaitOptions = WAIT_OPTIONS.filter((opt) => opt.value !== "on_time" || hasActiveDelay);

  const handleReport = async (category: WaitTimeCategory) => {
    if (!clinic) return;
    setSelectedOption(category);
    setCheckingLocation(true);

    try {
      // Fresh (uncached) fix: the eligibility check on mount may be minutes old.
      const pos = await getFreshPosition();
      const withinRange = isWithinRadius(
        pos.coords.latitude,
        pos.coords.longitude,
        clinic.latitude,
        clinic.longitude,
        geofenceM
      );

      if (!withinRange) {
        setCheckingLocation(false);
        setSelectedOption(null);
        setLocationError("too_far");
        return;
      }

      if (pos.coords.accuracy > geofenceM) {
        setCheckingLocation(false);
        setSelectedOption(null);
        setLocationError("low_accuracy");
        return;
      }
    } catch {
      setCheckingLocation(false);
      setSelectedOption(null);
      setLocationError("gps_off");
      return;
    }

    setCheckingLocation(false);
    setSubmitting(true);

    try {
      const fingerprint = getDeviceFingerprint();
      const oneHourAgo = new Date(Date.now() - reportWindowMinutes * 60 * 1000).toISOString();
      // Global per-device cooldown: one report anywhere locks this device out of
      // reporting ANY clinic (not just this one) until the cooldown window passes.
      const { data: existing } = await supabase
        .from("wait_time_reports")
        .select("id")
        .eq("device_fingerprint", fingerprint)
        .gte("reported_at", oneHourAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        setSubmitting(false);
        setSelectedOption(null);
        setLocationError("rate_limited");
        return;
      }

      const { error } = await supabase.from("wait_time_reports").insert({
        clinic_id: clinic.id,
        wait_time: category,
        device_fingerprint: fingerprint,
      });

      if (error) throw error;

      // Make sure when the user navigates back to the map the pin reflects
      // the new wait time, and stays that color until the report expires.
      await queryClient.invalidateQueries({ queryKey: ["clinics"] });

      toast.success("Thank you! Your report has been submitted.");
      refetchReports();
    } catch {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
      setSelectedOption(null);
    }
  };

  if (clinicLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-[3px] border-muted animate-spin border-t-primary" />
            <div className="absolute inset-0 h-12 w-12 rounded-full border-[3px] border-transparent animate-ping border-t-primary/20" />
          </div>
          <p className="text-sm text-muted-foreground">Loading doctor profile...</p>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30 border border-border/30">
          <Stethoscope className="h-7 w-7 text-muted-foreground/60" />
        </div>
        <p className="text-foreground font-semibold">Doctor not found</p>
        <Button variant="outline" onClick={() => navigate("/")} className="rounded-xl">
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {locationError && (
        <LocationErrorOverlay
          type={locationError}
          clinicName={clinic.name}
          onDismiss={() => setLocationError(null)}
        />
      )}

      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-4 pb-8 pt-4 sm:px-6">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary-foreground/[0.07] blur-2xl" />
        <div className="absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-primary-foreground/[0.04] blur-xl" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mb-4 -ml-2 text-primary-foreground hover:bg-primary-foreground/10 rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-primary-foreground break-words tracking-tight sm:text-2xl">
            {clinic.name}
          </h1>
          {clinic.specialty && (
            <Badge className="mt-2 bg-primary-foreground/15 text-primary-foreground border-0 text-[11px] font-medium rounded-lg backdrop-blur-sm px-3 py-0.5">
              {clinic.specialty}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-3 py-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">

        {/* Doctor Info */}
        <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-card-foreground">Doctor Profile</h2>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 space-y-3">
            <div className="flex items-start gap-3">
              <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Doctor Office</p>
                <p className="text-sm font-semibold text-card-foreground break-words">{clinic.name}</p>
              </div>
            </div>
            {clinic.specialty && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center text-xs">🩺</span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Specialty</p>
                  <Badge variant="secondary" className="mt-0.5 text-[11px] rounded-md">{clinic.specialty}</Badge>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Address</p>
                <p className="text-sm text-card-foreground break-words">{clinic.address}</p>
              </div>
            </div>
            {clinic.phone && (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Phone</p>
                  <a href={`tel:${clinic.phone}`} className="text-sm text-primary font-medium hover:underline">{clinic.phone}</a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <MiniMap latitude={clinic.latitude} longitude={clinic.longitude} name={clinic.name} />

        {/* Current Wait Time */}
        <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-card-foreground">Current Wait Time</h2>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2">
            {reportsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2 rounded-xl border border-border/20 bg-muted/10 p-3 sm:flex-row sm:items-center sm:gap-3">
                <WaitTimeBadge
                  category={waitTime?.category ?? null}
                  showIcon
                  className="text-sm px-4 py-1.5"
                />
                <div className="space-y-0.5">
                  {waitTime?.lastReported && (
                    <span className="block text-xs text-muted-foreground">
                      Last report {formatDistanceToNow(new Date(waitTime.lastReported), { addSuffix: true })}
                    </span>
                  )}
                  <span className="block text-[11px] font-medium text-muted-foreground">
                    {recentReportCount} report{recentReportCount !== 1 ? "s" : ""} in last {HISTORY_WINDOW_MINUTES} minutes
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Reports (last 3 hours) */}
        <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-card-foreground">Recent Reports</h2>
                <p className="text-[11px] text-muted-foreground">Last {HISTORY_WINDOW_MINUTES} minutes</p>
              </div>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2">
            {reportsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : recentReports.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports submitted in the last {HISTORY_WINDOW_MINUTES} minutes.</p>
            ) : (
              <div className="space-y-2">
                {recentReports.map((report, idx) => (
                  <div key={`${report.reported_at}-${idx}`} className="flex items-center justify-between rounded-xl border border-border/20 bg-muted/10 px-3 py-2">
                    <WaitTimeBadge category={report.wait_time} />
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Report Wait Time */}
        <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Stethoscope className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-card-foreground">Report Wait Time</h2>
                <p className="text-[11px] text-muted-foreground">You must be at the doctor office to report</p>
              </div>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2">
            {locationState === "checking" && (
              <div className="mb-2 rounded-lg border border-border/30 bg-muted/10 px-3 py-2 text-[11px] text-muted-foreground">
                Checking location...
              </div>
            )}
            {locationState === "gps_off" && (
              <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] font-medium text-destructive">
                GPS is off or unavailable. Enable location services to report.
              </div>
            )}
            {locationState === "low_accuracy" && (
              <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] font-medium text-destructive">
                Location accuracy needs to be within {geofenceM} meters. Move to an open area and try again.
              </div>
            )}
            {locationState === "too_far" && (
              <div className="mb-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-[11px] font-medium text-destructive">
                You need to be within {geofenceM} meters of this doctor office to submit a report.
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {visibleWaitOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3.5 text-xs font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] sm:text-sm ${
                    selectedOption === opt.value
                      ? "border-primary bg-primary/10 text-primary shadow-md shadow-primary/10"
                      : "border-border/30 bg-card text-card-foreground hover:border-primary/30 hover:bg-primary/5"
                  } ${reportButtonsDisabled ? "opacity-50 pointer-events-none" : ""}`}
                  disabled={reportButtonsDisabled}
                  onClick={() => handleReport(opt.value)}
                >
                  {(submitting || checkingLocation) && selectedOption === opt.value ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="text-base">{opt.emoji}</span>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
