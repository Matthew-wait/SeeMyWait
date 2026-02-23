import { useState } from "react";
import { Search, MapPin, Loader2, Clock, Sparkles, SlidersHorizontal } from "lucide-react";
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
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-4 pb-16 pt-12 sm:px-6">
        {/* Ambient orbs */}
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/[0.07] blur-2xl" />
        <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-primary-foreground/[0.04] blur-xl" />
        <div className="absolute right-1/4 top-1/3 h-20 w-20 rounded-full bg-primary-foreground/[0.03] blur-2xl" />

        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur-sm border border-primary-foreground/10">
              <Clock className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground tracking-tight sm:text-2xl">
                See My Wait Time
              </h1>
              <p className="text-[11px] text-primary-foreground/60 font-medium">
                Real-time doctor wait times • Miami
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Search floating card */}
      <div className="mx-auto w-full max-w-2xl px-3 -mt-8 relative z-20 sm:px-6">
        <div className="rounded-2xl border border-border/50 bg-card p-3.5 shadow-xl shadow-primary/5 backdrop-blur-sm">
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search doctor or clinic..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 border-border/40 bg-background/60 h-11 rounded-xl text-sm"
              />
            </div>
            <Button
              variant="outline"
              onClick={handleNearMe}
              disabled={locating}
              className="shrink-0 h-11 gap-2 rounded-xl border-border/40 bg-background/60 px-4 text-xs font-medium"
            >
              {locating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Near Me</span>
            </Button>
          </div>
          <div className="mt-2.5 flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-primary/60" />
              <span className="text-[11px] text-muted-foreground">
                {clinics?.length || 0} clinics tracked • Updated live
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-2.5 px-3 pt-4 sm:px-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-[3px] border-muted animate-spin border-t-primary" />
              <div className="absolute inset-0 h-12 w-12 rounded-full border-[3px] border-transparent animate-ping border-t-primary/20" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Finding clinics...</p>
          </div>
        ) : clinics && clinics.length > 0 ? (
          clinics.map((clinic, index) => (
            <div
              key={clinic.id}
              className="animate-in fade-in slide-in-from-bottom-2"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both', animationDuration: '350ms' }}
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
          <div className="flex flex-col items-center py-20 gap-4 animate-in fade-in">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/20 border border-border/30">
              <MapPin className="h-7 w-7 text-muted-foreground/60" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">No clinics found</p>
              <p className="mt-1 text-sm text-muted-foreground max-w-xs">
                {search
                  ? "Try a different search term"
                  : "Tap the location button to find clinics near you"}
              </p>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default Index;
