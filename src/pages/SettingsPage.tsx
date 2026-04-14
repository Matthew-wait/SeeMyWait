import { useNavigate } from "react-router-dom";
import { BottomNav } from "@/components/BottomNav";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import {
  Settings, Heart, Moon, Sun, Bell, BellOff,
  Smartphone, Globe, ChevronRight, Sparkles,
  Shield, MessageSquare, Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState(() => localStorage.getItem("settings_notifications") !== "false");
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem("settings_reduced_motion") === "true");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const isDark = theme === "dark";

  useEffect(() => {
    localStorage.setItem("settings_notifications", String(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem("settings_reduced_motion", String(reducedMotion));
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  const submitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      toast.error("Please write your feedback before sending.");
      return;
    }

    setSubmittingFeedback(true);
    try {
      const { error } = await supabase.from("feedback_submissions").insert({
        email: feedbackEmail.trim() || null,
        message: feedbackMessage.trim(),
        device_fingerprint: getDeviceFingerprint(),
        page: "settings",
      });
      if (error) throw error;
      toast.success("Thanks for your feedback!");
      setFeedbackMessage("");
      setFeedbackEmail("");
      setFeedbackOpen(false);
    } catch (err: any) {
      const code = err?.code || err?.cause?.code;
      const message = err?.message || "Failed to send feedback. Please try again.";
      if (code === "42P01") {
        toast.error("Feedback storage is not set up yet. Please run the latest Supabase migration.");
      } else {
        toast.error(message);
      }
      console.error("Feedback submission failed:", err);
    } finally {
      setSubmittingFeedback(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-4 pb-8 pt-12 sm:px-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/[0.07] blur-2xl" />
        <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-primary-foreground/[0.04] blur-xl" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur-sm border border-primary-foreground/10">
              <Settings className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground tracking-tight">Settings</h1>
              <p className="text-[11px] text-primary-foreground/60 font-medium">Personalize your experience</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-3 px-3 py-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">

        {/* Appearance */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-card-foreground">Appearance</h3>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 space-y-1">
            <button
              onClick={() => setTheme(isDark ? "light" : "dark")}
              className="flex w-full items-center gap-3 rounded-xl p-3 transition-all hover:bg-muted/20 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                {isDark ? <Moon className="h-5 w-5 text-primary" /> : <Sun className="h-5 w-5 text-primary" />}
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold text-card-foreground">Dark Mode</span>
                <p className="text-[11px] text-muted-foreground">{isDark ? "Currently using dark theme" : "Currently using light theme"}</p>
              </div>
              <Switch checked={isDark} onCheckedChange={(v) => setTheme(v ? "dark" : "light")} />
            </button>

            <button
              onClick={() => {
                setReducedMotion(!reducedMotion);
                toast.success(reducedMotion ? "Animations enabled" : "Animations reduced");
              }}
              className="flex w-full items-center gap-3 rounded-xl p-3 transition-all hover:bg-muted/20 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold text-card-foreground">Reduce Motion</span>
                <p className="text-[11px] text-muted-foreground">Minimize animations & transitions</p>
              </div>
              <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
            </button>
          </div>
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-card-foreground">Notifications</h3>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2">
            <button
              onClick={() => {
                setNotifications(!notifications);
                toast.success(notifications ? "Notifications disabled" : "Notifications enabled");
              }}
              className="flex w-full items-center gap-3 rounded-xl p-3 transition-all hover:bg-muted/20 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                {notifications ? <Bell className="h-5 w-5 text-primary" /> : <BellOff className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold text-card-foreground">Push Notifications</span>
                <p className="text-[11px] text-muted-foreground">Get alerts for wait time updates</p>
              </div>
              <Switch checked={notifications} onCheckedChange={(v) => { setNotifications(v); toast.success(v ? "Notifications enabled" : "Notifications disabled"); }} />
            </button>
          </div>
        </div>

        {/* Links */}
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-card-foreground">More</h3>
            </div>
          </div>
          <div className="px-4 pb-4 pt-2 space-y-1">
            <button
              onClick={() => setFeedbackOpen(true)}
              className="flex w-full items-center gap-3 rounded-xl p-3 transition-all hover:bg-muted/20 active:scale-[0.99]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                <MessageSquare className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-semibold text-card-foreground">Send Feedback</span>
                <p className="text-[11px] text-muted-foreground">Help us improve the app</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
            </button>
          </div>
        </div>

        {/* About */}
        <div className="rounded-2xl border border-border/40 bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            <strong className="text-card-foreground">SeeMyWait</strong> helps patients find real-time wait times at
            doctor's offices. Reports are anonymous and voluntary.
          </p>
          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <Heart className="h-3 w-3 text-primary" />
            <p className="text-[11px] text-muted-foreground">Version 1.0.0 • Made with ❤️</p>
          </div>
        </div>
      </main>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="mx-3 w-full max-w-md">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Email (optional)</p>
              <Input
                type="email"
                value={feedbackEmail}
                onChange={(e) => setFeedbackEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Message</p>
              <Textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Tell us what we should improve..."
                rows={5}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setFeedbackOpen(false)}
              disabled={submittingFeedback}
            >
              Cancel
            </Button>
            <Button type="button" onClick={submitFeedback} disabled={submittingFeedback}>
              {submittingFeedback && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
}
