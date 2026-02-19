import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MapPin, Phone, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { BottomNav } from "@/components/BottomNav";
import {
  WaitTimeCategory,
  WAIT_TIME_LABELS,
  getAverageWaitTime,
} from "@/lib/wait-time-utils";
import { getCurrentPosition, isWithinRadius } from "@/lib/geolocation";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

const WAIT_OPTIONS: { value: WaitTimeCategory; label: string; color: string }[] = [
  { value: "on_time", label: "On Time", color: "bg-green-500 hover:bg-green-600 text-primary-foreground" },
  { value: "30_min", label: "30 Min", color: "bg-yellow-500 hover:bg-yellow-600 text-primary-foreground" },
  { value: "1_hour", label: "1 Hour", color: "bg-orange-500 hover:bg-orange-600 text-primary-foreground" },
  { value: "1.5_hours_plus", label: "1.5+ Hrs", color: "bg-destructive hover:bg-destructive/90 text-destructive-foreground" },
];

export default function ClinicDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [checkingLocation, setCheckingLocation] = useState(false);

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
    setCheckingLocation(true);

    try {
      const pos = await getCurrentPosition();
      const withinRange = isWithinRadius(
        pos.coords.latitude,
        pos.coords.longitude,
        clinic.latitude,
        clinic.longitude,
        150 // 150 meters for some GPS tolerance
      );

      if (!withinRange) {
        toast.error(
          "You need to be at the clinic to report wait times. Please visit the clinic first."
        );
        setCheckingLocation(false);
        return;
      }
    } catch {
      toast.error("Please enable location services to report wait times.");
      setCheckingLocation(false);
      return;
    }

    setCheckingLocation(false);
    setSubmitting(true);

    try {
      const fingerprint = getDeviceFingerprint();

      // Check spam: one report per device per clinic per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabase
        .from("wait_time_reports")
        .select("id")
        .eq("clinic_id", clinic.id)
        .eq("device_fingerprint", fingerprint)
        .gte("reported_at", oneHourAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("You already reported for this clinic recently. Try again later.");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("wait_time_reports").insert({
        clinic_id: clinic.id,
        wait_time: category,
        device_fingerprint: fingerprint,
      });

      if (error) throw error;

      toast.success("Thank you! Your wait time report has been submitted.");
      refetchReports();
    } catch (err: any) {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (clinicLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <p className="text-foreground">Clinic not found.</p>
        <Button variant="link" onClick={() => navigate("/")}>
          Go back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-card px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="truncate text-lg font-bold text-foreground">{clinic.name}</h1>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        {/* Clinic Info */}
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-card-foreground">{clinic.address}</p>
            </div>
            {clinic.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary" />
                <a
                  href={`tel:${clinic.phone}`}
                  className="text-sm text-primary underline"
                >
                  {clinic.phone}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Wait Time */}
        <Card>
          <CardContent className="p-4 text-center">
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Current Wait Time
            </h2>
            {reportsLoading ? (
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            ) : waitTime ? (
              <div className="space-y-1">
                <WaitTimeBadge category={waitTime.category} className="text-base px-4 py-1" />
                <p className="text-xs text-muted-foreground">
                  Last report{" "}
                  {formatDistanceToNow(new Date(waitTime.lastReported), {
                    addSuffix: true,
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent reports</p>
            )}
          </CardContent>
        </Card>

        {/* Report Wait Time */}
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-1 text-sm font-medium text-card-foreground">
              Report Wait Time
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              You must be at the clinic to report
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WAIT_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  className={opt.color}
                  disabled={submitting || checkingLocation}
                  onClick={() => handleReport(opt.value)}
                >
                  {(submitting || checkingLocation) ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : null}
                  {opt.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Map placeholder */}
        <Card>
          <CardContent className="p-4">
            <div className="flex h-48 items-center justify-center rounded-md bg-muted/30">
              <div className="text-center">
                <MapPin className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  {clinic.latitude.toFixed(4)}, {clinic.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
