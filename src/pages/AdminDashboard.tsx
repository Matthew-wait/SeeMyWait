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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  LogOut, Loader2, Check, X, Trash2, Search, Download,
  LayoutDashboard, Users, FileText, Activity, Plus, Pencil,
} from "lucide-react";
import { toast } from "sonner";

type Clinic = {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  specialty: string | null;
  latitude: number;
  longitude: number;
  google_place_id: string | null;
  is_active: boolean;
};

type ClinicFormData = {
  name: string;
  address: string;
  phone: string;
  specialty: string;
  latitude: string;
  longitude: string;
};

const emptyForm: ClinicFormData = {
  name: "",
  address: "",
  phone: "",
  specialty: "",
  latitude: "",
  longitude: "",
};

function ClinicFormDialog({
  open,
  onClose,
  onSave,
  initialData,
  isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: ClinicFormData) => void;
  initialData?: ClinicFormData;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<ClinicFormData>(initialData || emptyForm);

  useEffect(() => {
    setForm(initialData || emptyForm);
  }, [initialData, open]);

  const set = (field: keyof ClinicFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      toast.error("Name and address are required.");
      return;
    }
    if (form.latitude && isNaN(parseFloat(form.latitude))) {
      toast.error("Latitude must be a valid number.");
      return;
    }
    if (form.longitude && isNaN(parseFloat(form.longitude))) {
      toast.error("Longitude must be a valid number.");
      return;
    }
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md w-full mx-3">
        <DialogHeader>
          <DialogTitle className="text-base">
            {initialData ? "Edit Doctor / Clinic" : "Add Doctor / Clinic"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Doctor / Clinic Name *</Label>
            <Input id="name" value={form.name} onChange={set("name")} placeholder="Dr. Maria Santos" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="specialty" className="text-xs">Specialty</Label>
            <Input id="specialty" value={form.specialty} onChange={set("specialty")} placeholder="Family Medicine" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs">Address *</Label>
            <Input id="address" value={form.address} onChange={set("address")} placeholder="123 Main St, Miami, FL" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">Phone</Label>
            <Input id="phone" value={form.phone} onChange={set("phone")} placeholder="(305) 555-0100" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="latitude" className="text-xs">Latitude</Label>
              <Input id="latitude" value={form.latitude} onChange={set("latitude")} placeholder="25.7617" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude" className="text-xs">Longitude</Label>
              <Input id="longitude" value={form.longitude} onChange={set("longitude")} placeholder="-80.1918" />
            </div>
          </div>
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (initialData ? "Save Changes" : "Add Clinic")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [importQuery, setImportQuery] = useState("doctor Miami");
  const [importing, setImporting] = useState(false);

  // CRUD dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editClinic, setEditClinic] = useState<Clinic | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
      return (data || []) as Clinic[];
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

  // ── CREATE ──
  const createClinic = useMutation({
    mutationFn: async (form: ClinicFormData) => {
      const { error } = await supabase.from("clinics").insert({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        specialty: form.specialty.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : 25.7617,
        longitude: form.longitude ? parseFloat(form.longitude) : -80.1918,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doctor/Clinic created!");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
    onError: () => toast.error("Failed to create clinic."),
  });

  // ── UPDATE ──
  const updateClinic = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: ClinicFormData }) => {
      const { error } = await supabase.from("clinics").update({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        specialty: form.specialty.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : 25.7617,
        longitude: form.longitude ? parseFloat(form.longitude) : -80.1918,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doctor/Clinic updated!");
      setEditClinic(null);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
    onError: () => toast.error("Failed to update clinic."),
  });

  // ── DELETE ──
  const deleteClinic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Clinic deleted.");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
    onError: () => toast.error("Failed to delete clinic."),
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

  const editFormData = editClinic
    ? {
        name: editClinic.name,
        address: editClinic.address,
        phone: editClinic.phone || "",
        specialty: editClinic.specialty || "",
        latitude: String(editClinic.latitude),
        longitude: String(editClinic.longitude),
      }
    : undefined;

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
            <TabsTrigger value="clinics" className="flex-1">Doctors</TabsTrigger>
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

          {/* ── DOCTORS / CLINICS TAB ── */}
          <TabsContent value="clinics" className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search doctors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)} className="shrink-0 gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Doctor</span>
              </Button>
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
            ) : clinics && clinics.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Specialty</TableHead>
                      <TableHead className="hidden md:table-cell">Address</TableHead>
                      <TableHead className="w-20 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clinics.map((c) => (
                      <TableRow key={c.id} className="transition-colors">
                        <TableCell>
                          <p className="font-medium text-foreground text-sm leading-tight">{c.name}</p>
                          {c.phone && (
                            <p className="text-xs text-muted-foreground mt-0.5">{c.phone}</p>
                          )}
                          {/* Show specialty + address on mobile inline */}
                          {c.specialty && (
                            <Badge variant="secondary" className="mt-1 text-[10px] sm:hidden">
                              {c.specialty}
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5 md:hidden line-clamp-1">{c.address}</p>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {c.specialty && (
                            <Badge variant="secondary" className="text-xs">{c.specialty}</Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <p className="text-xs text-muted-foreground max-w-[200px] truncate">{c.address}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-primary/10"
                              onClick={() => setEditClinic(c)}
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10"
                              onClick={() => setDeleteId(c.id)}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">No doctors found. Add one above!</p>
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
                    <TableHead className="hidden sm:table-cell">Time</TableHead>
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
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
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

      {/* ── CREATE Dialog ── */}
      <ClinicFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={(form) => createClinic.mutate(form)}
        isLoading={createClinic.isPending}
      />

      {/* ── EDIT Dialog ── */}
      <ClinicFormDialog
        open={!!editClinic}
        onClose={() => setEditClinic(null)}
        onSave={(form) => updateClinic.mutate({ id: editClinic!.id, form })}
        initialData={editFormData}
        isLoading={updateClinic.isPending}
      />

      {/* ── DELETE Confirm Dialog ── */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm mx-3">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Doctor / Clinic?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the clinic and all its wait time reports. This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteId(null)} disabled={deleteClinic.isPending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteId && deleteClinic.mutate(deleteId)}
              disabled={deleteClinic.isPending}
            >
              {deleteClinic.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
