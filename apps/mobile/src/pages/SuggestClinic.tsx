import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { BottomNav } from '@/src/components/navigation/BottomNav';
import { useTheme } from '@/src/hooks/use-theme';
import { getDeviceFingerprint } from '@/src/lib/device-fingerprint';
import { getPreciseCurrentPosition, reverseGeocodeAddress } from '@/src/lib/geolocation';
import { supabase } from '@/src/lib/supabase';
import { showToast } from '@/src/lib/toast';
import { getCountries, getCountryCallingCode } from 'libphonenumber-js/core';
const metadataImport = require('libphonenumber-js/metadata.min.json.js');
const metadata = metadataImport?.default ?? metadataImport;

type ClinicType = 'doctor' | 'clinic' | 'hospital' | 'urgent_care';
type CountryOption = {
  iso2: string;
  code: string;
  name: string;
  flag: string;
};
type Suggestion = {
  /** Synthetic "geo:<lat>,<lng>" id from the Photon-backed autocomplete. */
  place_id: string;
  description: string;
  latitude?: number | null;
  longitude?: number | null;
};

/** Parse a "geo:<lat>,<lng>" synthetic id. */
const parseGeoId = (id: string): { latitude: number; longitude: number } | null => {
  const m = /^geo:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(id.trim());
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
};

const TYPE_OPTIONS: ClinicType[] = ['doctor', 'clinic', 'hospital', 'urgent_care'];
const MIN_PHONE_DIGITS = 7;
const MAX_PHONE_DIGITS = 15;
const AUTOCOMPLETE_LIMIT = 8;

const normalize = (value: string): string => value.trim().toLowerCase();
const toNullableNormalized = (value: unknown): string => normalize(String(value ?? ''));
const isoToFlag = (iso2: string): string =>
  iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
const getRegionDisplayName = (iso2: string): string => {
  try {
    const DisplayNamesCtor = (Intl as unknown as { DisplayNames?: new (
      locales?: string | string[],
      options?: { type: 'region' }
    ) => { of: (code: string) => string | undefined } }).DisplayNames;
    if (typeof DisplayNamesCtor === 'function') {
      const displayNames = new DisplayNamesCtor(['en'], { type: 'region' });
      return displayNames.of(iso2) ?? iso2;
    }
  } catch {
    // Fallback for runtimes without Intl.DisplayNames support.
  }
  return iso2;
};
const getTypeLabel = (type: ClinicType): string => {
  if (type === 'doctor') return 'Doctor';
  if (type === 'clinic') return 'Doctor Office';
  if (type === 'hospital') return 'Hospital';
  return 'Urgent Care';
};

const statusMessage = (status: unknown): string => {
  switch (String(status ?? '')) {
    case 'ZERO_RESULTS':
      return 'No matching address found. Try a more specific address.';
    case 'REQUEST_DENIED':
      return 'Address lookup is currently unavailable (request denied).';
    case 'INVALID_REQUEST':
      return 'Address lookup request was invalid. Try again.';
    case 'OVER_QUERY_LIMIT':
      return 'Address lookup is busy. Please retry in a moment.';
    default:
      return 'Could not fetch address suggestions right now.';
  }
};

const pickLatLng = (payload: Record<string, unknown>): { latitude: number; longitude: number } | null => {
  if (typeof payload.latitude === 'number' && typeof payload.longitude === 'number') {
    return { latitude: payload.latitude, longitude: payload.longitude };
  }

  const result = (payload.result ?? payload.results) as unknown;
  if (result && typeof result === 'object') {
    const first = Array.isArray(result) ? result[0] : result;
    if (first && typeof first === 'object') {
      const rec = first as Record<string, unknown>;
      if (typeof rec.latitude === 'number' && typeof rec.longitude === 'number') {
        return { latitude: rec.latitude, longitude: rec.longitude };
      }
      const geometry = rec.geometry as Record<string, unknown> | undefined;
      const location = geometry?.location as Record<string, unknown> | undefined;
      const lat = location?.lat;
      const lng = location?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return { latitude: lat, longitude: lng };
      }
    }
  }

  return null;
};

type ServerReverseResult = {
  formattedAddress: string;
  placeId: string | null;
  score: number;
};

