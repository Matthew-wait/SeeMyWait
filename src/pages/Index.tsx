import { useState } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";
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
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">See Your Wait Time</h1>
        <p className="text-xs text-muted-foreground">
          Find doctor wait times in Miami
        </p>
      </header>

      {/* Search + Near Me */}
      <div className="flex gap-2 px-4 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search doctor or clinic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleNearMe}
          disabled={locating}
          title="Near Me"
        >
          {locating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MapPin className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Results */}
      <main className="flex-1 space-y-2 px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : clinics && clinics.length > 0 ? (
          clinics.map((clinic) => (
            <ClinicCard
              key={clinic.id}
              id={clinic.id}
              name={clinic.name}
              address={clinic.address}
              distance={clinic.distance}
              waitTime={clinic.waitTime}
            />
          ))
        ) : (
          <div className="py-12 text-center">
            <MapPin className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No clinics found</p>
            <p className="text-sm text-muted-foreground">
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
