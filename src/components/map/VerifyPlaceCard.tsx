import { useState } from "react";
import { AlertTriangle, Check, ExternalLink, Loader2, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AddedClinic,
  GoogleSearchResult,
  addErrorMessage,
  addMedicalPlace,
  viewOnGoogleMapsUrl,
} from "@/lib/medical-search";
import { getDistanceMiles } from "@/lib/geolocation";

interface VerifyPlaceCardProps {
  candidate: GoogleSearchResult;
  userLocation: { lat: number; lng: number } | null;
  onCancel: () => void;
  onVerified: (clinic: AddedClinic) => void;
}

/**
 * Verify-before-save. A Google result is *never* saved just by being tapped —
 * only this card's "Verify & Add" writes it, so when a query returns several
 * similar places only the one the user confirms enters the directory.
 */
export function VerifyPlaceCard({
  candidate,
  userLocation,
  onCancel,
  onVerified,
}: VerifyPlaceCardProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawDistance = userLocation
    ? getDistanceMiles(userLocation.lat, userLocation.lng, candidate.latitude, candidate.longitude)
    : null;
  // Omit rather than render "NaN mi away".
  const distance = Number.isFinite(rawDistance) ? rawDistance : null;

  const handleVerify = async () => {
    setSubmitting(true);
    setError(null);

    const response = await addMedicalPlace(candidate.place_id);
    setSubmitting(false);

    if (response.ok && response.clinic) {
      onVerified(response.clinic);
    } else {
      // Keep the card open so the user can retry.
      setError(addErrorMessage(response.error));
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-background/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative z-10 w-full max-w-lg mx-2 mb-[calc(110px+env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-8 duration-300 rounded-2xl border border-blue-500/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-xl bg-muted/20 text-muted-foreground transition-colors hover:bg-muted/40"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="space-y-4 px-3 pb-4 pt-4 sm:px-5 sm:pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Not saved yet
              </p>
              <h3 className="truncate text-base font-bold text-card-foreground">{candidate.name}</h3>
              <p className="truncate text-xs text-muted-foreground">{candidate.address}</p>
              {distance !== null && (
                <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                  {distance < 10 ? `${distance.toFixed(1)} mi away` : `${Math.round(distance)} mi away`}
                </p>
              )}
            </div>
          </div>

          <p className="rounded-xl border border-border/20 bg-muted/10 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Check the pin on the map. If this is the right doctor office, add it so others can see
            and report its wait times.
          </p>

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 animate-in fade-in duration-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs font-medium text-destructive">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={handleVerify}
              disabled={submitting}
              className="w-full gap-2 rounded-xl sm:flex-1"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {submitting ? "Adding…" : "Verify & Add"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 rounded-xl sm:w-auto"
              onClick={() =>
                window.open(
                  viewOnGoogleMapsUrl(candidate.name, candidate.place_id),
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <ExternalLink className="h-4 w-4" />
              View on Google Maps
            </Button>
          </div>

          <p className="text-center text-[9px] text-muted-foreground/70">Powered by Google</p>
        </div>
      </div>
    </div>
  );
}
