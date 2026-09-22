import { MapPin, Navigation, ShieldAlert, Clock, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  REPORT_WAIT_GEOFENCE_METERS,
  REPORT_MAX_GPS_ACCURACY_METERS,
} from "@/lib/report-geofence";

type ErrorType = "gps_off" | "too_far" | "low_accuracy" | "rate_limited" | "spoofing";

interface LocationErrorOverlayProps {
  type: ErrorType;
  onDismiss: () => void;
  clinicName?: string;
}

const errorConfig: Record<
  ErrorType,
  {
    icon: typeof MapPin;
    gradient: string;
    glow: string;
    title: string;
    message: string;
    hint: string;
    emoji: string;
  }
> = {
  gps_off: {
    icon: Navigation,
    gradient: "from-amber-500/20 to-orange-500/10",
    glow: "shadow-[0_0_60px_hsl(38_92%_50%/0.15)]",
    title: "Location Required",
    message: "We need your GPS to verify you're at the doctor office. This ensures only real, on-site reports are submitted.",
    hint: "Enable location services in your device settings and try again.",
    emoji: "📍",
  },
  too_far: {
    icon: MapPin,
    gradient: "from-blue-500/20 to-cyan-500/10",
    glow: "shadow-[0_0_60px_hsl(200_98%_39%/0.15)]",
    title: "You're Too Far Away",
    message: `To keep wait times accurate, you must be within ${REPORT_WAIT_GEOFENCE_METERS} meters of the doctor office to submit a report.`,
    hint: "Move closer to the doctor office entrance and try again.",
    emoji: "🗺️",
  },
  low_accuracy: {
    icon: AlertTriangle,
    gradient: "from-yellow-500/20 to-amber-500/10",
    glow: "shadow-[0_0_60px_hsl(45_93%_47%/0.15)]",
    title: "Weak GPS Signal",
    message: `Your location accuracy needs to be within ${REPORT_MAX_GPS_ACCURACY_METERS} meters to verify your position. This can happen indoors or in areas with poor signal.`,
    hint: "Step closer to a window or entrance for a better GPS signal.",
    emoji: "📡",
  },
  rate_limited: {
    icon: Clock,
    gradient: "from-purple-500/20 to-violet-500/10",
    glow: "shadow-[0_0_60px_hsl(270_60%_50%/0.15)]",
    title: "Already Reported",
    message: "You've already submitted a report for this doctor office recently. To prevent spam, we limit reports to once per hour per doctor office.",
    hint: "Check back in a bit if the wait time changes.",
    emoji: "⏳",
  },
  spoofing: {
    icon: ShieldAlert,
    gradient: "from-red-500/20 to-rose-500/10",
    glow: "shadow-[0_0_60px_hsl(0_72%_50%/0.15)]",
    title: "Location Verification Failed",
    message: "We detected an issue with your location data. For everyone's safety, only verified locations are accepted.",
    hint: "Disable any mock location apps and try again.",
    emoji: "🛡️",
  },
};

export function LocationErrorOverlay({ type, onDismiss, clinicName }: LocationErrorOverlayProps) {
  const config = errorConfig[type];
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" onClick={onDismiss} />

      {/* Card */}
      <div
        className={`relative z-10 mx-3 mb-4 w-full max-w-md overflow-hidden rounded-2xl border border-border/50 bg-card ${config.glow} animate-in slide-in-from-bottom-4 duration-500 sm:mb-0`}
      >
        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${config.gradient} px-5 pb-4 pt-5`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm shadow-sm">
                <span className="text-2xl">{config.emoji}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-card-foreground">{config.title}</h3>
                {clinicName && (
                  <p className="text-xs text-muted-foreground mt-0.5">at {clinicName}</p>
                )}
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-card/50 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 px-5 py-4">
          <p className="text-sm leading-relaxed text-card-foreground/90">{config.message}</p>

          <div className="flex items-start gap-2.5 rounded-xl bg-muted/20 px-3.5 py-3 border border-border/30">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">{config.hint}</p>
          </div>

          <Button onClick={onDismiss} className="w-full" size="lg">
            Got It
          </Button>
        </div>
      </div>
    </div>
  );
}
