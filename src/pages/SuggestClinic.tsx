import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import { Loader2, CheckCircle, UserPlus, Sparkles, ClipboardList, ShieldCheck, Eye, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  {
    icon: ClipboardList,
    title: "You Report",
    description: "Submit clinic details — name, address, and type.",
    emoji: "📋",
  },
  {
    icon: ShieldCheck,
    title: "Admin Reviews",
    description: "We verify via Google Maps and public records.",
    emoji: "🔍",
  },
  {
    icon: Eye,
    title: "Approved & Visible",
    description: "Once verified, it appears in the app for everyone.",
    emoji: "✅",
  },
];

export default function SuggestClinic() {
  const [doctorName, setDoctorName] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorName.trim() || !address.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("clinic_suggestions").insert({
        doctor_name: doctorName.trim(),
        address: address.trim(),
      });

      if (error) throw error;
      setSubmitted(true);
      toast.success("Suggestion submitted! We'll review it soon.");
    } catch {
      toast.error("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-4 pb-6 pt-8 sm:px-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/[0.07] blur-2xl" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 backdrop-blur-sm">
              <UserPlus className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary-foreground tracking-tight sm:text-xl">
                Can't Find Your Clinic?
              </h1>
              <p className="text-[11px] text-primary-foreground/60 font-medium">
                Report it here — we'll review and add it soon
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-4 space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">
        {/* 3-Step Process */}
        <div className="rounded-2xl border border-border/40 bg-card p-4">
          <div className="flex items-start gap-2 sm:gap-0 sm:justify-between">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex flex-1 flex-col items-center text-center relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute top-5 left-[calc(50%+20px)] right-[calc(-50%+20px)] hidden sm:block">
                    <div className="h-px bg-gradient-to-r from-primary/30 to-primary/10" />
                    <ArrowRight className="absolute -right-1.5 -top-1.5 h-3 w-3 text-primary/30" />
                  </div>
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 text-lg mb-2">
                  {step.emoji}
                </div>
                <h3 className="text-xs font-semibold text-card-foreground sm:text-sm">{step.title}</h3>
                <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight max-w-[110px] sm:text-[11px] sm:max-w-[150px]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Form / Success */}
        {submitted ? (
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 sm:p-8">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 animate-in zoom-in duration-300"
                >
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-card-foreground">Thank You!</h2>
                <p className="text-center text-sm text-muted-foreground max-w-xs">
                  Your suggestion has been submitted. Our team will review and verify it shortly.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitted(false);
                    setDoctorName("");
                    setAddress("");
                  }}
                  className="mt-2 rounded-xl"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Submit Another
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                  <UserPlus className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-card-foreground">Add a Doctor</h2>
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doctorName" className="text-xs font-medium">
                    Doctor / Clinic Name
                  </Label>
                  <Input
                    id="doctorName"
                    placeholder="e.g. Dr. Smith's Family Practice"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="rounded-xl border-border/40 bg-background/50 h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address" className="text-xs font-medium">
                    Full Address
                  </Label>
                  <Input
                    id="address"
                    placeholder="e.g. 123 Main St, Miami, FL 33101"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="rounded-xl border-border/40 bg-background/50 h-11"
                  />
                </div>
                <Button type="submit" className="w-full rounded-xl h-11" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Suggestion
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Community note */}
        <div className="flex items-start gap-3 rounded-2xl border border-border/30 bg-muted/10 px-4 py-3">
          <span className="text-lg mt-0.5">💡</span>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            All submissions are reviewed manually. Only verified locations are published. No personal information is shared.
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
