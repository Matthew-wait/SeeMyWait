import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Info, Settings, Heart } from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="relative overflow-hidden bg-primary px-4 pb-5 pt-8">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary-foreground/10" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20">
              <Settings className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-primary-foreground">Settings</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-12"
              onClick={() => navigate("/admin/login")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <span className="font-medium">Admin Login</span>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Info className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-card-foreground">About</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              See Your Wait Time helps patients find real-time wait times at
              doctor's offices in Miami. Reports are anonymous and voluntary.
            </p>
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Heart className="h-3 w-3 text-primary" />
              <p className="text-xs text-muted-foreground">Version 1.0.0 • Made in Miami</p>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
