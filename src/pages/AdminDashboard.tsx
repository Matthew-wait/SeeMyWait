import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LogOut,
  Loader2,
  Check,
  X,
  Trash2,
  Search,
  Download,
} from "lucide-react";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [importQuery, setImportQuery] = useState("doctor Miami");
  const [importing, setImporting] = useState(false);

  // Check auth
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/admin/login");
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (!roles || roles.role !== "admin") {
        navigate("/admin/login");
      }
    };
    checkAuth();
  }, [navigate]);

  // Clinics
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

  // Suggestions
  const { data: suggestions } = useQuery({
    queryKey: ["admin-suggestions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinic_suggestions")
        .select("*")
        .eq("status", "pending")
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Recent reports
  const { data: recentReports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wait_time_reports")
        .select("*, clinics(name)")
        .order("reported_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const approveSuggestion = useMutation({
    mutationFn: async (suggestion: any) => {
      // Create clinic from suggestion
      const { error: clinicError } = await supabase.from("clinics").insert({
        name: suggestion.doctor_name,
        address: suggestion.address,
        latitude: suggestion.latitude || 25.7617,
        longitude: suggestion.longitude || -80.1918,
        google_place_id: suggestion.google_place_id,
      });
      if (clinicError) throw clinicError;

      // Update suggestion status
      const { error: updateError } = await supabase
        .from("clinic_suggestions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", suggestion.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success("Suggestion approved and clinic added!");
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
    onError: () => toast.error("Failed to approve suggestion."),
  });

  const rejectSuggestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clinic_suggestions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Suggestion rejected.");
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });
    },
  });

  const deleteClinic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clinic deleted.");
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
  });

  const flagReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wait_time_reports")
        .update({ is_flagged: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report flagged.");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
  });

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const { data, error } = await supabase.functions.invoke("google-places", {
        body: { action: "import", query: importQuery },
      });

      if (error) throw error;
      toast.success(`Imported ${data?.imported || 0} clinics!`);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    } catch (err: any) {
      toast.error(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3">
        <h1 className="text-lg font-bold text-foreground">Admin Dashboard</h1>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" />
          Logout
        </Button>
      </header>

      <main className="p-4">
        <Tabs defaultValue="clinics">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="clinics" className="flex-1">Clinics</TabsTrigger>
            <TabsTrigger value="suggestions" className="flex-1">
              Suggestions
              {suggestions && suggestions.length > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {suggestions.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex-1">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="clinics" className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search clinics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Import */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Import from Google Places</CardTitle>
              </CardHeader>
              <CardContent className="flex gap-2">
                <Input
                  placeholder="Search query..."
                  value={importQuery}
                  onChange={(e) => setImportQuery(e.target.value)}
                />
                <Button onClick={handleImport} disabled={importing}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Clinics Table */}
            {clinicsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinics?.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.address}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteClinic.mutate(c.id)}
                          >
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

          <TabsContent value="suggestions" className="space-y-2">
            {suggestions && suggestions.length > 0 ? (
              suggestions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-card-foreground">{s.doctor_name}</p>
                      <p className="text-sm text-muted-foreground">{s.address}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => approveSuggestion.mutate(s)}
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => rejectSuggestion.mutate(s.id)}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No pending suggestions
              </p>
            )}
          </TabsContent>

          <TabsContent value="reports" className="space-y-2">
            <div className="overflow-x-auto">
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
                    <TableRow key={r.id} className={r.is_flagged ? "opacity-50" : ""}>
                      <TableCell className="text-sm">
                        {r.clinics?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.wait_time}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(r.reported_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {!r.is_flagged && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => flagReport.mutate(r.id)}
                          >
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
