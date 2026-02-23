import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Info, Settings, Heart, ChevronRight } from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-4 pb-6 pt-8 sm:px-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/[0.07] blur-2xl" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
              <Settings className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-primary-foreground tracking-tight sm:text-xl">Settings</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-3 py-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">
        {/* Admin Login */}
        <button
          onClick={() => navigate("/admin/login")}
          className="flex w-full items-center gap-3 rounded-2xl border border-border/40 bg-card p-4 transition-all hover:shadow-sm hover:border-primary/20 active:scale-[0.99]"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <span className="flex-1 text-left text-sm font-semibold text-card-foreground">Admin Login</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
        </button>

        {/* About */}
        <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-card-foreground">About</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            See Your Wait Time helps patients find real-time wait times at
            doctor's offices in Miami. Reports are anonymous and voluntary.
          </p>
          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <Heart className="h-3 w-3 text-primary" />
            <p className="text-[11px] text-muted-foreground">Version 1.0.0 • Made in Miami</p>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
