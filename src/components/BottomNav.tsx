import { Search, Plus, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/app", icon: Search, label: "Search" },
  { path: "/suggest", icon: Plus, label: "Add Doctor" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-card/80 backdrop-blur-xl safe-area-inset-bottom">
      <div className="mx-auto flex max-w-2xl items-center justify-around py-1.5 pb-safe">
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
                "relative flex flex-col items-center gap-0.5 rounded-xl px-5 py-2 text-[11px] transition-all duration-200",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-1.5 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-full bg-primary" />
              )}
              <div className={cn(
                "flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-200",
                isActive ? "bg-primary/10" : ""
              )}>
                <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-primary")} />
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
