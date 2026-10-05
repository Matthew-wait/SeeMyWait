import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Clock, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Login failed");

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!roles || roles.role !== "admin") {
        await supabase.auth.signOut();
        toast.error("You do not have admin access.");
        setLoading(false);
        return;
      }

      toast.success("Welcome, Admin!");
      navigate("/admin");
    } catch (err: unknown) {
      toast.error((err instanceof Error && err.message) || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 w-full items-center gap-3 bg-primary px-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 shrink-0 text-primary-foreground hover:bg-primary-foreground/10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-foreground/15">
            <Clock className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold tracking-tight text-primary-foreground">SeeMyWait Admin</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4 animate-in fade-in slide-in-from-bottom-3 duration-500">
        <Card className="w-full max-w-sm border-border/50 shadow-xl shadow-primary/5">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/25">
              <Shield className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-xl">Sign In</CardTitle>
            <CardDescription>Access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
