import { useEffect, useState } from "react";
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
  // Set when the page is opened from a password-reset or invitation link.
  const [settingPassword, setSettingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  // Own reset flow: request an email, with a one-minute cooldown before resending.
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const sendResetEmail = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "We could not send the email.");
      setResetSent(true);
      setCooldownUntil(Date.now() + 60_000);
      setNow(Date.now());
      toast.success("If that email belongs to an admin, a reset link is on its way.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "We could not send the email.");
    } finally {
      setLoading(false);
    }
  };

  const secondsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const fromLink = /type=(recovery|invite)/.test(window.location.hash);
    if (fromLink) setSettingPassword(true);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setSettingPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      await supabase.auth.signOut();
      window.history.replaceState(null, "", window.location.pathname);
      setSettingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password saved. Sign in with your new password.");
    } catch (err: unknown) {
      toast.error((err instanceof Error && err.message) || "Could not save the password.");
    } finally {
      setLoading(false);
    }
  };

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
            <CardTitle className="text-xl">{settingPassword ? "Set your password" : "Sign In"}</CardTitle>
            <CardDescription>{settingPassword ? "Choose a password for the admin account" : "Access the admin dashboard"}</CardDescription>
          </CardHeader>
          <CardContent>
            {settingPassword ? (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save password
              </Button>
            </form>
            ) : forgot ? (
            <div className="space-y-4">
              <form onSubmit={sendResetEmail} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Admin email</Label>
                  <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading || secondsLeft > 0}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {resetSent ? (secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend reset email") : "Send reset link"}
                </Button>
              </form>
              {resetSent && <p className="text-center text-xs text-muted-foreground">Check the inbox and spam folder. The link works once and expires in one hour.</p>}
              <button type="button" className="w-full text-center text-sm text-primary underline-offset-2 hover:underline" onClick={() => setForgot(false)}>Back to sign in</button>
            </div>
            ) : (
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
            )}
            {!settingPassword && !forgot && (
              <button type="button" className="mt-4 w-full text-center text-sm text-primary underline-offset-2 hover:underline" onClick={() => setForgot(true)}>
                Forgot password?
              </button>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
