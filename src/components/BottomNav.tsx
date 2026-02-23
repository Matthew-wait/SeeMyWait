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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-inset-bottom">
      <div className="mx-auto flex max-w-2xl items-center justify-around py-2 pb-safe">
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
                "relative flex flex-col items-center gap-0.5 px-5 py-1.5 text-xs transition-all duration-200",
                isActive
                  ? "text-primary font-medium scale-105"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {isActive && (
                <span className="absolute -top-2 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
              )}
              <item.icon className={cn("h-5 w-5 transition-transform", isActive && "scale-110")} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
