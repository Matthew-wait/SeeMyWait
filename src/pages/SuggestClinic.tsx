import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { Loader2, CheckCircle, UserPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";

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
      <header className="relative overflow-hidden bg-primary px-3 pb-5 pt-8 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80" />
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary-foreground/10" />
        <div className="relative z-10 mx-auto max-w-2xl">
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/20">
              <UserPlus className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-primary-foreground sm:text-xl">Suggest a Doctor</h1>
          </div>
          <p className="text-sm text-primary-foreground/80">
            Can't find your doctor? Let us know!
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-4 animate-in fade-in slide-in-from-bottom-3 duration-500 sm:px-6">
        {submitted ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center gap-4 p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 animate-in zoom-in duration-300">
                <CheckCircle className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-card-foreground">Thank you!</h2>
              <p className="text-center text-sm text-muted-foreground">
                Your suggestion has been submitted and will be reviewed by our team.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setDoctorName("");
                  setAddress("");
                }}
                className="mt-2"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Submit Another
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-primary" />
                Add a Doctor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doctorName">Doctor / Clinic Name</Label>
                  <Input
                    id="doctorName"
                    placeholder="e.g. Dr. Smith's Family Practice"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    placeholder="e.g. 123 Main St, Miami, FL"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Suggestion
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