const isBroadAreaAddress = (raw: string): boolean => {
  const text = raw.trim().toLowerCase();
  if (!text) return true;
  const commaParts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const hasStreetNumber = /\d/.test(text);
  const hasStreetHints =
    /(street|st\b|road|rd\b|avenue|ave\b|block|sector|colony|phase|plot|flat|building|house|apt|lane|ln\b)/i.test(
      text
    );
  return !hasStreetNumber && !hasStreetHints && commaParts.length <= 2;
};

const withPinnedCoords = (address: string, latitude: number, longitude: number): string => {
  return `${address} (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;
};

/** Server reverse-geocode via the medical-search edge function (Nominatim). */
const reverseGeocodeServer = async (
  latitude: number,
  longitude: number
): Promise<ServerReverseResult | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('medical-search', {
      body: { action: 'reverse', lat: latitude, lng: longitude },
    });
    if (error || !data?.address) return null;
    // No rooftop confidence signal from Nominatim — score 0 so the caller
    // appends the exact pinned coords for anything that looks broad.
    return { formattedAddress: String(data.address), placeId: null, score: 0 };
  } catch {
    return null;
  }
};

export const SuggestClinicPage = () => {
  const { isDark } = useTheme();

  // Prefill from a map tap / POI tap on the Map screen (item 7).
  const params = useLocalSearchParams();
  const asStr = (v: string | string[] | undefined): string =>
    Array.isArray(v) ? (v[0] ?? '') : typeof v === 'string' ? v : '';
  const pLat = Number(asStr(params.lat));
  const pLng = Number(asStr(params.lng));
  const prefillLatLng =
    asStr(params.lat) !== '' && Number.isFinite(pLat) && Number.isFinite(pLng)
      ? { latitude: pLat, longitude: pLng }
      : null;
  const typeParam = asStr(params.type);
  const prefillType: ClinicType =
    typeParam === 'clinic' || typeParam === 'hospital' || typeParam === 'urgent_care' ? typeParam : 'doctor';

  const [doctorName, setDoctorName] = useState(asStr(params.name));
  const [specialty, setSpecialty] = useState(asStr(params.specialty));
  const [address, setAddress] = useState(asStr(params.address));
  const [countryCode, setCountryCode] = useState('+1');
  const [phone, setPhone] = useState('');
  const [clinicType, setClinicType] = useState<ClinicType>(prefillType);
  const [clinicTypeMenuOpen, setClinicTypeMenuOpen] = useState(false);
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(asStr(params.place_id) || null);
  const [selectedLatLng, setSelectedLatLng] = useState<{ latitude: number; longitude: number } | null>(prefillLatLng);
  // Optional manual coordinates (e.g. pasted from Google Maps). Kept as strings so
  // the inputs can be partially typed; parsed to numbers on use.
  const [latInput, setLatInput] = useState<string>(prefillLatLng ? String(prefillLatLng.latitude) : '');
  const [lngInput, setLngInput] = useState<string>(prefillLatLng ? String(prefillLatLng.longitude) : '');
  const [submitting, setSubmitting] = useState(false);
  const [duplicateMessage, setDuplicateMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');
  const [submitFeedback, setSubmitFeedback] = useState('');
  const [locatingAddress, setLocatingAddress] = useState(false);
  const autocompleteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Device location used ONLY to bias address suggestions toward the user's area
  // (best-effort; suggestions still work unbiased if this is unavailable).
  const biasLocationRef = useRef<{ latitude: number; longitude: number } | null>(prefillLatLng);
  const deviceIdRef = useRef<string>('anon');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        deviceIdRef.current = await getDeviceFingerprint();
      } catch {
        // keep 'anon' — only used for rate-limit bucketing
      }
    })();
    void (async () => {
      try {
        // Coarse + quick: this only biases suggestions, precision isn't needed.
        const pos = await getPreciseCurrentPosition(500, 8000);
        if (!cancelled) {
          biasLocationRef.current = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } catch {
        // best-effort: unbiased autocomplete if location is denied/unavailable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const countryOptions = useMemo<CountryOption[]>(() => {
    return getCountries(metadata)
      .map((iso2) => ({
        iso2,
        code: `+${getCountryCallingCode(iso2, metadata)}`,
        name: getRegionDisplayName(iso2),
        flag: isoToFlag(iso2),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const phoneDigits = useMemo(() => phone.replace(/\D/g, ''), [phone]);
  const selectedCountry = useMemo(
    () => countryOptions.find((item) => item.code === countryCode) ?? countryOptions[0],
    [countryCode, countryOptions]
  );
  const [countrySearch, setCountrySearch] = useState('');
  const filteredCountryOptions = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return countryOptions;
    const qCode = q.replace(/[^\d+]/g, '');
    const byCode = qCode.length > 0;
    return countryOptions.filter((option) =>
      byCode
        ? option.code.toLowerCase().startsWith(qCode.startsWith('+') ? qCode : `+${qCode}`)
        : option.name.toLowerCase().startsWith(q)
    );
  }, [countryOptions, countrySearch]);
  const isPhoneComplete = useMemo(
    () => phoneDigits.length >= MIN_PHONE_DIGITS && phoneDigits.length <= MAX_PHONE_DIGITS,
    [phoneDigits.length]
  );

  const canSubmit = useMemo(() => {
    const requiredFilled =
      doctorName.trim().length > 0 &&
      specialty.trim().length > 0 &&
      address.trim().length > 0 &&
      phoneDigits.length > 0;
    return requiredFilled && isPhoneComplete && !submitting;
  }, [address, doctorName, isPhoneComplete, phoneDigits.length, specialty, submitting]);

  const handleCountrySearch = (text: string) => {
    setCountrySearch(text);
    const query = text.trim().toLowerCase();
    if (!query) return;
    const codeQuery = query.replace(/[^\d+]/g, '');
    const byCode = codeQuery.length > 0;
    const match = countryOptions.find((option) =>
      byCode
        ? option.code.toLowerCase().startsWith(codeQuery.startsWith('+') ? codeQuery : `+${codeQuery}`)
        : option.name.toLowerCase().startsWith(query)
    );
    if (match) setCountryCode(match.code);
  };

  const fetchAutocomplete = async (query: string) => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    // medical-search forwards a location bias (unlike google-places), so nearby
    // addresses rank first. Always HTTP 200 with { ok, predictions, limited, degraded }.
    const { data, error } = await supabase.functions.invoke('medical-search', {
      body: {
        action: 'autocomplete',
        query,
        location: biasLocationRef.current ?? undefined,
        deviceId: deviceIdRef.current,
      },
    });
    setLoadingSuggestions(false);
    if (error || !data) {
      showToast(statusMessage(null));
      setSuggestions([]);
      return;
    }

    const payload = data as Record<string, unknown>;
    const items = Array.isArray(payload.predictions) ? payload.predictions : [];
    const mapped = items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        place_id: String(item.place_id ?? ''),
        description: String(item.description ?? ''),
        latitude: typeof item.latitude === 'number' ? item.latitude : null,
        longitude: typeof item.longitude === 'number' ? item.longitude : null,
      }))
      .filter((item) => item.place_id && item.description)
      .slice(0, AUTOCOMPLETE_LIMIT);

    if (mapped.length === 0 && payload.degraded === true) {
      showToast('Address search is temporarily unavailable. You can enter the address and coordinates manually.');
    }
    setSuggestions(mapped);
  };

  useEffect(() => {
    if (autocompleteDebounceRef.current) {
      clearTimeout(autocompleteDebounceRef.current);
      autocompleteDebounceRef.current = null;
    }
    const query = address.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    autocompleteDebounceRef.current = setTimeout(() => {
      void fetchAutocomplete(query);
    }, 300);
    return () => {
      if (autocompleteDebounceRef.current) {
        clearTimeout(autocompleteDebounceRef.current);
      }
    };
  }, [address]);

  const chooseSuggestion = async (suggestion: Suggestion) => {
    setAddress(suggestion.description);
    setSelectedPlaceId(suggestion.place_id);
    setSuggestions([]);

    // Photon predictions carry coordinates inline (also encoded in the geo: id);
    // fall back to a geocode call only if neither is present.
    let coords: { latitude: number; longitude: number } | null =
      typeof suggestion.latitude === 'number' && typeof suggestion.longitude === 'number'
        ? { latitude: suggestion.latitude, longitude: suggestion.longitude }
        : parseGeoId(suggestion.place_id);
    if (!coords) {
      const { data } = await supabase.functions.invoke('medical-search', {
        body: { action: 'geocode', query: suggestion.description },
      });
      coords = pickLatLng((data ?? {}) as Record<string, unknown>);
    }
    if (coords) {
      setSelectedLatLng(coords);
      setLatInput(String(coords.latitude));
      setLngInput(String(coords.longitude));
    }
  };

  // Manual coordinates entered/pasted by the user (e.g. from Google Maps).
  // Both must be present and in valid ranges. Takes precedence over geocoding.
  const parsedManualCoords = useMemo(() => {
    const laStr = latInput.trim();
    const lnStr = lngInput.trim();
    if (laStr === '' || lnStr === '') return null;
    const la = Number(laStr);
    const ln = Number(lnStr);
    if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
    if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
    return { latitude: la, longitude: ln };
  }, [latInput, lngInput]);

  const resolveCoordinates = async () => {
    if (parsedManualCoords) return parsedManualCoords;
    if (selectedLatLng) return selectedLatLng;
    const { data } = await supabase.functions.invoke('medical-search', {
      body: { action: 'geocode', query: address },
    });
    const payload = (data ?? {}) as Record<string, unknown>;
    const serverCoords = pickLatLng(payload);
    if (serverCoords) return serverCoords;

    try {
      const country = process.env.EXPO_PUBLIC_GEOCODE_COUNTRY || 'us';
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=${country}&q=${encodeURIComponent(address)}`
      );
      const json = (await response.json()) as { lat: string; lon: string }[];
      if (json[0]) return { latitude: Number(json[0].lat), longitude: Number(json[0].lon) };
    } catch {
      return null;
    }
    return null;
  };

  const fillFromCurrentLocationAddress = async () => {
    setLocatingAddress(true);
    try {
      const position = await getPreciseCurrentPosition(30, 20000);
      const { latitude, longitude } = position.coords;
      let resolvedAddress: string | null = null;

      // Prefer the server reverse-geocode (Nominatim) for a full formatted address.
      const serverReverse = await reverseGeocodeServer(latitude, longitude);
      if (serverReverse?.formattedAddress) {
        resolvedAddress = serverReverse.formattedAddress;
      }

      if (!resolvedAddress) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            {
              headers: {
                Accept: 'application/json',
              },
            }
          );
          if (response.ok) {
            const json = (await response.json()) as { display_name?: string };
            if (json.display_name?.trim()) {
              resolvedAddress = json.display_name.trim();
            }
          }
        } catch {
          // fall through to native reverse-geocode fallback
        }
      }

      if (!resolvedAddress) {
        resolvedAddress = await reverseGeocodeAddress({ latitude, longitude });
      }

      if (!resolvedAddress) {
        showToast('Could not resolve address from your current location.');
        return;
      }

      const pinAddress =
        isBroadAreaAddress(resolvedAddress) || (serverReverse?.score ?? 0) < 4
          ? withPinnedCoords(resolvedAddress, latitude, longitude)
          : resolvedAddress;
      setAddress(pinAddress);
      setSelectedLatLng({ latitude, longitude });
      setLatInput(String(latitude));
      setLngInput(String(longitude));
    } catch {
      showToast('Could not read current location address.');
    } finally {
      setLocatingAddress(false);
    }
  };

  const submit = async () => {
    setDuplicateMessage('');
    setSubmitFeedback('');
    setClinicTypeMenuOpen(false);
    setCountryMenuOpen(false);
    if (!doctorName.trim() || !address.trim()) {
      setSubmitFeedback('Doctor/clinic name and address are required.');
      Alert.alert('Missing Required Fields', 'Doctor/clinic name and address are required.');
      showToast('Doctor/clinic name and address are required.');
      return;
    }
    if (!isPhoneComplete) {
      const msg = `Phone number must be ${MIN_PHONE_DIGITS}-${MAX_PHONE_DIGITS} digits.`;
      setSubmitFeedback(msg);
      Alert.alert('Invalid Phone Number', msg);
      showToast(msg);
      return;
    }

    const normalizedPhone = `${countryCode}${phoneDigits}`;
    setSubmitting(true);
    setSubmitStatus('Resolving address...');

    try {
      const coords = await resolveCoordinates();
      if (!coords || !Number.isFinite(coords.latitude) || !Number.isFinite(coords.longitude)) {
        setSubmitFeedback('Coordinates not found. Please choose a suggestion or enter a more specific address.');
        Alert.alert(
          'Address Not Found',
          'Coordinates not found. Please choose a suggestion or enter a more specific address.'
        );
        showToast('Please enter a more specific address.');
        setSubmitting(false);
        setSubmitStatus('');
        return;
      }

      setSubmitStatus('Checking duplicates...');
      const nameNorm = normalize(doctorName);
      const addrNorm = normalize(address);
      const specNorm = normalize(specialty);

      const activeCheck = await supabase
        .from('clinics')
        .select('name,address,specialty')
        .eq('is_active', true);
      const pendingCheck = await supabase
        .from('clinic_suggestions')
        .select('doctor_name,address,specialty')
        .eq('status', 'pending');

      const dupActive = (activeCheck.data ?? []).some((row: Record<string, unknown>) => {
        return (
          toNullableNormalized(row.name) === nameNorm &&
          toNullableNormalized(row.address) === addrNorm &&
          toNullableNormalized(row.specialty) === specNorm
        );
      });
      const dupPending = (pendingCheck.data ?? []).some((row: Record<string, unknown>) => {
        return (
          toNullableNormalized(row.doctor_name) === nameNorm &&
          toNullableNormalized(row.address) === addrNorm &&
          toNullableNormalized(row.specialty) === specNorm
        );
      });

      if (dupActive || dupPending) {
        const text = 'Duplicate found: the same doctor/clinic with address and specialty already exists.';
        setDuplicateMessage(text);
        setSubmitFeedback(text);
        Alert.alert('Duplicate Suggestion', text);
        setSubmitting(false);
        setSubmitStatus('');
        return;
      }

      setSubmitStatus('Saving suggestion...');
      const { error } = await supabase.from('clinic_suggestions').insert({
        doctor_name: doctorName.trim(),
        address: address.trim(),
        specialty: specialty.trim() || null,
        phone: normalizedPhone,
        clinic_type: clinicType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        // No Google place ids any more — admin approval matches on NPI / name+address.
        google_place_id: null,
      });
      if (error) throw error;

      setSubmitStatus('Sending admin notification...');
      try {
        await supabase.functions.invoke('send-email', {
          body: {
            action: 'clinic_suggestion_created',
            doctor_name: doctorName.trim(),
            specialty: specialty.trim(),
            address: address.trim(),
            phone: normalizedPhone,
            clinic_type: clinicType,
          },
        });
      } catch (emailError) {
        // Best-effort admin notification: user submission remains successful.
        console.error('clinic_suggestion email failed', emailError);
      }

      setDoctorName('');
      setSpecialty('');
      setAddress('');
      setCountryCode('+1');
      setCountrySearch('');
      setPhone('');
      setClinicType('doctor');
      setSuggestions([]);
      setSelectedPlaceId(null);
      setSelectedLatLng(null);
      setLatInput('');
      setLngInput('');
      setDuplicateMessage('');
      setSubmitFeedback('Submission received. Thank you!');
      setSubmitStatus('');
      showToast('Submission received. Thank you!');
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Failed to submit. Please try again.';
      setSubmitFeedback(message);
      setSubmitStatus('');
      Alert.alert('Submission Failed', message);
      showToast('Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setDoctorName('');
    setSpecialty('');
    setAddress('');
    setCountryCode('+1');
    setCountrySearch('');
    setPhone('');
    setClinicType('doctor');
    setClinicTypeMenuOpen(false);
    setSuggestions([]);
    setSelectedPlaceId(null);
    setSelectedLatLng(null);
    setLatInput('');
    setLngInput('');
    setDuplicateMessage('');
    setSubmitStatus('');
    setSubmitFeedback('');
  };

  return (
    <View style={[styles.screen, { backgroundColor: isDark ? '#0b1220' : '#e5e7eb' }]}>
      <ScrollView contentContainerStyle={[styles.content, { backgroundColor: isDark ? '#0b1220' : '#e5e7eb' }]}>
        <View style={[styles.header, { backgroundColor: isDark ? '#0f1c34' : '#0284c7' }]}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Can&apos;t Find Your Doctor Office?</Text>
            <Text style={[styles.headerSub, { color: isDark ? '#bfdbfe' : '#dbeafe' }]}>
              Report it here - we&apos;ll review and add it soon
            </Text>
          </View>
        </View>
        <View style={[styles.stepCards, { backgroundColor: isDark ? '#172033' : '#fff', borderColor: isDark ? '#334155' : '#dbe3ee' }]}>
          <View
            style={[
              styles.stepConnector,
              { backgroundColor: isDark ? '#334155' : '#cbd5e1' },
            ]}
          />
          <View style={styles.stepCard}>
            <View style={[styles.stepIcon, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <Feather name="clipboard" size={16} color={isDark ? '#cbd5e1' : '#334155'} />
            </View>
            <Text style={[styles.stepCardTitle, { color: isDark ? '#f1f5f9' : '#111827' }]}>You Report</Text>
            <Text style={[styles.stepCardText, { color: isDark ? '#94a3b8' : '#334155' }]}>
              Submit doctor office details like name, address, and type.
            </Text>
          </View>
          <View style={styles.stepCard}>
            <View style={[styles.stepIcon, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <Ionicons name="search-outline" size={16} color={isDark ? '#cbd5e1' : '#334155'} />
            </View>
            <Text style={[styles.stepCardTitle, { color: isDark ? '#f1f5f9' : '#111827' }]}>Admin Reviews</Text>
            <Text style={[styles.stepCardText, { color: isDark ? '#94a3b8' : '#334155' }]}>
              We verify against public records (NPPES) and maps.
            </Text>
          </View>
          <View style={styles.stepCard}>
            <View style={[styles.stepIcon, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
              <MaterialCommunityIcons name="check-decagram-outline" size={16} color="#16a34a" />
            </View>
            <Text style={[styles.stepCardTitle, { color: isDark ? '#f1f5f9' : '#111827' }]}>Approved & Visible</Text>
            <Text style={[styles.stepCardText, { color: isDark ? '#94a3b8' : '#334155' }]}>
              Once verified, it appears in the app for everyone.
            </Text>
          </View>
        </View>

        <View style={[styles.formCard, { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#dbe3ee' }]}>
            <Text style={[styles.cardTitle, { color: isDark ? '#f1f5f9' : '#111827' }]}>Add a Doctor</Text>
            <Text style={[styles.labelWithStar, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Doctor Office Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' }]}
              placeholder="e.g. Dr. Smith's Family Practice"
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
              value={doctorName}
              onChangeText={setDoctorName}
            />

            <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Type</Text>
            <Pressable
              style={[styles.dropdownLike, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1' }]}
              onPress={() => setClinicTypeMenuOpen((v) => !v)}>
              <Text style={[styles.dropdownText, { color: isDark ? '#e2e8f0' : '#111827' }]}>{getTypeLabel(clinicType)}</Text>
              <Feather name={clinicTypeMenuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? '#94a3b8' : '#64748b'} />
            </Pressable>
            {clinicTypeMenuOpen ? (
              <View style={styles.dropdownMenu}>
                {TYPE_OPTIONS.map((option) => {
                  const selected = option === clinicType;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.dropdownMenuItem, selected && styles.dropdownMenuItemActive]}
                      onPress={() => {
                        setClinicType(option);
                        setClinicTypeMenuOpen(false);
                      }}>
                      <Text style={[styles.dropdownMenuItemText, selected && styles.dropdownMenuItemTextActive]}>
                        {getTypeLabel(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Specialty</Text>
            <TextInput
              style={[styles.input, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' }]}
              placeholder="e.g. Cardiology"
              placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
              value={specialty}
              onChangeText={setSpecialty}
            />

            <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Phone</Text>
            <View style={styles.phoneRow}>
              <Pressable
                style={[
                  styles.dropdownLike,
                  styles.countryDropdown,
                  { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1' },
                ]}
                hitSlop={6}
                onPressIn={() => setCountryMenuOpen((v) => !v)}
              >
                <Text numberOfLines={1} style={[styles.countryDropdownText, { color: isDark ? '#e2e8f0' : '#111827' }]}>
                  {selectedCountry ? `${selectedCountry.flag} ${selectedCountry.code}` : countryCode}
                </Text>
                <Feather name={countryMenuOpen ? 'chevron-up' : 'chevron-down'} size={16} color={isDark ? '#94a3b8' : '#64748b'} />
              </Pressable>
              <TextInput
                style={[
                  styles.input,
                  styles.phoneInput,
                  { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' },
                ]}
                placeholder="Phone number"
                placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/\D/g, ''))}
                keyboardType="phone-pad"
                maxLength={MAX_PHONE_DIGITS}
              />
            </View>
            {countryMenuOpen ? (
              <View style={styles.dropdownMenu}>
                <TextInput
                  style={[
                    styles.input,
                    styles.countrySearchInput,
                    { backgroundColor: isDark ? '#0f172a' : '#f8fafc', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' },
                  ]}
                  placeholder="Type country or +code"
                  placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                  value={countrySearch}
                  onChangeText={handleCountrySearch}
                />
                <ScrollView style={styles.countryList} nestedScrollEnabled>
                  {filteredCountryOptions.map((option) => {
                  const selected = option.code === countryCode;
                  return (
                    <Pressable
                      key={option.iso2}
                      style={[styles.dropdownMenuItem, selected && styles.dropdownMenuItemActive]}
                      onPress={() => {
                        setCountryCode(option.code);
                        setCountrySearch('');
                        setCountryMenuOpen(false);
                      }}
                    >
                      <Text style={[styles.dropdownMenuItemText, selected && styles.dropdownMenuItemTextActive]}>
                        {option.flag} {option.name} ({option.code})
                      </Text>
                    </Pressable>
                  );
                  })}
                  {filteredCountryOptions.length === 0 ? (
                    <Text style={styles.noCountryText}>No country found</Text>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}
            {phoneDigits.length > 0 && !isPhoneComplete ? (
              <Text style={styles.phoneWarn}>Phone number is incomplete.</Text>
            ) : null}

            <Text style={[styles.labelWithStar, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Full Address *</Text>
            <View style={styles.addressRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.addressInput,
                  { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' },
                ]}
                placeholder="e.g. 123 Main St, Miami, FL 33101"
                placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                value={address}
                onChangeText={(text) => {
                  setAddress(text);
                  setSelectedPlaceId(null);
                  setSelectedLatLng(null);
                }}
              />
              <Pressable
                style={[styles.locateBtn, locatingAddress && styles.locateBtnDisabled]}
                onPress={() => void fillFromCurrentLocationAddress()}
                disabled={locatingAddress}>
                {locatingAddress ? (
                  <ActivityIndicator size="small" color="#0284c7" />
                ) : (
                  <Ionicons name="locate-outline" size={15} color="#0284c7" />
                )}
              </Pressable>
            </View>
            <Text style={[styles.addressHelp, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Choose from suggestions for best accuracy, or enter address manually.
            </Text>
            {loadingSuggestions ? <ActivityIndicator color="#0284c7" /> : null}
            {suggestions.map((suggestion) => (
              <Pressable key={suggestion.place_id} style={styles.suggestion} onPress={() => void chooseSuggestion(suggestion)}>
                <Text style={styles.suggestionText}>{suggestion.description}</Text>
              </Pressable>
            ))}

            <Text style={[styles.label, { color: isDark ? '#e2e8f0' : '#0f172a' }]}>Coordinates (optional)</Text>
            <View style={styles.latLngRow}>
              <TextInput
                style={[styles.input, styles.coordInput, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' }]}
                placeholder="Latitude"
                placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                value={latInput}
                onChangeText={setLatInput}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TextInput
                style={[styles.input, styles.coordInput, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderColor: isDark ? '#475569' : '#cbd5e1', color: isDark ? '#e2e8f0' : '#0f172a' }]}
                placeholder="Longitude"
                placeholderTextColor={isDark ? '#94a3b8' : '#64748b'}
                value={lngInput}
                onChangeText={setLngInput}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <Text style={[styles.addressHelp, { color: isDark ? '#94a3b8' : '#64748b' }]}>
              Auto-filled when you pick a suggestion or use current location. For a custom spot, paste exact coordinates from Google Maps (long-press the location → tap the lat, long to copy) for precise placement.
            </Text>
            {latInput.trim() !== '' && lngInput.trim() !== '' && !parsedManualCoords ? (
              <Text style={styles.phoneWarn}>Invalid coordinates. Latitude -90 to 90, longitude -180 to 180.</Text>
            ) : null}

            <Pressable style={[styles.primaryButton, !canSubmit && styles.disabled]} disabled={!canSubmit} onPress={() => void submit()}>
              <Text style={styles.primaryButtonText}>{submitting ? 'Submitting...' : 'Submit Suggestion'}</Text>
            </Pressable>
            {duplicateMessage ? <Text style={styles.duplicateWarn}>{duplicateMessage}</Text> : null}
          </View>

        <View style={[styles.noteCard, { backgroundColor: isDark ? '#172033' : 'white', borderColor: isDark ? '#334155' : '#dbe3ee' }]}>
          <Text style={[styles.note, { color: isDark ? '#cbd5e1' : '#374151' }]}>
            All submissions are reviewed manually. Only verified locations are published.
          </Text>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#e5e7eb',
  },
  content: {
    flexGrow: 1,
    backgroundColor: '#e5e7eb',
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingTop: 42,
    paddingBottom: 36,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
  },
  headerTextWrap: {
    paddingTop: 14,
  },
  headerSub: {
    color: '#dbeafe',
    marginTop: 4,
    fontSize: 12,
  },
  stepCards: {
    marginHorizontal: 8,
    marginTop: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    paddingVertical: 12,
    flexDirection: 'row',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
    position: 'relative',
  },
  stepConnector: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    top: 30,
    height: 2,
    borderRadius: 999,
  },
  stepCard: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 6,
    zIndex: 2,
  },
  stepIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCardTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  stepCardText: {
    textAlign: 'center',
    fontSize: 9,
    lineHeight: 12,
    color: '#334155',
  },
  formCard: {
    marginHorizontal: 8,
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    padding: 12,
    gap: 8,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTitle: {
    fontSize: 23,
    color: '#111827',
    fontWeight: '700',
  },
  labelWithStar: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
  },
  dropdownLike: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    color: '#111827',
    fontSize: 16,
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownMenuItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownMenuItemActive: {
    backgroundColor: '#e0f2fe',
  },
  dropdownMenuItemText: {
    color: '#334155',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  dropdownMenuItemTextActive: {
    color: '#0c4a6e',
    fontWeight: '700',
  },
  typeRow: {
    display: 'none',
  },
  typeChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'white',
  },
  typeChipActive: {
    borderColor: '#0284c7',
    backgroundColor: '#e0f2fe',
  },
  typeChipText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  typeChipTextActive: {
    color: '#0c4a6e',
  },
  suggestion: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
  },
  suggestionText: {
    color: '#334155',
    fontSize: 12,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  latLngRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coordInput: {
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  countryDropdown: {
    width: 112,
  },
  countryDropdownText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  countrySearchInput: {
    margin: 8,
    marginBottom: 4,
    paddingVertical: 10,
  },
  countryList: {
    maxHeight: 220,
  },
  noCountryText: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#64748b',
    fontSize: 12,
  },
  phoneInput: {
    flex: 1,
  },
  addressInput: {
    flex: 1,
  },
  locateBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
  },
  locateBtnDisabled: {
    opacity: 0.7,
  },
  addressHelp: {
    color: '#64748b',
    fontSize: 11,
    marginTop: -2,
  },
  duplicateWarn: {
    color: '#b91c1c',
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 12,
  },
  phoneWarn: {
    color: '#b91c1c',
    fontSize: 11,
    marginTop: -2,
  },
  primaryButton: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: '800',
  },
  noteCard: {
    marginHorizontal: 8,
    marginTop: 10,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#dbe3ee',
    padding: 12,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  note: {
    color: '#374151',
    fontSize: 12,
    lineHeight: 18,
  },
});
