import { Search, Plus, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/app", icon: Search, label: "Map" },
  { path: "/suggest", icon: Plus, label: "Add Doctor" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-card/95 backdrop-blur-2xl safe-area-inset-bottom">
      <div className="mx-auto flex max-w-2xl items-center justify-around gap-1 px-1 py-1 pb-safe">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-2xl px-2 py-2 text-[10px] transition-all duration-300 sm:flex-none sm:px-6 sm:text-[11px]",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-1 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-full bg-gradient-to-r from-primary to-primary/60" />
              )}
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-300",
                isActive ? "bg-primary/10 shadow-sm shadow-primary/10" : ""
              )}>
                <item.icon className={cn("h-[18px] w-[18px] transition-colors", isActive && "text-primary")} />
              </div>
              <span className="max-w-full truncate tracking-wide">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
