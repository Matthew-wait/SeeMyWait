import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { MapPin } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center animate-in fade-in duration-500">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted/30 border border-border/30">
          <MapPin className="h-9 w-9 text-muted-foreground/50" />
        </div>
        <h1 className="text-5xl font-extrabold text-foreground tracking-tight">404</h1>
        <p className="text-base text-muted-foreground max-w-xs">
          This page doesn't exist. Maybe the clinic moved?
        </p>
        <a
          href="/"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
        >
          Return Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
