import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Phone, Loader2, Clock, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { BottomNav } from "@/components/BottomNav";
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

export default function ClinicDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [selectedOption, setSelectedOption] = useState<WaitTimeCategory | null>(null);

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
        toast.error("You need to be at the clinic to report wait times.");
        setCheckingLocation(false);
        setSelectedOption(null);
        return;
      }
    } catch {
      toast.error("Please enable location services to report wait times.");
      setCheckingLocation(false);
      setSelectedOption(null);
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
        toast.error("You already reported for this clinic recently.");
        setSubmitting(false);
        setSelectedOption(null);
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
          <p className="text-sm text-muted-foreground">Loading clinic...</p>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
        <p className="text-foreground font-medium">Clinic not found</p>
        <Button variant="link" onClick={() => navigate("/")}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Gradient Header */}
      <header className="relative overflow-hidden bg-primary px-3 pb-5 pt-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/70" />
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-foreground/10" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="mb-2 text-primary-foreground hover:bg-primary-foreground/10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-bold text-primary-foreground break-words sm:text-lg">{clinic.name}</h1>
          {clinic.specialty && (
            <Badge className="mt-1 bg-primary-foreground/20 text-primary-foreground border-0 text-xs">
              {clinic.specialty}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-3 py-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">
        {/* Clinic Info */}
        <Card className="border-border/50">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm text-card-foreground pt-1">{clinic.address}</p>
            </div>
            {clinic.phone && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <a href={`tel:${clinic.phone}`} className="text-sm text-primary font-medium">
                  {clinic.phone}
                </a>
              </div>
            )}
          </CardContent>
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
        <Card className="border-border/50">
          <CardContent className="p-4">
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
          </CardContent>
        </Card>

        {/* Map placeholder */}
        <Card className="border-border/50 overflow-hidden">
          <div className="relative h-40 bg-gradient-to-br from-primary/5 via-muted/30 to-primary/10">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MapPin className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">
                  {clinic.latitude.toFixed(4)}, {clinic.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
