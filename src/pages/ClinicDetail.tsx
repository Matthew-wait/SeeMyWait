import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Phone, Loader2, Clock, Stethoscope, ExternalLink, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { BottomNav } from "@/components/BottomNav";
import { LocationErrorOverlay } from "@/components/LocationErrorOverlay";
import {
  WaitTimeCategory,
  getAverageWaitTime,
} from "@/lib/wait-time-utils";
import { getCurrentPosition, isWithinRadius } from "@/lib/geolocation";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const WAIT_OPTIONS: { value: WaitTimeCategory; label: string; emoji: string }[] = [
  { value: "on_time", label: "On Time", emoji: "✅" },
  { value: "30_min", label: "30 Min", emoji: "🟡" },
  { value: "1_hour", label: "1 Hour", emoji: "🟠" },
  { value: "1.5_hours_plus", label: "1.5+ Hrs", emoji: "🔴" },
];

function GoogleMapEmbed({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const query = encodeURIComponent(`${name}`);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${query}&center=${lat},${lon}`;
  const embedUrl = `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed&hl=en`;

  return (
    <div className="relative w-full overflow-hidden rounded-b-lg" style={{ height: 220 }}>
      <iframe
        title="Doctor Location Map"
        src={embedUrl}
        className="absolute inset-0 h-full w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-lg bg-card/95 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow-md border border-border/50 hover:bg-card transition-colors"
      >
        <ExternalLink className="h-3 w-3 text-primary" />
        Open in Maps
      </a>
    </div>
  );
}

export default function ClinicDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [selectedOption, setSelectedOption] = useState<WaitTimeCategory | null>(null);
  const [locationError, setLocationError] = useState<"gps_off" | "too_far" | "rate_limited" | null>(null);

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
      const { data, error } = await supabase
        .from("wait_time_reports")
        .select("wait_time, reported_at")
        .eq("clinic_id", id!)
        .eq("is_flagged", false)
        .order("reported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []).map((r) => ({
        wait_time: r.wait_time as WaitTimeCategory,
        reported_at: r.reported_at,
      }));
    },
    enabled: !!id,
  });

  const waitTime = reports ? getAverageWaitTime(reports) : null;

  const handleReport = async (category: WaitTimeCategory) => {
    if (!clinic) return;
    setSelectedOption(category);
    setCheckingLocation(true);

    try {
      const pos = await getCurrentPosition();
      const withinRange = isWithinRadius(
        pos.coords.latitude,
        pos.coords.longitude,
        clinic.latitude,
        clinic.longitude,
        150
      );

      if (!withinRange) {
        setCheckingLocation(false);
        setSelectedOption(null);
        setLocationError("too_far");
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
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("wait_time_reports")
        .select("id")
        .eq("clinic_id", clinic.id)
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
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full border-4 border-muted animate-spin border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading doctor profile...</p>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
        <p className="text-foreground font-medium">Doctor not found</p>
        <Button variant="link" onClick={() => navigate("/")}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Location error overlay */}
      {locationError && (
        <LocationErrorOverlay
          type={locationError}
          clinicName={clinic.name}
          onDismiss={() => setLocationError(null)}
        />
      )}

      {/* Gradient Header */}
      <header className="relative overflow-hidden bg-primary px-3 pb-5 pt-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70" />
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-foreground/10" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="mb-2 text-primary-foreground hover:bg-primary-foreground/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-bold text-primary-foreground break-words sm:text-lg">
            {clinic.name}
          </h1>
          {clinic.specialty && (
            <Badge className="mt-1 bg-primary-foreground/20 text-primary-foreground border-0 text-xs">
              {clinic.specialty}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-3 py-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">

        {/* Doctor Profile Card */}
        <Card className="border-border/50 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-4 w-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-card-foreground">Doctor Profile</h2>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3">
                <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Doctor / Clinic Name</p>
                  <p className="text-sm font-semibold text-card-foreground break-words">{clinic.name}</p>
                </div>
              </div>
              {clinic.specialty && (
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-4 w-4 shrink-0 flex items-center justify-center">
                    <span className="text-xs">🩺</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Specialty</p>
                    <Badge variant="secondary" className="mt-0.5 text-xs">{clinic.specialty}</Badge>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Address</p>
                  <p className="text-sm text-card-foreground break-words">{clinic.address}</p>
                </div>
              </div>
              {clinic.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Phone</p>
                    <a href={`tel:${clinic.phone}`} className="text-sm text-primary font-medium hover:underline">{clinic.phone}</a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Embedded Map */}
          <div className="border-t border-border/40">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Location</span>
              <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                {clinic.latitude.toFixed(5)}, {clinic.longitude.toFixed(5)}
              </span>
            </div>
            <GoogleMapEmbed lat={clinic.latitude} lon={clinic.longitude} name={clinic.name} />
          </div>
        </Card>

        {/* Current Wait Time */}
        <Card className="border-border/50 overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-card-foreground">Current Wait Time</h2>
            </div>
            {reportsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : waitTime ? (
              <div className="flex items-center gap-3">
                <WaitTimeBadge category={waitTime.category} showIcon className="text-sm px-4 py-1.5" />
                <span className="text-xs text-muted-foreground">
                  Last report {formatDistanceToNow(new Date(waitTime.lastReported), { addSuffix: true })}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent reports — be the first!</p>
            )}
          </div>
        </Card>

        {/* Report Wait Time */}
        <Card className="border-border/50 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Stethoscope className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-card-foreground">Report Wait Time</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">
              You must be at the clinic to report
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {WAIT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-2.5 text-xs font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] sm:gap-2 sm:px-4 sm:py-3 sm:text-sm ${
                    selectedOption === opt.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-card-foreground hover:border-primary/50"
                  } ${submitting || checkingLocation ? "opacity-50 pointer-events-none" : ""}`}
                  disabled={submitting || checkingLocation}
                  onClick={() => handleReport(opt.value)}
                >
                  {(submitting || checkingLocation) && selectedOption === opt.value ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>{opt.emoji}</span>
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
