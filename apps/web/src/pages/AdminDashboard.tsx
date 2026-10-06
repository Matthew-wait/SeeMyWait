import { ChevronDown } from "lucide-react";
import { getDistanceMiles } from "@/lib/geolocation";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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
import { WaitTimeBadge } from "@/components/WaitTimeBadge";
import { ReportExpiryByCategory, WaitTimeCategory, reportExpiryMinutesFor } from "@/lib/wait-time-utils";
import { addMedicalPlace, addErrorMessage, isNpi, NpiSearchResult, MedicalSearchResult, AddedClinic } from "@/lib/medical-search";
import {
  clinicIdentityKey,
  findDuplicateClinicIdentity,
  isDuplicateKeyError,
} from "@/lib/clinic-dedup";
import {
  LogOut, Loader2, Check, X, Trash2, Search,
  LayoutDashboard, Users, FileText, Activity, Plus, Pencil,
  Upload, FileSpreadsheet, AlertCircle, Settings, RotateCcw,
  Map as MapIcon, MapPin, Crosshair,
} from "lucide-react";
import { toast } from "sonner";
import { MapView } from "@/components/map/MapView";
import { SearchResultsDropdown } from "@/components/map/SearchResultsDropdown";
import { VerifyPlaceCard } from "@/components/map/VerifyPlaceCard";
import { useMedicalSearch } from "@/hooks/use-medical-search";
import { reverseGeocode } from "@/lib/google-places-client";
import { ClinicWithWaitTime } from "@/hooks/use-clinics";

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
  created_at: string;
};

type ClinicSuggestionRow = Database["public"]["Tables"]["clinic_suggestions"]["Row"];
type AppSettingRow = Database["public"]["Tables"]["app_settings"]["Row"];
type WaitTimeReportRow = Database["public"]["Tables"]["wait_time_reports"]["Row"] & {
  clinics: { name: string } | null;
};
type AddressPrediction = {
  description?: unknown;
  place_id?: unknown;
  latitude?: unknown;
  longitude?: unknown;
};

type ClinicFormData = {
  name: string;
  address: string;
  phone: string;
  specialty: string;
  latitude: string;
  longitude: string;
  state: string;
  city: string;
};

type AddressSuggestion = {
  description: string;
  place_id: string;
  latitude?: number | null;
  longitude?: number | null;
};

const emptyForm: ClinicFormData = {
  name: "",
  address: "",
  phone: "",
  specialty: "",
  latitude: "",
  longitude: "",
  state: "FL",
  city: "Miami",
};


