import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BottomNav } from "@/components/BottomNav";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2, CheckCircle, UserPlus, Sparkles,
  ClipboardList, ShieldCheck, Eye, ArrowRight,
  MapPin, Phone, Stethoscope, Building2, AlertTriangle,
} from "lucide-react";
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

const CLINIC_TYPES = [
  { value: "doctor", label: "Doctor" },
  { value: "clinic", label: "Clinic" },
  { value: "hospital", label: "Hospital" },
  { value: "urgent_care", label: "Urgent Care" },
];

export default function SuggestClinic() {
  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [clinicType, setClinicType] = useState("doctor");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [duplicateFound, setDuplicateFound] = useState<string | null>(null);
  const [locatingAddress, setLocatingAddress] = useState(false);

  const checkDuplicate = async (): Promise<boolean> => {
    const nameTrimmed = doctorName.trim().toLowerCase();
    const addressTrimmed = address.trim().toLowerCase();
    const specTrimmed = specialty.trim().toLowerCase() || null;

    // Check existing clinics
    const { data: existingClinics } = await supabase
      .from("clinics")
      .select("name, address, specialty")
      .eq("is_active", true);

    const clinicMatch = (existingClinics || []).find(
      (c) =>
        c.name.toLowerCase() === nameTrimmed &&
        c.address.toLowerCase() === addressTrimmed &&
        (c.specialty?.toLowerCase() || null) === specTrimmed
    );

    if (clinicMatch) {
      setDuplicateFound(`"${clinicMatch.name}" at "${clinicMatch.address}" is already listed in our directory.`);
      return true;
    }

    // Check pending suggestions
    const { data: pendingSuggestions } = await supabase
      .from("clinic_suggestions")
      .select("doctor_name, address, specialty")
      .eq("status", "pending");

    const suggestionMatch = (pendingSuggestions || []).find(
      (s) =>
        s.doctor_name.toLowerCase() === nameTrimmed &&
        s.address.toLowerCase() === addressTrimmed &&
        (s.specialty?.toLowerCase() || null) === specTrimmed
    );

    if (suggestionMatch) {
      setDuplicateFound(`"${suggestionMatch.doctor_name}" at "${suggestionMatch.address}" has already been submitted and is pending review.`);
      return true;
    }

    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateFound(null);

    if (!doctorName.trim() || !address.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    try {
      const isDuplicate = await checkDuplicate();
      if (isDuplicate) {
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("clinic_suggestions").insert({
        doctor_name: doctorName.trim(),
        address: address.trim(),
        specialty: specialty.trim() || null,
        phone: phone.trim() || null,
        clinic_type: clinicType,
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

  const resetForm = () => {
    setSubmitted(false);
    setDuplicateFound(null);
    setDoctorName("");
    setSpecialty("");
    setAddress("");
    setPhone("");
    setClinicType("doctor");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-4 pb-8 pt-12 sm:px-6">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary-foreground/[0.07] blur-2xl" />
        <div className="absolute -left-6 bottom-0 h-24 w-24 rounded-full bg-primary-foreground/[0.04] blur-xl" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="flex items-center gap-3 mb-1.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15 backdrop-blur-sm border border-primary-foreground/10">
              <UserPlus className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-primary-foreground tracking-tight sm:text-2xl">
                Can't Find Your Clinic?
              </h1>
              <p className="text-[11px] text-primary-foreground/60 font-medium">
                Report it here — we'll review and add it soon
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">
        {/* 3-Step Process */}
        <div className="rounded-2xl border border-border/30 bg-card p-4">
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
          <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
            <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 sm:p-8">
              <div className="flex flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 animate-in zoom-in duration-300">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-lg font-semibold text-card-foreground">Thank You!</h2>
                <p className="text-center text-sm text-muted-foreground max-w-xs">
                  Your suggestion has been submitted. Our team will review and verify it shortly.
                </p>
                <Button variant="outline" onClick={resetForm} className="mt-2 rounded-xl">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Submit Another
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
            <div className="bg-gradient-to-r from-primary/5 to-transparent px-4 pt-4 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10">
                  <UserPlus className="h-4 w-4 text-primary" />
                </div>
                <h2 className="text-sm font-semibold text-card-foreground">Add a Doctor</h2>
              </div>
            </div>
            <div className="px-4 pb-4 pt-2">
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="doctorName" className="text-xs font-medium flex items-center gap-1.5">
                    <Stethoscope className="h-3 w-3 text-primary/70" />
                    Doctor / Clinic Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="doctorName"
                    placeholder="e.g. Dr. Smith's Family Practice"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="rounded-xl border-border/40 bg-background/60 h-11"
                    required
                  />
                </div>

                {/* Type + Specialty row */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-primary/70" />
                      Type
                    </Label>
                    <Select value={clinicType} onValueChange={setClinicType}>
                      <SelectTrigger className="rounded-xl border-border/40 bg-background/60 h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CLINIC_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="specialty" className="text-xs font-medium">
                      Specialty
                    </Label>
                    <Input
                      id="specialty"
                      placeholder="e.g. Cardiology"
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="rounded-xl border-border/40 bg-background/60 h-11"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-medium flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 text-primary/70" />
                    Full Address <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="address"
                      placeholder="e.g. 123 Main St, Miami, FL 33101"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="rounded-xl border-border/40 bg-background/60 h-11 pr-32"
                      required
                    />
                    <button
                      type="button"
                      disabled={locatingAddress}
                      onClick={() => {
                        if (!navigator.geolocation) {
                          toast.error("Geolocation not supported by your browser.");
                          return;
                        }
                        setLocatingAddress(true);
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            try {
                              const res = await fetch(
                                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
                              );
                              const data = await res.json();
                              if (data.display_name) {
                                setAddress(data.display_name);
                                toast.success("Address captured from your location!");
                              } else {
                                toast.error("Could not resolve address. Please enter manually.");
                              }
                            } catch {
                              toast.error("Failed to get address. Please enter manually.");
                            } finally {
                              setLocatingAddress(false);
                            }
                          },
                          () => {
                            toast.error("Unable to get location. Please enter manually.");
                            setLocatingAddress(false);
                          },
                          { enableHighAccuracy: true }
                        );
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {locatingAddress ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}
                      Use Current Location
                    </button>
                  </div>
                </div>

                {duplicateFound && (
                  <Alert variant="destructive" className="rounded-xl border-destructive/30 bg-destructive/5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm font-semibold">Already Exists!</AlertTitle>
                    <AlertDescription className="text-xs mt-1">
                      {duplicateFound}
                    </AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full rounded-xl h-12 text-sm font-semibold" disabled={submitting}>
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
