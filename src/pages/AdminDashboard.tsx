import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogOut, Loader2, Check, X, Trash2, Search, Download,
  LayoutDashboard, Users, FileText, Activity,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [importQuery, setImportQuery] = useState("doctor Miami");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin/login"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      if (!roles || roles.role !== "admin") navigate("/admin/login");
    };
    checkAuth();
  }, [navigate]);

  const { data: clinics, isLoading: clinicsLoading } = useQuery({
    queryKey: ["admin-clinics", searchQuery],
    queryFn: async () => {
      let q = supabase.from("clinics").select("*").order("name");
      if (searchQuery) q = q.ilike("name", `%${searchQuery}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ["admin-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinic_suggestions").select("*").eq("status", "pending").order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentReports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wait_time_reports").select("*, clinics(name)").order("reported_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const approveSuggestion = useMutation({
    mutationFn: async (suggestion: any) => {
      const { error: clinicError } = await supabase.from("clinics").insert({
        name: suggestion.doctor_name, address: suggestion.address,
        latitude: suggestion.latitude || 25.7617, longitude: suggestion.longitude || -80.1918,
        google_place_id: suggestion.google_place_id,
      });
      if (clinicError) throw clinicError;
      const { error: updateError } = await supabase.from("clinic_suggestions").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", suggestion.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => { toast.success("Suggestion approved!"); queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] }); queryClient.invalidateQueries({ queryKey: ["admin-clinics"] }); },
    onError: () => toast.error("Failed to approve suggestion."),
  });

  const rejectSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinic_suggestions").update({ status: "rejected", reviewed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Suggestion rejected."); queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] }); },
  });

  const deleteClinic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Clinic deleted."); queryClient.invalidateQueries({ queryKey: ["admin-clinics"] }); },
  });

  const flagReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wait_time_reports").update({ is_flagged: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Report flagged."); queryClient.invalidateQueries({ queryKey: ["admin-reports"] }); },
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("google-places", { body: { action: "import", query: importQuery } });
      if (error) throw error;
      toast.success(`Imported ${data?.imported || 0} clinics!`);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    } catch (err: any) {
      toast.error(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

  const totalClinics = clinics?.length || 0;
  const totalSuggestions = suggestions?.length || 0;
  const totalReports = recentReports?.length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="relative overflow-hidden bg-secondary px-3 pb-5 pt-4 sm:px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary to-secondary/80" />
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-secondary-foreground/5" />
        <div className="relative z-10 mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary-foreground/10">
              <LayoutDashboard className="h-4 w-4 text-secondary-foreground" />
            </div>
            <h1 className="text-base font-bold text-secondary-foreground truncate sm:text-lg">Admin Dashboard</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0 text-secondary-foreground hover:bg-secondary-foreground/10">
            <LogOut className="mr-1 h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="mx-auto max-w-4xl grid grid-cols-3 gap-2 px-3 py-4 -mt-1 animate-in fade-in slide-in-from-bottom-2 duration-400 sm:gap-3 sm:px-6">
        <Card className="border-border/50">
          <CardContent className="p-2 text-center sm:p-3">
            <Activity className="mx-auto h-4 w-4 text-primary mb-1 sm:h-5 sm:w-5" />
            <p className="text-xl font-bold text-foreground sm:text-2xl">{totalClinics}</p>
            <p className="text-[9px] text-muted-foreground sm:text-[10px]">Clinics</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2 text-center sm:p-3">
            <Users className="mx-auto h-4 w-4 text-primary mb-1 sm:h-5 sm:w-5" />
            <p className="text-xl font-bold text-foreground sm:text-2xl">{totalSuggestions}</p>
            <p className="text-[9px] text-muted-foreground sm:text-[10px]">Pending</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2 text-center sm:p-3">
            <FileText className="mx-auto h-4 w-4 text-primary mb-1 sm:h-5 sm:w-5" />
            <p className="text-xl font-bold text-foreground sm:text-2xl">{totalReports}</p>
            <p className="text-[9px] text-muted-foreground sm:text-[10px]">Reports</p>
          </CardContent>
        </Card>
      </div>

      <main className="mx-auto max-w-4xl px-3 pb-8 animate-in fade-in duration-500 sm:px-6">
        <Tabs defaultValue="clinics">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="clinics" className="flex-1">Clinics</TabsTrigger>
            <TabsTrigger value="suggestions" className="flex-1">
              Suggestions
              {totalSuggestions > 0 && (
                <Badge variant="destructive" className="ml-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {totalSuggestions}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="clinics" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search clinics..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
            </div>

            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  Import from Google Places
                </CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input placeholder="Search query..." value={importQuery} onChange={(e) => setImportQuery(e.target.value)} />
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
              </CardContent>
            </Card>

            {clinicsLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 rounded-full border-4 border-muted animate-spin border-t-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Specialty</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinics?.map((c) => (
                      <TableRow key={c.id} className="transition-colors">
                        <TableCell>
                          <p className="font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.address}</p>
                        </TableCell>
                        <TableCell>
                          {c.specialty && <Badge variant="secondary" className="text-xs">{c.specialty}</Badge>}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteClinic.mutate(c.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="suggestions" className="space-y-3">
            {suggestions && suggestions.length > 0 ? (
              suggestions.map((s, i) => (
                <Card key={s.id} className="border-border/50 animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                  <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-card-foreground truncate text-sm sm:text-base">{s.doctor_name}</p>
                      <p className="text-xs text-muted-foreground truncate sm:text-sm">{s.address}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="icon" className="h-8 w-8 bg-primary/10 hover:bg-primary/20 text-primary" variant="ghost" onClick={() => approveSuggestion.mutate(s)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" className="h-8 w-8" variant="ghost" onClick={() => rejectSuggestion.mutate(s.id)}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Check className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">All caught up! No pending suggestions.</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="reports">
            <div className="overflow-x-auto rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Wait</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentReports?.map((r: any) => (
                    <TableRow key={r.id} className={r.is_flagged ? "opacity-40" : "transition-colors"}>
                      <TableCell className="text-sm font-medium">{r.clinics?.name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{r.wait_time}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.reported_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {!r.is_flagged && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => flagReport.mutate(r.id)}>
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
