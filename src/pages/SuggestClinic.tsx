import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BottomNav } from "@/components/BottomNav";
import { Loader2, CheckCircle } from "lucide-react";
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
      <header className="sticky top-0 z-40 border-b bg-card px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Suggest a Doctor</h1>
        <p className="text-xs text-muted-foreground">
          Can't find your doctor? Let us know!
        </p>
      </header>

      <main className="flex-1 px-4 py-4">
        {submitted ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-8">
              <CheckCircle className="h-12 w-12 text-green-500" />
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
              >
                Submit Another
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add a Doctor</CardTitle>
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
