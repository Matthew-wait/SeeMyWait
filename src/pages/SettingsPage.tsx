import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { Shield, Info } from "lucide-react";

export default function SettingsPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
      </header>

      <main className="flex-1 space-y-4 px-4 py-4">
        <Card>
          <CardContent className="p-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={() => navigate("/admin/login")}
            >
              <Shield className="h-4 w-4" />
              Admin Login
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-medium text-card-foreground">About</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              See Your Wait Time helps patients find real-time wait times at
              doctor's offices in Miami. Reports are anonymous and voluntary.
            </p>
            <p className="text-xs text-muted-foreground">Version 1.0.0</p>
          </CardContent>
        </Card>
      </main>

      <BottomNav />
    </div>
  );
}
