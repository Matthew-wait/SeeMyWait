import { useEffect, useMemo, useRef, useState } from "react";
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
import { useLocation } from "react-router-dom";
import { GEOCODE_COUNTRY } from "@/lib/geocode-region";
import { autocompletePlaces, reverseGeocode, getPlaceDetails } from "@/lib/google-places-client";
import { AddDoctorPrefill } from "@/lib/add-doctor-prefill";
import { buildClinicSuggestionAdminEmail } from "@/lib/email-templates";
import {
  PhoneInput,
  buildE164,
  isPhoneDigitsValid,
} from "@/components/ui/phone-input";
import { DEFAULT_COUNTRY_ISO } from "@/lib/country-codes";

const STEPS = [
  {
    icon: ClipboardList,
    title: "You Report",
    description: "Submit doctor office details — name, address, and type.",
    emoji: "📋",
  },
  {
    icon: ShieldCheck,
    title: "Admin Reviews",
    description: "We verify against public records (NPPES) and maps.",
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
  { value: "clinic", label: "Doctor Office" },
  { value: "hospital", label: "Hospital" },
  { value: "urgent_care", label: "Urgent Care" },
];
// const ADMIN_ALERT_EMAIL = "contact@seemywait.com"; // production inbox
const ADMIN_ALERT_EMAIL = "rohansheikh197@gmail.com"; // testing inbox
const RESEND_TEMPLATE_ID = "welcome-email";

export default function SuggestClinic() {
  type AddressSuggestion = {
    description: string;
    place_id: string;
  };

  const [doctorName, setDoctorName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSuggestError, setAddressSuggestError] = useState<string | null>(null);
  const [selectedAddressPlaceId, setSelectedAddressPlaceId] = useState<string | null>(null);
  // Editable Latitude / Longitude fields. Auto-filled when the user picks a
  // suggestion, uses current location, or arrives via a map-tap prefill — and
  // can be pasted by hand from Google Maps for a custom spot. Kept as strings
  // so partial/invalid input can be shown and validated.
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");
  // User's position, used only to bias autocomplete toward nearby results.
  const [biasLocation, setBiasLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [phoneCountryIso, setPhoneCountryIso] = useState(DEFAULT_COUNTRY_ISO);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [clinicType, setClinicType] = useState("doctor");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [duplicateFound, setDuplicateFound] = useState<string | null>(null);
  const [locatingAddress, setLocatingAddress] = useState(false);
  const routerLocation = useLocation();
  // Set to `true` right before we fill `address` from GPS, so the autocomplete
  // effect skips one tick and doesn't pop suggestions over a captured location.
  const skipNextAutocompleteRef = useRef(false);

  const phoneValueToSave = buildE164(phoneCountryIso, phoneDigits);

  // Parsed, range-checked manual coordinates (null if empty or invalid).
  const parsedManualCoords = useMemo(() => {
    const lat = parseFloat(latInput.trim());
    const lng = parseFloat(lngInput.trim());
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }, [latInput, lngInput]);

  const coordsTouched = latInput.trim() !== "" || lngInput.trim() !== "";
  const coordsInvalid = coordsTouched && parsedManualCoords === null;

  /** Fill both coordinate inputs from a resolved point. */
  const setCoordInputs = (lat: number, lng: number) => {
    setLatInput(lat.toFixed(6));
    setLngInput(lng.toFixed(6));
  };

  // Required: name, address, type. Specialty and phone are optional; a partial
  // phone is the only thing that can invalidate the form.
  const phoneValid = phoneDigits.length === 0 || isPhoneDigitsValid(phoneDigits);
  const allFieldsFilled =
    doctorName.trim() !== "" &&
    address.trim() !== "" &&
    clinicType !== "" &&
    phoneValid;
  const submitDisabled = submitting || !allFieldsFilled;

  const resolveCoordinatesFromAddress = async (
    rawAddress: string
  ): Promise<{ lat: number; lng: number }> => {
    const normalized = rawAddress.trim();
    if (!normalized) {
      throw new Error("ADDRESS_REQUIRED");
    }

    const { data: geoData, error: geoError } = await supabase.functions.invoke(
      "medical-search",
      { body: { action: "geocode", query: normalized } }
    );
    if (!geoError) {
      const first = Array.isArray(geoData?.results) ? geoData.results[0] : null;
      const lat = first?.geometry?.location?.lat;
      const lng = first?.geometry?.location?.lng;
      if (typeof lat === "number" && typeof lng === "number") {
        return { lat, lng };
      }
    }

    // Client-side fallback if the edge function is momentarily unavailable.
    const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=${GEOCODE_COUNTRY}&q=${encodeURIComponent(
      normalized
    )}`;
    const osmRes = await fetch(osmUrl);
    const osmData = await osmRes.json();
    const firstOsm = Array.isArray(osmData) ? osmData[0] : null;
    const lat = firstOsm?.lat ? parseFloat(firstOsm.lat) : NaN;
    const lng = firstOsm?.lon ? parseFloat(firstOsm.lon) : NaN;
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }

    throw new Error("COORDINATES_NOT_FOUND");
  };

  // Hydrate from a tap-to-add prefill (POI tap / "Add here"), once on mount.
  useEffect(() => {
    const prefill = (routerLocation.state as { prefill?: AddDoctorPrefill } | null)?.prefill;
    if (!prefill) return;

    if (prefill.name) setDoctorName(prefill.name);
    if (prefill.specialty) setSpecialty(prefill.specialty);
    if (prefill.type) setClinicType(prefill.type);
    if (prefill.address) setAddress(prefill.address);
    if (prefill.place_id) setSelectedAddressPlaceId(prefill.place_id);

    if (typeof prefill.lat === "number" && typeof prefill.lng === "number") {
      // A map tap / POI gives an exact point — fill the coordinate fields.
      setCoordInputs(prefill.lat, prefill.lng);
      // Skip the autocomplete pass that the address setState would trigger.
      skipNextAutocompleteRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Capture the user's position once, only to bias address suggestions nearby.
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setBiasLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  useEffect(() => {
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      setAddressSuggestions([]);
      setAddressLoading(false);
      setAddressSuggestError(null);
      return;
    }

    const query = address.trim();
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
        // Client-side Places, biased to the user's location. The shared edge
        // `autocomplete` action can't bias (backend is frozen), which is what
        // made typed suggestions wander to unrelated areas.
        const predictions = await autocompletePlaces(query, biasLocation);
        setAddressSuggestions(
          predictions.filter((p) => p.description && p.place_id).slice(0, 8)
        );
        if (predictions.length === 0) {
          setAddressSuggestError(
            "No matching locations found. Try a more specific address, or drop a pin on the map."
          );
        }
      } catch {
        setAddressSuggestError("Unable to load address suggestions. Please try again.");
        setAddressSuggestions([]);
      } finally {
        setAddressLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [address, biasLocation]);

  const handleAddressInput = (value: string) => {
    setAddress(value);
    // Editing the address invalidates a previously-selected place id (it no
    // longer matches). Any coordinates the user typed are left intact — manual
    // coordinates are authoritative and win on submit.
    setSelectedAddressPlaceId(null);
    setAddressSuggestError(null);
  };

  const selectAddressSuggestion = async (suggestion: AddressSuggestion) => {
    setSelectedAddressPlaceId(suggestion.place_id);
    setAddressSuggestions([]);
    setAddress(suggestion.description);
    const details = await getPlaceDetails(suggestion.place_id);
    if (details && details.latitude !== null && details.longitude !== null) {
      setCoordInputs(details.latitude, details.longitude);
    } else {
      setSelectedAddressPlaceId(null);
      toast.error("Unable to fetch location details. Please select another suggestion.");
    }
  };

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

    // Only name, address, and type are required now. Specialty and phone are
    // optional; coordinates are enforced further down (a place needs a location).
    if (!doctorName.trim() || !address.trim() || !clinicType) {
      toast.error("Please add a name, address, and type.");
      return;
    }

    // Phone is optional, but if partially entered it must be valid.
    if (phoneDigits.length > 0 && !isPhoneDigitsValid(phoneDigits)) {
      setPhoneTouched(true);
      toast.error("Phone number is incomplete.");
      return;
    }

    // Coordinates, if typed, must be a valid lat/lng pair.
    if (coordsInvalid) {
      toast.error("Coordinates look invalid. Latitude must be -90…90 and longitude -180…180.");
      return;
    }

    setSubmitting(true);
    try {
      let latToSave: number | null;
      let lngToSave: number | null;

      if (parsedManualCoords) {
        // Manual coordinates win — from a suggestion pick, GPS, a map tap, or a
        // pasted lat/lng. A custom point is defined by its coordinates.
        latToSave = parsedManualCoords.lat;
        lngToSave = parsedManualCoords.lng;
      } else {
        // No coordinates: geocode the typed address. Require coordinates so we
        // never save an un-placeable row (that is what pollutes the directory).
        const resolved = await resolveCoordinatesFromAddress(address);
        latToSave = resolved.lat;
        lngToSave = resolved.lng;
      }

      // Absolute guard: coordinates are mandatory for every saved place.
      if (latToSave === null || lngToSave === null) {
        throw new Error("COORDINATES_NOT_FOUND");
      }

      const isDuplicate = await checkDuplicate();
      if (isDuplicate) {
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("clinic_suggestions").insert({
        doctor_name: doctorName.trim(),
        address: address.trim(),
        specialty: specialty.trim() || null,
        phone: phoneValueToSave || null,
        clinic_type: clinicType,
        latitude: latToSave,
        longitude: lngToSave,
      });

      if (error) throw error;

      // Keep user flow successful even if email notification fails.
      await supabase.functions
        .invoke("send-email", {
          body: {
            to: ADMIN_ALERT_EMAIL,
            subject: "New Doctor Office Suggestion • SeeMyWait",
            templateId: RESEND_TEMPLATE_ID,
            variables: {
              APP_NAME: "SeeMyWait",
              APP_TAGLINE: "Live Wait Times, Smarter Visits",
              title: "New Doctor Office Suggestion",
              intro: "A user submitted a new doctor office request.",
              year: String(new Date().getFullYear()),
              contentHtml: `
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">Name</td>
                    <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">${doctorName.trim()}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">Address</td>
                    <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">${address.trim()}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">Type</td>
                    <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">${clinicType}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">Specialty</td>
                    <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">${specialty.trim() || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">Phone</td>
                    <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">${phoneValueToSave || "N/A"}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">Latitude</td>
                    <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">${String(latToSave)}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0; color:#64748b; font-size:13px; width:160px; vertical-align:top;">Longitude</td>
                    <td style="padding:8px 0; color:#0f172a; font-size:14px; font-weight:600;">${String(lngToSave)}</td>
                  </tr>
                </table>
              `,
            },
            html: buildClinicSuggestionAdminEmail({
              name: doctorName.trim(),
              address: address.trim(),
              type: clinicType,
              specialty: specialty.trim() || "N/A",
              phone: phoneValueToSave || "N/A",
              latitude: String(latToSave),
              longitude: String(lngToSave),
            }),
          },
        })
        .catch((emailError) => {
          console.error("Failed to send admin clinic suggestion email:", emailError);
        });

      setSubmitted(true);
      toast.success("Suggestion submitted! We'll review it soon.");
    } catch (err) {
      if ((err as Error)?.message === "COORDINATES_NOT_FOUND") {
        toast.error("Could not locate this address. Please enter a more specific address.");
      } else {
        toast.error("Failed to submit. Please try again.");
      }
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
    setAddressSuggestions([]);
    setAddressLoading(false);
    setSelectedAddressPlaceId(null);
    setLatInput("");
    setLngInput("");
    setPhoneCountryIso(DEFAULT_COUNTRY_ISO);
    setPhoneDigits("");
    setPhoneTouched(false);
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
                Can't Find Your Doctor Office?
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
                    Doctor Office Name <span className="text-destructive">*</span>
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
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="flex h-4 items-center text-xs font-medium">
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
                    <Label htmlFor="specialty" className="flex h-4 items-center text-xs font-medium">
                      Specialty <span className="text-muted-foreground ml-0.5">(optional)</span>
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
                      onChange={(e) => handleAddressInput(e.target.value)}
                      className="rounded-xl border-border/40 bg-background/60 h-11 pr-12 sm:pr-52"
                      autoComplete="off"
                      required
                    />
                    {(addressLoading || addressSuggestions.length > 0 || addressSuggestError) && (
                      <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md">
                        {addressLoading ? (
                          <p className="px-2 py-2 text-xs text-muted-foreground">Loading suggestions...</p>
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
                            const { latitude, longitude } = pos.coords;
                            // The GPS sensor coordinates are authoritative. The
                            // reverse-geocode only supplies a human-readable
                            // address and a real Google place id for the point.
                            let label = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
                            let resolved = false;
                            const geo = await reverseGeocode(latitude, longitude);
                            if (geo?.address) {
                              label = geo.address;
                              resolved = true;
                            }

                            skipNextAutocompleteRef.current = true;
                            setAddress(label);
                            setSelectedAddressPlaceId(geo?.placeId ?? null);
                            setCoordInputs(latitude, longitude);
                            setAddressSuggestError(null);
                            setAddressSuggestions([]);
                            setLocatingAddress(false);

                            toast.success(
                              resolved
                                ? "Address captured from your location!"
                                : "Location captured. You can edit the address text if needed."
                            );
                          },
                          () => {
                            toast.error("Unable to get location. Please enter manually.");
                            setLocatingAddress(false);
                          },
                          { enableHighAccuracy: true }
                        );
                      }}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded-lg bg-primary/10 border border-primary/20 px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 sm:w-44"
                    >
                      {locatingAddress ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <MapPin className="h-3 w-3" />
                      )}
                      <span className="hidden sm:inline min-w-0 truncate" title="Use Current Location">
                        Use Current Location
                      </span>
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Pick a suggestion or use your current location to fill these automatically. For a
                    custom spot, paste exact coordinates from Google Maps (long-press a point, then
                    tap the lat, long to copy).
                  </p>
                </div>

                {/* Latitude / Longitude */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="latitude" className="flex h-4 items-center text-xs font-medium">
                      Latitude <span className="text-muted-foreground ml-0.5">(optional)</span>
                    </Label>
                    <Input
                      id="latitude"
                      inputMode="decimal"
                      placeholder="e.g. 25.761681"
                      value={latInput}
                      onChange={(e) => setLatInput(e.target.value)}
                      className={`rounded-xl bg-background/60 h-11 tabular-nums ${
                        coordsInvalid ? "border-destructive" : "border-border/40"
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="longitude" className="flex h-4 items-center text-xs font-medium">
                      Longitude <span className="text-muted-foreground ml-0.5">(optional)</span>
                    </Label>
                    <Input
                      id="longitude"
                      inputMode="decimal"
                      placeholder="e.g. -80.191788"
                      value={lngInput}
                      onChange={(e) => setLngInput(e.target.value)}
                      className={`rounded-xl bg-background/60 h-11 tabular-nums ${
                        coordsInvalid ? "border-destructive" : "border-border/40"
                      }`}
                    />
                  </div>
                </div>

                {coordsInvalid ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/20 px-2.5 py-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                    <span className="text-[11px] font-medium text-destructive">
                      Invalid coordinates — latitude must be -90…90 and longitude -180…180.
                    </span>
                  </div>
                ) : parsedManualCoords ? (
                  <div className="flex items-center gap-1.5 rounded-lg bg-green-500/10 border border-green-500/20 px-2.5 py-1.5">
                    <MapPin className="h-3 w-3 shrink-0 text-green-600" />
                    <span className="text-[11px] font-medium text-green-700 dark:text-green-400">
                      Exact location set — these coordinates will be used.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-amber-600" />
                    <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                      No coordinates yet — the address will be geocoded on submit.
                    </span>
                  </div>
                )}

                {/* Phone */}
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-medium flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-primary/70" />
                    Phone <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <PhoneInput
                    id="phone"
                    countryIso={phoneCountryIso}
                    digits={phoneDigits}
                    onCountryIsoChange={setPhoneCountryIso}
                    onDigitsChange={(d) => {
                      setPhoneDigits(d);
                      if (!phoneTouched) setPhoneTouched(true);
                    }}
                    showError={phoneTouched}
                    placeholder="e.g. 3055550199"
                  />
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

                <Button
                  type="submit"
                  className="w-full rounded-xl h-12 text-sm font-semibold"
                  disabled={submitDisabled}
                >
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