function ClinicLocationFields({
  form,
  setForm,
}: {
  form: ClinicFormData;
  setForm: React.Dispatch<React.SetStateAction<ClinicFormData>>;
}) {
  const [addingCity, setAddingCity] = useState(false);
  const { data: cities } = useQuery({
    queryKey: ["city-summary", form.state],
    queryFn: async () => {
      const summary = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: { city: string; n: number }[] | null; error: Error | null }> } };
        };
      };
      const { data, error } = await summary.from("clinic_city_summary").select("city, n").eq("state", form.state).order("n", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60_000,
  });
  const known = (cities || []).some((c) => c.city === form.city);
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs">State *</Label>
        <select
          aria-label="State"
          value={form.state}
          onChange={(e) => { setForm((f) => ({ ...f, state: e.target.value, city: "" })); setAddingCity(false); }}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {US_JURISDICTIONS.map((j) => (
            <option key={j.code} value={j.code}>{j.name}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">City *</Label>
        {addingCity ? (
          <div className="flex gap-1">
            <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="New city name" className="h-9" />
            <Button type="button" size="sm" variant="ghost" onClick={() => setAddingCity(false)}>Back</Button>
          </div>
        ) : (
          <select
            aria-label="City"
            value={known ? form.city : ""}
            onChange={(e) => {
              if (e.target.value === "__new__") { setAddingCity(true); setForm((f) => ({ ...f, city: "" })); return; }
              setForm((f) => ({ ...f, city: e.target.value }));
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Select a city…</option>
            {(cities || []).map((c) => (
              <option key={c.city} value={c.city}>{c.city}</option>
            ))}
            <option value="__new__">+ Add new city…</option>
          </select>
        )}
      </div>
    </div>
  );
}

function ClinicFormDialog({
  open,
  onClose,
  onSave,
  initialData,
  prefill,
  isLoading,
  readOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: ClinicFormData) => void;
  initialData?: ClinicFormData;
  /** NPI-imported rows: view only. */
  readOnly?: boolean;
  /** Seeds a NEW office (create mode) with data from a map tap — coordinates included. */
  prefill?: ClinicFormData;
  isLoading: boolean;
}) {
  const [form, setForm] = useState<ClinicFormData>(initialData || prefill || emptyForm);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSuggestError, setAddressSuggestError] = useState<string | null>(null);
  const [selectedAddressPlaceId, setSelectedAddressPlaceId] = useState<string | null>(null);
  // Suppress the one autocomplete pass a prefilled address would otherwise trigger.
  const skipAutocompleteRef = useRef(false);

  useEffect(() => {
    const seed = initialData || prefill || emptyForm;
    setForm(seed);
    setAddressSuggestions([]);
    setAddressLoading(false);
    setSelectedAddressPlaceId(null);
    skipAutocompleteRef.current = Boolean(prefill?.address);
  }, [initialData, prefill, open]);

  const set = (field: keyof ClinicFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  // Prefill (create-mode seed from a map tap) is still a create, not an edit.
  const isCreateMode = !initialData;

  useEffect(() => {
    if (!open || !isCreateMode) return;
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false;
      return;
    }
    const query = form.address.trim();
    if (query.length < 3) {
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressSuggestError(null);
      return;
    }

    setAddressLoading(true);
    setAddressSuggestError(null);
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("medical-search", {
          body: { action: "autocomplete", query },
        });
        if (error) throw error;
        const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
        setAddressSuggestions(
          predictions
            .map((p: AddressPrediction) => ({
              description: String(p?.description ?? ""),
              place_id: String(p?.place_id ?? ""),
              latitude: typeof p?.latitude === "number" ? p.latitude : null,
              longitude: typeof p?.longitude === "number" ? p.longitude : null,
            }))
            .filter((p) => p.description && p.place_id)
            .slice(0, 8)
        );
      } catch {
        setAddressSuggestError("Unable to load address suggestions. Please try again.");
        setAddressSuggestions([]);
      } finally {
        setAddressLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [form.address, open, isCreateMode]);

  const handleAddressInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextAddress = e.target.value;
    setSelectedAddressPlaceId(null);
    setAddressSuggestError(null);
    setForm((f) => ({ ...f, address: nextAddress }));
  };

  const selectAddressSuggestion = async (suggestion: AddressSuggestion) => {
    setSelectedAddressPlaceId(suggestion.place_id);
    setAddressSuggestions([]);
    setForm((f) => ({ ...f, address: suggestion.description }));

    // Photon predictions carry coordinates inline; fall back to a geocode call
    // only if a suggestion somehow arrives without them.
    let lat = suggestion.latitude ?? null;
    let lng = suggestion.longitude ?? null;
    if (lat === null || lng === null) {
      try {
        const { data, error } = await supabase.functions.invoke("medical-search", {
          body: { action: "geocode", query: suggestion.description },
        });
        if (error) throw error;
        const loc = data?.results?.[0]?.geometry?.location;
        lat = typeof loc?.lat === "number" ? loc.lat : null;
        lng = typeof loc?.lng === "number" ? loc.lng : null;
      } catch {
        toast.error("Unable to fetch location details for this address.");
        return;
      }
    }

    setForm((f) => ({
      ...f,
      latitude: typeof lat === "number" ? String(lat) : f.latitude,
      longitude: typeof lng === "number" ? String(lng) : f.longitude,
    }));
  };

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
          <DialogTitle className="text-base flex items-center gap-2">
            {readOnly ? "Doctor Office" : initialData ? "Edit Doctor Office" : "Add Doctor Office"}
            {readOnly && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">NPI imported · view only</span>}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          <fieldset disabled={readOnly} className="contents">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-xs">Doctor Office Name *</Label>
            <Input id="name" value={form.name} onChange={set("name")} placeholder="e.g. Dr. Maria Santos" className="placeholder:text-muted-foreground/50" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="specialty" className="text-xs">Specialty</Label>
            <Input id="specialty" value={form.specialty} onChange={set("specialty")} placeholder="e.g. Family Medicine" className="placeholder:text-muted-foreground/50" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address" className="text-xs">Address *</Label>
            <div className="relative">
              <Input
                id="address"
                value={form.address}
                onChange={isCreateMode ? handleAddressInput : set("address")}
                placeholder="Start typing an address…"
                className="placeholder:text-muted-foreground/50"
                autoComplete="off"
                required
              />
              {isCreateMode && (addressLoading || addressSuggestions.length > 0 || addressSuggestError) && (
                <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                  {addressLoading ? (
                    <p className="px-2 py-2 text-xs text-muted-foreground">Loading suggestions…</p>
                  ) : addressSuggestError ? (
                    <p className="px-2 py-2 text-xs text-destructive">{addressSuggestError}</p>
                  ) : (
                    addressSuggestions.map((suggestion) => (
                      <button
                        type="button"
                        key={suggestion.place_id}
                        onClick={() => selectAddressSuggestion(suggestion)}
                        className="w-full rounded-sm px-2 py-2 text-left text-xs text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                      >
                        {suggestion.description}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {isCreateMode && (
              <p className="text-[11px] text-muted-foreground">
                Choose from suggestions for best accuracy, or enter address manually.
              </p>
            )}
          </div>
          <ClinicLocationFields form={form} setForm={setForm} />
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-xs">Phone</Label>
            <Input id="phone" value={form.phone} onChange={set("phone")} placeholder="e.g. (305) 555-0100" className="placeholder:text-muted-foreground/50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="latitude" className="text-xs">Latitude</Label>
              <Input id="latitude" value={form.latitude} onChange={set("latitude")} placeholder="e.g. 25.7617" className="placeholder:text-muted-foreground/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="longitude" className="text-xs">Longitude</Label>
              <Input id="longitude" value={form.longitude} onChange={set("longitude")} placeholder="e.g. -80.1918" className="placeholder:text-muted-foreground/50" />
            </div>
          </div>
          </fieldset>
          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isLoading}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button type="submit" size="sm" disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (initialData ? "Save Changes" : "Add Doctor Office")}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── CSV Upload Dialog ── */
function CsvUploadDialog({
  open,
  onClose,
  onUploadComplete,
}: {
  open: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}) {
  const resolveCsvCoordinates = async (
    address: string,
    latText?: string,
    lngText?: string
  ): Promise<{ latitude: number; longitude: number }> => {
    const parsedLat = latText ? parseFloat(latText) : NaN;
    const parsedLng = lngText ? parseFloat(lngText) : NaN;
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      return { latitude: parsedLat, longitude: parsedLng };
    }

    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: { action: "geocode", query: address },
    });
    if (error) throw error;
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    const lat = first?.geometry?.location?.lat;
    const lng = first?.geometry?.location?.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      return { latitude: lat, longitude: lng };
    }
    throw new Error("COORDINATES_NOT_FOUND");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const reset = () => {
    setFile(null);
    setPreview([]);
    setErrors([]);
  };

  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^['"]|['"]$/g, ""));
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] || "";
      });
      return obj;
    });
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setErrors([]);
    try {
      const text = await f.text();
      const rows = parseCSV(text);
      if (rows.length === 0) {
        setErrors(["No data rows found in file."]);
        return;
      }
      // Validate required columns
      const first = rows[0];
      const hasName = "name" in first || "doctor_name" in first || "clinic_name" in first;
      const hasAddress = "address" in first;
      if (!hasName || !hasAddress) {
        setErrors([
          `Missing required columns. Found: ${Object.keys(first).join(", ")}`,
          "Required: name (or doctor_name), address",
        ]);
        return;
      }
      setPreview(rows.slice(0, 5));
    } catch {
      setErrors(["Failed to read file."]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setErrors([]);
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      const errs: string[] = [];
      let inserted = 0;

      const { data: existingClinics, error: loadErr } = await supabase
        .from("clinics")
        .select("id,name,address");
      if (loadErr) throw loadErr;
      const seenKeys = new Set(
        (existingClinics || []).map((c) => clinicIdentityKey(c.name, c.address))
      );

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const name = r["name"] || r["doctor_name"] || r["clinic_name"] || "";
        const address = r["address"] || "";
        if (!name.trim() || !address.trim()) {
          errs.push(`Row ${i + 2}: Missing name or address, skipped.`);
          continue;
        }
        const key = clinicIdentityKey(name, address);
        if (seenKeys.has(key)) {
          errs.push(
            `Row ${i + 2}: Duplicate name and address (already in database or earlier in this file), skipped.`
          );
          continue;
        }
        let coords: { latitude: number; longitude: number };
        try {
          coords = await resolveCsvCoordinates(
            address.trim(),
            r["latitude"] || r["lat"] || "",
            r["longitude"] || r["lng"] || r["lon"] || ""
          );
        } catch {
          errs.push(
            `Row ${i + 2}: Could not resolve coordinates from address; provide valid latitude/longitude or a more specific address.`
          );
          continue;
        }

        const { error } = await supabase.from("clinics").insert({ npi_imported: false,
          name: name.trim(),
          address: address.trim(),
          phone: (r["phone"] || "").trim() || null,
          specialty: (r["specialty"] || "").trim() || null,
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        if (error) {
          if (isDuplicateKeyError(error)) {
            errs.push(
              `Row ${i + 2}: Duplicate name and address (already exists), skipped.`
            );
          } else {
            errs.push(`Row ${i + 2}: ${error.message}`);
          }
        } else {
          seenKeys.add(key);
          inserted++;
        }
      }

      if (inserted > 0) {
        toast.success(`Successfully imported ${inserted} doctor(s)!`);
        onUploadComplete();
      }
      if (errs.length > 0) {
        setErrors(errs.slice(0, 10));
      } else {
        onClose();
        reset();
      }
    } catch {
      toast.error("Failed to process file.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { onClose(); reset(); } }}>
      <DialogContent className="max-w-lg w-full mx-3">
        <DialogHeader>
          <DialogTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Bulk Import Doctors (CSV)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Instructions */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">CSV Format</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Your CSV must include columns: <strong>name</strong> (or doctor_name), <strong>address</strong>.
              Optional: specialty, phone, latitude, longitude.
            </p>
            <div className="rounded-lg bg-background/50 border border-border/30 p-2 font-mono text-[10px] text-muted-foreground overflow-x-auto">
              name,address,specialty,phone,latitude,longitude<br />
              Dr. Smith,123 Main St Miami FL,Cardiology,(305) 555-0100,25.76,-80.19
            </div>
          </div>

          {/* Drop zone */}
          <div
            className="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/50 bg-background/50 p-6 cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {file ? file.name : "Click to select CSV or Excel file"}
            </p>
            {file && (
              <Badge variant="secondary" className="text-[10px]">
                {(file.size / 1024).toFixed(1)} KB
              </Badge>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded-lg border border-border/40">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {Object.keys(preview[0]).slice(0, 5).map((h) => (
                        <TableHead key={h} className="text-[10px] py-1.5 px-2 whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => (
                      <TableRow key={i}>
                        {Object.keys(preview[0]).slice(0, 5).map((h) => (
                          <TableCell key={h} className="text-[10px] py-1 px-2 max-w-[120px] truncate">{row[h]}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                <p className="text-xs font-medium text-destructive">Issues Found</p>
              </div>
              {errors.map((err, i) => (
                <p key={i} className="text-[11px] text-destructive/80">{err}</p>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { onClose(); reset(); }} disabled={uploading}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleUpload}
            disabled={uploading || !file || preview.length === 0}
            className="gap-1.5"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Import {preview.length > 0 ? `(${preview.length}+ rows)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function SearchableSelect({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = "Select…",
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={`flex h-9 items-center justify-between gap-2 rounded-md border border-input bg-background px-2 text-left text-sm ${className ?? ""}`}
        >
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>{selected?.label ?? placeholder}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${ariaLabel.toLowerCase()}…`} />
          <CommandList>
            <CommandEmpty>No match.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                >
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const US_JURISDICTIONS: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
  { code: "PR", name: "Puerto Rico" }, { code: "GU", name: "Guam" }, { code: "VI", name: "U.S. Virgin Islands" },
  { code: "AS", name: "American Samoa" }, { code: "MP", name: "Northern Mariana Islands" },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("clinics");
  const [searchQuery, setSearchQuery] = useState("");
  const [csvOpen, setCsvOpen] = useState(false);
  const [showActiveReports, setShowActiveReports] = useState(true);
  const [nearbyRadius, setNearbyRadius] = useState("");
  /** Per-device "wait before reporting again" cooldown — unrelated to how
   *  long a report stays active (see the expiry-by-category fields below). */
  const [cooldownMinutes, setCooldownMinutes] = useState("");
  const [geofenceMeters, setGeofenceMeters] = useState("");
  const [expiry30MinMinutes, setExpiry30MinMinutes] = useState("");
  const [expiry60MinMinutes, setExpiry60MinMinutes] = useState("");
  const [expiry90PlusMinutes, setExpiry90PlusMinutes] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  // CRUD dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [editClinic, setEditClinic] = useState<Clinic | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  /** Seeds the create dialog from a map tap (name/address + exact coordinates). */
  const [prefillData, setPrefillData] = useState<ClinicFormData | null>(null);

  // Map-tab add flows (search / POI tap / custom pin)
  const [mapSearch, setMapSearch] = useState("");
  const [mapDropdownOpen, setMapDropdownOpen] = useState(false);
  const [mapCandidate, setMapCandidate] = useState<NpiSearchResult | null>(null);
  const [pendingPoint, setPendingPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [adminLoc, setAdminLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenterOn, setMapCenterOn] = useState<{ lat: number; lng: number; zoom?: number } | null>(null);
  const [mapFocus, setMapFocus] = useState<Clinic | null>(null);
  const [doctorsView, setDoctorsView] = useState<"list" | "map">("list");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/admin/login"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      if (!roles || roles.role !== "admin") navigate("/admin/login");
    };
    checkAuth();
  }, [navigate]);

  const splitRef = useRef<HTMLDivElement>(null);
  const [splitHeight, setSplitHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const fit = () => {
      const el = splitRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setSplitHeight(Math.max(320, Math.floor(window.innerHeight - top - 16)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  const [filterState, setFilterState] = useState("FL");
  const [filterCity, setFilterCity] = useState("Miami");

  const { data: cityOptions } = useQuery({
    queryKey: ["city-summary", filterState],
    enabled: !!filterState,
    queryFn: async () => {
      // Table is newer than the generated types; typed locally.
      const summary = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => Promise<{ data: { city: string; n: number }[] | null; error: Error | null }> } };
        };
      };
      const { data, error } = await summary
        .from("clinic_city_summary")
        .select("city, n")
        .eq("state", filterState)
        .order("n", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60_000,
  });
  const cityTotal = cityOptions?.find((c) => c.city === filterCity)?.n ?? 0;
  const { data: specialtyOptions } = useQuery({
    queryKey: ["specialty-summary", filterState],
    enabled: !!filterState,
    queryFn: async () => {
      const summary = supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => { eq: (k: string, v: string) => { order: (k: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: { specialty: string; n: number }[] | null; error: Error | null }> } } };
        };
      };
      const { data, error } = await summary
        .from("clinic_specialty_summary")
        .select("specialty, n")
        .eq("state", filterState)
        .order("n", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60_000,
  });

  // Only ever fetch one page: the table is too large to sort or load whole.
  // Browsing uses the primary-key index; search uses the name trigram index.
  const [clinicsLimit, setClinicsLimit] = useState(50);
  const [specialtyFilter, setSpecialtyFilter] = useState("");
  const [letterFilter, setLetterFilter] = useState("");
  const [radiusMiles, setRadiusMiles] = useState("");
  useEffect(() => { setClinicsLimit(50); }, [searchQuery, specialtyFilter, letterFilter]);
  useEffect(() => { setClinicsLimit(50); }, [filterState, filterCity]);
  const { data: clinics, isLoading: clinicsLoading, isFetching: clinicsFetching } = useQuery({
    queryKey: ["admin-clinics", filterState, filterCity, searchQuery, specialtyFilter, letterFilter, clinicsLimit],
    enabled: !!filterState && !!filterCity,
    // Keep the rows on screen while Load more fetches the bigger page.
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let q = supabase.from("clinics").select("*").eq("state", filterState).eq("city", filterCity).limit(clinicsLimit);
      const term = searchQuery.trim().replace(/[,()]/g, " ");
      if (term) q = q.or(`name.ilike.%${term}%,address.ilike.%${term}%,npi.eq.${term}`);
      else q = q.order("name");
      if (specialtyFilter) q = q.eq("specialty", specialtyFilter);
      if (letterFilter) q = q.ilike("name", `${letterFilter}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Clinic[];
    },
  });
  const clinicsHasMore = (clinics?.length ?? 0) === clinicsLimit;
  const visibleClinics = useMemo(() => {
    const r = Number(radiusMiles);
    if (!clinics || !adminLoc || !(r > 0)) return clinics;
    return clinics.filter((c) => getDistanceMiles(adminLoc.lat, adminLoc.lng, c.latitude, c.longitude) <= r);
  }, [clinics, adminLoc, radiusMiles]);
  const listScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0 });
  }, [filterState, filterCity, letterFilter, searchQuery, specialtyFilter]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedMore, setLoadedMore] = useState(false);
  useEffect(() => {
    if (!loadingMore || clinicsFetching) return;
    setLoadingMore(false);
    setLoadedMore(true);
    const t = setTimeout(() => setLoadedMore(false), 2000);
    return () => clearTimeout(t);
  }, [loadingMore, clinicsFetching]);

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
      const { data, error } = await supabase.from("wait_time_reports").select("*, clinics(name)").order("reported_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: appSettings } = useQuery({
    queryKey: ["admin-app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key, value");
      if (error) throw error;
      return data || [];
    },
  });

  // Load settings into state
  useEffect(() => {
    if (appSettings) {
      const radius = appSettings.find((s: AppSettingRow) => s.key === "nearby_radius_miles");
      const cooldown = appSettings.find((s: AppSettingRow) => s.key === "report_cooldown_minutes");
      if (radius) setNearbyRadius(radius.value);
      if (cooldown) setCooldownMinutes(cooldown.value);
      const geofence = appSettings.find((s: AppSettingRow) => s.key === "report_geofence_meters");
      if (geofence) setGeofenceMeters(geofence.value);
      const expiry30 = appSettings.find((s: AppSettingRow) => s.key === "report_expiry_30min_minutes");
      if (expiry30) setExpiry30MinMinutes(expiry30.value);
      const expiry60 = appSettings.find((s: AppSettingRow) => s.key === "report_expiry_60min_minutes");
      if (expiry60) setExpiry60MinMinutes(expiry60.value);
      const expiry90 = appSettings.find((s: AppSettingRow) => s.key === "report_expiry_90plus_minutes");
      if (expiry90) setExpiry90PlusMinutes(expiry90.value);
    }
  }, [appSettings]);

  // Each wait-time category reverts to On Time on its own schedule — not one
  // flat window shared with the device cooldown.
  const reportExpiry: ReportExpiryByCategory = useMemo(
    () => ({
      report_expiry_30min_minutes: parseInt(expiry30MinMinutes || "30", 10) || 30,
      report_expiry_60min_minutes: parseInt(expiry60MinMinutes || "60", 10) || 60,
      report_expiry_90plus_minutes: parseInt(expiry90PlusMinutes || "90", 10) || 90,
    }),
    [expiry30MinMinutes, expiry60MinMinutes, expiry90PlusMinutes]
  );

  const isReportActive = useCallback(
    (r: WaitTimeReportRow) => {
      const ageMinutes = (Date.now() - new Date(r.reported_at).getTime()) / 60000;
      return ageMinutes <= reportExpiryMinutesFor(r.wait_time as WaitTimeCategory, reportExpiry);
    },
    [reportExpiry]
  );

  const filteredReports = useMemo(() => {
    if (!recentReports) return [];
    return recentReports.filter((r: WaitTimeReportRow) => {
      const isActive = isReportActive(r);
      return showActiveReports ? isActive : !isActive;
    });
  }, [recentReports, showActiveReports, isReportActive]);

  const activeReportCount = useMemo(() => {
    if (!recentReports) return 0;
    return recentReports.filter((r: WaitTimeReportRow) => isReportActive(r) && !r.is_flagged).length;
  }, [recentReports, isReportActive]);


  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const updates = [
        { key: "nearby_radius_miles", value: nearbyRadius },
        { key: "report_cooldown_minutes", value: cooldownMinutes },
        { key: "report_geofence_meters", value: geofenceMeters },
        { key: "report_expiry_30min_minutes", value: expiry30MinMinutes },
        { key: "report_expiry_60min_minutes", value: expiry60MinMinutes },
        { key: "report_expiry_90plus_minutes", value: expiry90PlusMinutes },
      ];
      for (const u of updates) {
        const { error } = await supabase.from("app_settings").update({ value: u.value }).eq("key", u.key);
        if (error) throw error;
      }
      toast.success("Settings saved!");
      queryClient.invalidateQueries({ queryKey: ["admin-app-settings"] });
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    } catch {
      toast.error("Failed to save settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  // ── CREATE ──
  const resolveClinicCoordinates = async (
    address: string,
    latitudeText?: string,
    longitudeText?: string
  ): Promise<{ latitude: number; longitude: number }> => {
    const parsedLat = latitudeText ? parseFloat(latitudeText) : NaN;
    const parsedLng = longitudeText ? parseFloat(longitudeText) : NaN;
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      return { latitude: parsedLat, longitude: parsedLng };
    }

    const { data, error } = await supabase.functions.invoke("medical-search", {
      body: { action: "geocode", query: address },
    });
    if (error) throw error;
    const first = Array.isArray(data?.results) ? data.results[0] : null;
    const lat = first?.geometry?.location?.lat;
    const lng = first?.geometry?.location?.lng;
    if (typeof lat === "number" && typeof lng === "number") {
      return { latitude: lat, longitude: lng };
    }

    throw new Error("COORDINATES_NOT_FOUND");
  };

  const createClinic = useMutation({
    mutationFn: async (form: ClinicFormData) => {
      const { data: existing, error: loadErr } = await supabase
        .from("clinics")
        .select("id,name,address");
      if (loadErr) throw loadErr;
      if (findDuplicateClinicIdentity(existing || [], form.name, form.address)) {
        throw new Error("DUPLICATE_CLINIC");
      }
      const coords = await resolveClinicCoordinates(
        form.address.trim(),
        form.latitude,
        form.longitude
      );
      const { error } = await supabase.from("clinics").insert({ npi_imported: false,
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        specialty: form.specialty.trim() || null,
        state: form.state,
        city: form.city.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doctor Office created!");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
    onError: (err) => {
      if (isDuplicateKeyError(err) || (err as Error)?.message === "DUPLICATE_CLINIC") {
        toast.error("A doctor office with this name and address already exists.");
      } else if ((err as Error)?.message === "COORDINATES_NOT_FOUND") {
        toast.error("Could not locate this address. Pick a suggestion or enter valid coordinates.");
      } else {
        toast.error("Failed to create doctor office.");
      }
    },
  });

  // ── UPDATE ──
  const updateClinic = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: ClinicFormData }) => {
      const { data: existing, error: loadErr } = await supabase
        .from("clinics")
        .select("id,name,address");
      if (loadErr) throw loadErr;
      if (findDuplicateClinicIdentity(existing || [], form.name, form.address, id)) {
        throw new Error("DUPLICATE_CLINIC");
      }
      const coords = await resolveClinicCoordinates(
        form.address.trim(),
        form.latitude,
        form.longitude
      );
      if ((editClinic as { npi_imported?: boolean | null } | null)?.npi_imported) throw new Error("NPI-imported offices are view only.");
      const { error } = await supabase.from("clinics").update({
        name: form.name.trim(),
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        specialty: form.specialty.trim() || null,
        state: form.state,
        city: form.city.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doctor Office updated!");
      setEditClinic(null);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
    onError: (err) => {
      if (isDuplicateKeyError(err) || (err as Error)?.message === "DUPLICATE_CLINIC") {
        toast.error("Another doctor office already uses this name and address.");
      } else if ((err as Error)?.message === "COORDINATES_NOT_FOUND") {
        toast.error("Could not locate this address. Pick a suggestion or enter valid coordinates.");
      } else {
        toast.error("Failed to update doctor office.");
      }
    },
  });

  // ── DELETE ──
  const deleteClinic = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clinics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Doctor Office deleted.");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    },
    onError: () => toast.error("Failed to delete doctor office."),
  });

  const resetClinicWaitTimes = useMutation({
    mutationFn: async (clinicId: string) => {
      // Delete anything that could still be "active" under any category's
      // expiry — the longest of the three, so a reset is never partial.
      const expiryMinutes = Math.max(
        reportExpiry.report_expiry_30min_minutes,
        reportExpiry.report_expiry_60min_minutes,
        reportExpiry.report_expiry_90plus_minutes
      );
      const cutoffIso = new Date(Date.now() - expiryMinutes * 60 * 1000).toISOString();
      const { error } = await supabase
        .from("wait_time_reports")
        .delete()
        .eq("clinic_id", clinicId)
        .gte("reported_at", cutoffIso);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Current wait reports reset.");
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      queryClient.invalidateQueries({ queryKey: ["clinics"] });
      queryClient.invalidateQueries({ queryKey: ["clinic"] });
    },
    onError: () => toast.error("Failed to reset wait reports."),
  });

  /** Error codes the `medical-search` add action can return (see handoff §4.2). */
  const ADD_ACTION_ERRORS = new Set([
    "not_medical",
    "permanently_closed",
    "no_coordinates",
    "lookup_failed",
    "insert_failed",
    "rate_limited",
    "ADD_FAILED",
  ]);

  const approveSuggestion = useMutation({
    mutationFn: async (suggestion: ClinicSuggestionRow) => {
      const name = String(suggestion.doctor_name ?? "").trim();
      const address = String(suggestion.address ?? "").trim();
      const { data: existing, error: loadErr } = await supabase
        .from("clinics")
        .select("id,name,address");
      if (loadErr) throw loadErr;
      if (findDuplicateClinicIdentity(existing || [], name, address)) {
        throw new Error("DUPLICATE_CLINIC");
      }
      // Preferred path: hand the NPI to the edge function's `add` action. It is
      // the only writer that gets idempotency plus the partial-unique dedup on
      // `npi`, so re-approving can't create a twin.
      if (isNpi(suggestion.npi)) {
        const result = await addMedicalPlace(suggestion.npi);
        if (!result.ok) throw new Error(result.error || "ADD_FAILED");
      } else {
        // Suggestions with no NPI (custom map points, legacy rows) are inserted
        // directly with their submitted coordinates.
        const coords = await resolveClinicCoordinates(
          address,
          typeof suggestion.latitude === "number" ? String(suggestion.latitude) : undefined,
          typeof suggestion.longitude === "number" ? String(suggestion.longitude) : undefined
        );
        const { error: clinicError } = await supabase.from("clinics").insert({ npi_imported: false,
          name,
          address,
          latitude: coords.latitude,
          longitude: coords.longitude,
          google_place_id: null,
        });
        if (clinicError) throw clinicError;
      }
      const { error: updateError } = await supabase.from("clinic_suggestions").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", suggestion.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => { toast.success("Suggestion approved!"); queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] }); queryClient.invalidateQueries({ queryKey: ["admin-clinics"] }); },
    onError: (err) => {
      if (isDuplicateKeyError(err) || (err as Error)?.message === "DUPLICATE_CLINIC") {
        toast.error("A doctor office with this name and address already exists.");
      } else if ((err as Error)?.message === "COORDINATES_NOT_FOUND") {
        toast.error("Suggestion address could not be located. Ask user/admin to provide a more precise address.");
      } else if (ADD_ACTION_ERRORS.has((err as Error)?.message)) {
        // Typed failure from the edge function's `add` action — show its reason
        // rather than a generic "failed", so the admin knows why.
        toast.error(addErrorMessage((err as Error).message));
      } else {
        toast.error("Failed to approve suggestion.");
      }
    },
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

  const unflagReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wait_time_reports").update({ is_flagged: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Report restored."); queryClient.invalidateQueries({ queryKey: ["admin-reports"] }); },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wait_time_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Report deleted."); queryClient.invalidateQueries({ queryKey: ["admin-reports"] }); },
    onError: () => toast.error("Failed to delete report."),
  });

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/"); };

  // ── Map tab: three add-methods (search / POI tap / custom pin) ──
  const mapSearchState = useMedicalSearch(
    mapSearch,
    adminLoc ? { latitude: adminLoc.lat, longitude: adminLoc.lng } : null
  );

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setAdminLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  // Adapt admin clinic rows to the shape MapView renders (all default to the
  // green "On Time" pin; the admin map is for adding, not wait status).
  const mapClinics: ClinicWithWaitTime[] = useMemo(
    () =>
      (visibleClinics || []).map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        latitude: c.latitude,
        longitude: c.longitude,
        phone: c.phone,
        google_place_id: c.google_place_id,
        specialty: c.specialty,
        waitTime: { category: "on_time", label: "On Time", lastReported: null },
        recentReports: [],
      })),
    [visibleClinics]
  );

  /** Open the create dialog on the Doctors tab, seeded from a map tap. */
  const openPrefilledCreate = (data: Partial<ClinicFormData>) => {
    setMapCandidate(null);
    setPendingPoint(null);
    setMapDropdownOpen(false);
    setPrefillData({ ...emptyForm, ...data });
    setActiveTab("clinics");
    setCreateOpen(true);
  };

  const handleMapSelectResult = (result: MedicalSearchResult) => {
    setMapDropdownOpen(false);
    if (result.source === "db") {
      // Already saved — jump to its edit dialog.
      const existing = clinics?.find((c) => c.id === result.id);
      if (existing) setEditClinic(existing);
      else toast.info("Already in the directory.");
      return;
    }
    // An NPPES candidate — confirm before saving.
    setMapCandidate(result);
  };

  const handleMapVerified = (added: AddedClinic) => {
    setMapCandidate(null);
    setMapSearch("");
    queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
    toast.success(`${added.name} added.`);
  };

  const handleMapPointClick = (point: { lat: number; lng: number }) => {
    setMapDropdownOpen(false);
    setPendingPoint(point);
  };

  /** Center the map on the admin's exact current GPS position. */
  const handleAdminLocate = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't supported by this browser.");
      return;
    }
    const toastId = toast.loading("Locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss(toastId);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setAdminLoc(loc);
        setMapCenterOn({ ...loc, zoom: 15 });
      },
      () => {
        toast.dismiss(toastId);
        toast.error("Couldn't get your location. Check location permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const confirmAddHere = async () => {
    if (!pendingPoint) return;
    const point = pendingPoint;
    setPendingPoint(null);
    const toastId = toast.loading("Locating…");
    const geo = await reverseGeocode(point.lat, point.lng);
    toast.dismiss(toastId);
    // Coordinates come from the exact tapped point — authoritative.
    openPrefilledCreate({
      address: geo?.address ?? "",
      latitude: point.lat.toFixed(6),
      longitude: point.lng.toFixed(6),
    });
  };

  const { data: totalClinics } = useQuery({
    queryKey: ["admin-clinic-total"],
    queryFn: async () => {
      // Planner estimate: an exact count scans all rows and times out at this size.
      const { count, error } = await supabase.from("clinics").select("*", { count: "estimated", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
  const totalSuggestions = suggestions?.length || 0;

  const editFormData = editClinic
    ? {
        name: editClinic.name,
        address: editClinic.address,
        phone: editClinic.phone || "",
        specialty: editClinic.specialty || "",
        latitude: String(editClinic.latitude),
        longitude: String(editClinic.longitude),
        state: (editClinic as { state?: string | null }).state || "FL",
        city: (editClinic as { city?: string | null }).city || "",
      }
    : undefined;

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Header */}
      <header className="sticky top-0 z-50 overflow-hidden bg-gradient-to-br from-primary via-primary to-primary/80 px-10 pb-3 pt-2">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary to-secondary/80" />
        <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary-foreground/5" />
        <div className="relative z-10 w-full flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/10">
              <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-base font-bold text-primary-foreground truncate sm:text-lg">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setActiveTab("settings")}
              className="sm:hidden h-8 w-8 shrink-0 text-primary-foreground hover:bg-primary-foreground/10"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="shrink-0 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <LogOut className="sm:mr-1 h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className={`mx-auto w-full max-w-[1440px] grid gap-2 px-10 py-4 -mt-1 animate-in fade-in slide-in-from-bottom-2 duration-400 sm:gap-3 ${({ 3: "grid-cols-3", 4: "grid-cols-4", 5: "grid-cols-5" } as Record<number, string>)[3 + (filterState ? 1 : 0) + (filterCity ? 1 : 0)]}`}>
        <Card className="border-border/50">
          <CardContent className="p-2 text-center sm:p-3">
            <Activity className="mx-auto h-4 w-4 text-primary mb-1 sm:h-5 sm:w-5" />
            <p className="text-xl font-bold text-foreground sm:text-2xl">{(totalClinics ?? 0).toLocaleString("en-US")}</p>
            <p className="text-[9px] text-muted-foreground sm:text-[10px]">Doctor Offices</p>
          </CardContent>
        </Card>
        {filterState && (
          <Card className="border-border/50">
            <CardContent className="p-2 text-center sm:p-3">
              <MapPin className="mx-auto h-4 w-4 text-primary mb-1 sm:h-5 sm:w-5" />
              <p className="text-xl font-bold text-foreground sm:text-2xl">
                {(cityOptions || []).reduce((sum, c) => sum + c.n, 0).toLocaleString("en-US")}
              </p>
              <p className="text-[9px] text-muted-foreground sm:text-[10px]">
                {US_JURISDICTIONS.find((j) => j.code === filterState)?.name ?? filterState} offices
              </p>
            </CardContent>
          </Card>
        )}
        {filterCity && (
          <Card className="border-border/50">
            <CardContent className="p-2 text-center sm:p-3">
              <MapPin className="mx-auto h-4 w-4 text-primary mb-1 sm:h-5 sm:w-5" />
              <p className="text-xl font-bold text-foreground sm:text-2xl">{cityTotal.toLocaleString("en-US")}</p>
              <p className="text-[9px] text-muted-foreground sm:text-[10px]">{filterCity} offices</p>
            </CardContent>
          </Card>
        )}
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
            <p className="text-xl font-bold text-foreground sm:text-2xl">{activeReportCount}</p>
            <p className="text-[9px] text-muted-foreground sm:text-[10px]">Active Reports</p>
          </CardContent>
        </Card>
      </div>

      <main className="mx-auto w-full max-w-[1440px] px-10 pb-8 animate-in fade-in duration-500">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="mb-4">
            <TabsList className="grid w-full grid-cols-4 gap-1 p-1 bg-primary/15">
              <TabsTrigger value="clinics" className="w-full whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">Doctors</TabsTrigger>
              <TabsTrigger value="suggestions" className="w-full whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
              <span className="hidden sm:inline">Suggestions</span>
              <span className="sm:hidden">Suggest</span>
              {totalSuggestions > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 w-4 sm:h-5 sm:w-5 p-0 flex items-center justify-center text-[9px] sm:text-[10px]">
                  {totalSuggestions}
                </Badge>
              )}
              </TabsTrigger>
              <TabsTrigger value="reports" className="w-full whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">Reports</TabsTrigger>
              <TabsTrigger value="settings" className="hidden sm:flex w-full whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3">
              <Settings className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── MAP TAB — add via search / POI tap / custom pin ── */}


          {/* ── DOCTORS / CLINICS TAB ── */}
          <TabsContent value="clinics" className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Choose State <span className="text-destructive">*</span></span>
              <SearchableSelect
                ariaLabel="State"
                placeholder="Choose a state"
                className="w-56"
                value={filterState}
                options={US_JURISDICTIONS.map((j) => ({ value: j.code, label: j.name }))}
                onChange={(code) => { setFilterState(code); setFilterCity(""); setSpecialtyFilter(""); }}
              />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Choose City <span className="text-destructive">*</span></span>
              <SearchableSelect
                ariaLabel="City"
                placeholder={filterState ? "Choose a city" : "Choose a state first"}
                className="w-64"
                value={filterCity}
                options={(cityOptions || []).map((c) => ({ value: c.city, label: `${c.city} (${c.n.toLocaleString("en-US")})` }))}
                onChange={setFilterCity}
              />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Specialty</span>
                <select
                aria-label="Specialty"
                value={specialtyFilter}
                onChange={(e) => setSpecialtyFilter(e.target.value)}
                className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">All specialties</option>
                {(specialtyOptions || []).map((sp) => (
                  <option key={sp.specialty} value={sp.specialty}>{sp.specialty} ({sp.n.toLocaleString("en-US")})</option>
                ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Radius (mi)</span>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  aria-label="Radius in miles"
                  placeholder="All"
                  value={radiusMiles}
                  onChange={(e) => setRadiusMiles(e.target.value)}
                  title={adminLoc ? "Radius from your location" : "Locate yourself (map locate button) to apply the radius"}
                  className="h-9 w-24 rounded-md border border-input bg-background px-2 text-sm"
                />
              </div>
              <div className="ml-auto">
                <div className="inline-flex rounded-lg border border-border/50 bg-muted/40 p-0.5">
                <button type="button" onClick={() => setDoctorsView("list")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${doctorsView === "list" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>List</button>
                <button type="button" onClick={() => setDoctorsView("map")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${doctorsView === "map" ? "bg-card text-primary shadow-sm" : "text-muted-foreground"}`}>Map</button>
              </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Name, address, or NPI..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Button size="sm" onClick={() => { setPrefillData(null); setCreateOpen(true); }} className="shrink-0 gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>
              <Button size="sm" variant="outline" onClick={() => setCsvOpen(true)} className="shrink-0 gap-1.5">
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => setLetterFilter("")} className={`h-7 min-w-7 rounded-md px-2 text-xs font-semibold ${letterFilter === "" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"}`}>All</button>
              {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((L) => (
                <button key={L} type="button" onClick={() => setLetterFilter(L)} className={`h-7 min-w-7 rounded-md px-2 text-xs font-semibold ${letterFilter === L ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-primary/10"}`}>{L}</button>
              ))}
            </div>
            <div ref={splitRef} style={{ height: splitHeight }} className="grid gap-3">
            <div className="space-y-3 min-w-0 lg:flex lg:min-h-0 lg:flex-col">


            {doctorsView === "list" && (<>
            {clinicsLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 rounded-full border-4 border-muted animate-spin border-t-primary" />
              </div>
            ) : visibleClinics && visibleClinics.length > 0 ? (
              <div ref={listScrollRef} className="lg:flex-1 lg:min-h-0 min-h-[260px] max-h-[70vh] lg:max-h-none overflow-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Specialty</TableHead>
                      <TableHead className="hidden md:table-cell">Address</TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleClinics.map((c) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer transition-colors hover:bg-primary/5"
                        onClick={() => { if (c.latitude && c.longitude) setMapCenterOn({ lat: c.latitude, lng: c.longitude, zoom: 16 }); }}
                      >
                        <TableCell>
                          <p className="font-medium text-foreground text-sm leading-tight">{c.name}</p>
                          {c.phone && (
                            <p className="text-xs text-muted-foreground mt-0.5">{c.phone}</p>
                          )}
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
                              disabled={!c.latitude || !c.longitude}
                              onClick={() => {
                                setMapFocus(c);
                                setMapCenterOn({ lat: c.latitude, lng: c.longitude, zoom: 17 });
                                setDoctorsView("map");
                              }}
                              title="View on map"
                            >
                              <MapPin className="h-3.5 w-3.5 text-primary" />
                            </Button>
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
                              className="h-8 w-8 hover:bg-amber-500/10"
                              onClick={() => resetClinicWaitTimes.mutate(c.id)}
                              title="Reset current wait reports"
                            >
                              <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
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
                {clinicsHasMore && (
                  <div className="sticky bottom-0 flex items-center justify-center border-t border-border/50 bg-card/95 px-2 py-0.5 backdrop-blur-sm">
                    {loadingMore && <Loader2 className="absolute right-2 h-3 w-3 animate-spin text-primary" />}
                    {!loadingMore && loadedMore && <Check className="absolute right-2 h-3 w-3 text-primary" />}
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => { setLoadingMore(true); setLoadedMore(false); setClinicsLimit((n) => n + 50); }}
                      className="px-1 py-0.5 text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
                    >
                      Load 50 more
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {!filterState || !filterCity ? "Choose a state and a city to see doctor offices." : "No doctors found. Add one above!"}
                </p>
              </div>
            )}
            </>)}
            {doctorsView === "map" && (
            <div className="space-y-3 min-w-0">

        <div className="rounded-xl border border-border/40 bg-card p-3">
          {/* Search box + results */}
          <div className="relative mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search doctor office or place…" title="Search a place and Verify & Add it, tap a medical place on the map to add it, or tap an empty spot to add with exact coordinates"
                value={mapSearch}
                onChange={(e) => { setMapSearch(e.target.value); setMapDropdownOpen(true); }}
                onFocus={() => { if (mapSearch.trim()) setMapDropdownOpen(true); }}
                className="pl-9"
                autoComplete="off"
              />
            </div>
            {mapSearch.trim() && mapDropdownOpen && !mapCandidate && (
              <div className="absolute z-[60] mt-1 w-full rounded-xl border border-border/40 bg-card shadow-xl">
                <SearchResultsDropdown
                  results={mapSearchState.results}
                  loading={mapSearchState.loading}
                  limited={mapSearchState.limited}
                  degraded={mapSearchState.degraded}
                  searched={mapSearchState.searched}
                  userLocation={adminLoc}
                  onSelect={handleMapSelectResult}
                  onSuggestClinic={() => { setMapDropdownOpen(false); setPrefillData(null); setCreateOpen(true); setActiveTab("clinics"); }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="relative h-[58vh] overflow-hidden rounded-xl border border-border/50">
          {clinicsHasMore && (
            <div className="absolute bottom-3 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/40 bg-card/95 px-3 py-1 shadow-md backdrop-blur-sm">
              {loadingMore && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => { setLoadingMore(true); setLoadedMore(false); setClinicsLimit((n) => n + 50); }}
                className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-50"
              >
                Load 50 more
              </button>
            </div>
          )}
          {mapFocus && (
            <div className="absolute left-3 top-3 z-[70] w-72 rounded-xl border border-border/40 bg-card/95 p-3 shadow-xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{mapFocus.name}</p>
                <button type="button" onClick={() => setMapFocus(null)} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{mapFocus.address}</p>
              {mapFocus.specialty && <p className="mt-1 text-xs"><span className="text-muted-foreground">Specialty: </span>{mapFocus.specialty}</p>}
              {mapFocus.phone && <p className="text-xs"><span className="text-muted-foreground">Phone: </span>{mapFocus.phone}</p>}
              {(mapFocus as { npi?: string | null }).npi && <p className="text-xs"><span className="text-muted-foreground">NPI: </span>{(mapFocus as { npi?: string | null }).npi}</p>}
              <p className="text-xs text-muted-foreground">{mapFocus.latitude.toFixed(5)}, {mapFocus.longitude.toFixed(5)}</p>
              <div className="mt-2 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => setEditClinic(mapFocus)}>Edit</Button>
              </div>
            </div>
          )}
          <MapView
            clinics={mapClinics}
            userLocation={adminLoc}
            centerOn={mapCenterOn}
            focusedPlace={mapFocus ? { name: mapFocus.name, latitude: mapFocus.latitude, longitude: mapFocus.longitude } : null}
            focusedColor="#15803d"
            fitToClinics
            onClinicClick={(c) => {
              const row = clinics?.find((x) => x.id === c.id);
              if (row) setEditClinic(row);
            }}
            onEmptyClick={() => {}}
            onMapPointClick={handleMapPointClick}
            candidate={
              mapCandidate
                ? { name: mapCandidate.name, latitude: mapCandidate.latitude, longitude: mapCandidate.longitude }
                : null
            }
            pendingPoint={pendingPoint}
            nearbyRadiusMiles={Number(nearbyRadius) > 0 ? Number(nearbyRadius) : 5}
          />

          {/* Locate-me: sits just above the zoom pill (bottom-left cluster) */}
          <button
            type="button"
            onClick={handleAdminLocate}
            title="Show my current location"
            className="absolute bottom-[152px] left-3 z-[55] flex h-10 w-10 items-center justify-center rounded-xl border border-border/30 bg-card/90 shadow-lg backdrop-blur-xl transition-all hover:bg-card active:scale-95"
          >
            <Crosshair className="h-5 w-5 text-primary" />
          </button>

          {/* "Add here" affordance for a tapped empty point */}
          {pendingPoint && !mapCandidate && (
            <div className="absolute bottom-3 left-3 right-3 z-[60] mx-auto max-w-md">
              <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/95 p-3 shadow-xl backdrop-blur-xl">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-card-foreground">Add a doctor office here?</p>
                  <p className="truncate text-[10px] text-muted-foreground tabular-nums">
                    {pendingPoint.lat.toFixed(6)}, {pendingPoint.lng.toFixed(6)}
                  </p>
                </div>
                <button
                  onClick={() => setPendingPoint(null)}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/40"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAddHere}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Add here
                </button>
              </div>
            </div>
          )}

          {mapCandidate && (
            <VerifyPlaceCard
              candidate={mapCandidate}
              userLocation={adminLoc}
              onCancel={() => setMapCandidate(null)}
              onVerified={handleMapVerified}
            />
          )}
        </div>
      
            </div>
            )}
            </div>

            </div>
          </TabsContent>


          <TabsContent value="suggestions" className="space-y-3">
            {suggestions && suggestions.length > 0 ? (
              suggestions.map((s: ClinicSuggestionRow, i: number) => (
                <Card key={s.id} className="border-border/50 animate-in fade-in slide-in-from-bottom-1" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                  <CardContent className="flex items-center justify-between gap-2 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-card-foreground truncate text-sm sm:text-base">{s.doctor_name}</p>
                      <p className="text-xs text-muted-foreground truncate sm:text-sm">{s.address}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {s.specialty && <Badge variant="secondary" className="text-[10px]">{s.specialty}</Badge>}
                        {s.clinic_type && s.clinic_type !== "doctor" && <Badge variant="outline" className="text-[10px]">{s.clinic_type}</Badge>}
                        {s.phone && <span className="text-[10px] text-muted-foreground">📞 {s.phone}</span>}
                      </div>
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

          <TabsContent value="reports" className="space-y-4">
            {/* Active / Expired filter tabs */}
            <Tabs
              value={showActiveReports ? "active" : "expired"}
              onValueChange={(v) => setShowActiveReports(v === "active")}
            >
              <TabsList className="inline-flex h-auto gap-1 p-1 bg-primary/15">
                <TabsTrigger value="active" className="min-w-24 gap-1.5 whitespace-nowrap text-xs sm:min-w-28 sm:text-sm px-3">
                  Active
                  {showActiveReports && (
                    <Badge variant="secondary" className="text-[10px]">{filteredReports.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="expired" className="min-w-24 gap-1.5 whitespace-nowrap text-xs sm:min-w-28 sm:text-sm px-3">
                  Expired
                  {!showActiveReports && (
                    <Badge variant="secondary" className="text-[10px]">{filteredReports.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="overflow-x-auto rounded-lg border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor Office</TableHead>
                    <TableHead>Wait</TableHead>
                    <TableHead className="hidden sm:table-cell">Time</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((r: WaitTimeReportRow) => {
                    const waitCategory = r.wait_time as WaitTimeCategory;
                    return (
                      <TableRow key={r.id} className={r.is_flagged ? "opacity-40" : "transition-colors"}>
                        <TableCell className="text-sm font-medium">{r.clinics?.name || "Unknown"}</TableCell>
                        <TableCell>
                          <WaitTimeBadge category={waitCategory} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {new Date(r.reported_at).toLocaleString()}
                          {showActiveReports && (() => {
                            const expiresInMinutes = Math.max(
                              0,
                              Math.round(
                                reportExpiryMinutesFor(waitCategory, reportExpiry) -
                                  (Date.now() - new Date(r.reported_at).getTime()) / 60000
                              )
                            );
                            return (
                              <p className="mt-0.5 text-[10px] text-muted-foreground/80">
                                Reverts to On Time in {expiresInMinutes}m
                              </p>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {r.is_flagged ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-primary/10"
                                onClick={() => unflagReport.mutate(r.id)}
                                title="Unflag"
                              >
                                <Check className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10"
                                onClick={() => flagReport.mutate(r.id)}
                                title="Flag"
                              >
                                <X className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-destructive/10"
                              onClick={() => deleteReport.mutate(r.id)}
                              title="Delete report"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredReports.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        No {showActiveReports ? "active" : "expired"} reports found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* ── SETTINGS TAB ── */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  App Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="radius" className="text-xs">Nearby Radius (miles)</Label>
                  <Input
                    id="radius"
                    type="number"
                    value={nearbyRadius}
                    onChange={(e) => setNearbyRadius(e.target.value)}
                    placeholder="100"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Users will see doctor offices within this radius on the map. A circle will be shown around their location.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="geofence" className="text-xs">Report Radius (meters)</Label>
                  <Input
                    id="geofence"
                    type="number"
                    value={geofenceMeters}
                    onChange={(e) => setGeofenceMeters(e.target.value)}
                    placeholder="1000"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    How close a user must be to an office to submit a wait report. GPS accuracy must be within the same distance.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cooldown" className="text-xs">Report Cooldown (minutes)</Label>
                  <Input
                    id="cooldown"
                    type="number"
                    value={cooldownMinutes}
                    onChange={(e) => setCooldownMinutes(e.target.value)}
                    placeholder="60"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    How long a device must wait before it can submit another wait-time report, for any doctor office.
                  </p>
                </div>

                <div className="space-y-3 border-t border-border/30 pt-4">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Report Expiry by Wait Time</p>
                    <p className="text-[10px] text-muted-foreground">
                      Each wait time reverts to On Time on its own schedule — not a single shared window.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry30" className="text-xs">~30 Min reports expire after (minutes)</Label>
                    <Input
                      id="expiry30"
                      type="number"
                      value={expiry30MinMinutes}
                      onChange={(e) => setExpiry30MinMinutes(e.target.value)}
                      placeholder="30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry60" className="text-xs">~1 Hour reports expire after (minutes)</Label>
                    <Input
                      id="expiry60"
                      type="number"
                      value={expiry60MinMinutes}
                      onChange={(e) => setExpiry60MinMinutes(e.target.value)}
                      placeholder="60"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="expiry90" className="text-xs">1.5+ Hours reports expire after (minutes)</Label>
                    <Input
                      id="expiry90"
                      type="number"
                      value={expiry90PlusMinutes}
                      onChange={(e) => setExpiry90PlusMinutes(e.target.value)}
                      placeholder="90"
                    />
                  </div>
                </div>
                <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-1.5">
                  {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Settings
                </Button>
                <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
                  <p className="text-xs font-semibold text-foreground">Legal & Operational Checklist</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
                    <li>NDA signed by all parties before release work starts.</li>
                    <li>Client-owned Apple/Google developer accounts are active.</li>
                    <li>Terms and Privacy pages reviewed and published.</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* ── CREATE Dialog ── */}
      <ClinicFormDialog
        open={createOpen}
        onClose={() => { setCreateOpen(false); setPrefillData(null); }}
        onSave={(form) => createClinic.mutate(form)}
        prefill={prefillData ?? undefined}
        isLoading={createClinic.isPending}
      />

      {/* ── EDIT Dialog ── */}
      <ClinicFormDialog
        open={!!editClinic}
        onClose={() => setEditClinic(null)}
        onSave={(form) => updateClinic.mutate({ id: editClinic!.id, form })}
        initialData={editFormData}
        isLoading={updateClinic.isPending}
        readOnly={!!(editClinic as { npi_imported?: boolean | null } | null)?.npi_imported}
      />

      {/* ── DELETE Confirm Dialog ── */}
      <Dialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm mx-3">
          <DialogHeader>
            <DialogTitle className="text-base">Delete Doctor Office?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete the doctor office and all its wait time reports. This action cannot be undone.
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

      {/* ── CSV Upload Dialog ── */}
      <CsvUploadDialog
        open={csvOpen}
        onClose={() => setCsvOpen(false)}
        onUploadComplete={() => {
          queryClient.invalidateQueries({ queryKey: ["admin-clinics"] });
        }}
      />
    </div>
  );
}
