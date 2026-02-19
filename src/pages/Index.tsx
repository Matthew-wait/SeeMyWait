import { useState } from "react";
import { Search, MapPin, Loader2, Stethoscope, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClinicCard } from "@/components/ClinicCard";
import { BottomNav } from "@/components/BottomNav";
import { useClinics } from "@/hooks/use-clinics";
import { getCurrentPosition } from "@/lib/geolocation";
import { toast } from "sonner";

const Index = () => {
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [locating, setLocating] = useState(false);

  const { data: clinics, isLoading } = useClinics(
    search || undefined,
    userLocation?.lat,
    userLocation?.lng
  );

  const handleNearMe = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentPosition();
      setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success("Location found! Showing nearby clinics.");
    } catch {
      toast.error("Unable to get your location. Please enable GPS.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Hero Header */}
      <header className="relative overflow-hidden bg-primary px-3 pb-6 pt-8 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80 opacity-90" />
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary-foreground/10 animate-pulse" />
        <div className="absolute -left-4 bottom-0 h-20 w-20 rounded-full bg-primary-foreground/5" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20">
              <Stethoscope className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-primary-foreground sm:text-xl">
              See Your Wait Time
            </h1>
          </div>
          <p className="text-sm text-primary-foreground/80">
            Real-time doctor wait times in Miami
          </p>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2 backdrop-blur-sm">
            <Clock className="h-4 w-4 shrink-0 text-primary-foreground/70" />
            <span className="text-xs text-primary-foreground/70">
              {clinics?.length || 0} clinics tracked • Updated live
            </span>
          </div>
        </div>
      </header>

      {/* Search + Near Me */}
      <div className="mx-auto w-full max-w-2xl flex gap-2 px-3 py-3 -mt-1 sm:px-6">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search doctor or clinic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 shadow-sm"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNearMe}
          disabled={locating}
          title="Near Me"
          className="shrink-0 shadow-sm"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Results */}
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-3 sm:px-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-muted animate-spin border-t-primary" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Finding clinics...</p>
          </div>
        ) : clinics && clinics.length > 0 ? (
          clinics.map((clinic, index) => (
            <div
              key={clinic.id}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both', animationDuration: '400ms' }}
            >
              <ClinicCard
                id={clinic.id}
                name={clinic.name}
                address={clinic.address}
                specialty={clinic.specialty}
                distance={clinic.distance}
                waitTime={clinic.waitTime}
              />
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center py-16 gap-3 animate-in fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground">No clinics found</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {search
                ? "Try a different search term"
                : "Tap the location button to find clinics near you"}
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
