import { useEffect, useRef, useState } from 'react';

import { getDeviceFingerprint } from '@/src/lib/device-fingerprint';
import type { LatLng } from '@/src/lib/geolocation';
import { supabase } from '@/src/lib/supabase';

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 300;

/**
 * A medical place result. `db` = already in our directory. `google` = a verified
 * Google place that was just auto-cached into the directory in the background,
 * so the user is never asked to "add" it — it is already saved.
 */
export type MedicalPlaceResult = {
  source: 'db' | 'google';
  id?: string;
  place_id?: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export type MedicalSearchState = {
  results: MedicalPlaceResult[];
  loading: boolean;
  /** Google was skipped because the per-device / global rate limit was hit. */
  limited: boolean;
  /** Google was attempted but failed/unavailable; DB results still valid. */
  degraded: boolean;
};

const isValidResult = (r: unknown): r is MedicalPlaceResult => {
  const o = r as Record<string, unknown> | null;
  return (
    !!o &&
    (o.source === 'db' || o.source === 'google') &&
    typeof o.name === 'string' &&
    typeof o.latitude === 'number' &&
    Number.isFinite(o.latitude) &&
    typeof o.longitude === 'number' &&
    Number.isFinite(o.longitude)
  );
};

const EMPTY: Pick<MedicalSearchState, 'results' | 'limited' | 'degraded'> = {
  results: [],
  limited: false,
  degraded: false,
};

/**
 * DB-first medical search. Debounced, cancels stale responses (a slow earlier
 * request can never overwrite a newer one), and never throws — any failure
 * surfaces as `degraded` with whatever results are available.
 */
export const useMedicalSearch = (query: string, userLocation: LatLng | null): MedicalSearchState => {
  const [state, setState] = useState<MedicalSearchState>({ ...EMPTY, loading: false });
  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lat = userLocation?.latitude ?? null;
  const lng = userLocation?.longitude ?? null;

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < MIN_QUERY_LEN) {
      // bump request id so any in-flight response is discarded
      reqIdRef.current += 1;
      setState({ ...EMPTY, loading: false });
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    debounceRef.current = setTimeout(() => {
      const myReqId = (reqIdRef.current += 1);
      void (async () => {
        try {
          const deviceId = await getDeviceFingerprint();
          const { data, error } = await supabase.functions.invoke('medical-search', {
            body: {
              action: 'search',
              query: q,
              deviceId,
              location:
                typeof lat === 'number' && typeof lng === 'number'
                  ? { latitude: lat, longitude: lng }
                  : null,
            },
          });
          if (myReqId !== reqIdRef.current) return; // stale — a newer request won

          const payload = (data ?? null) as Record<string, unknown> | null;
          if (error || !payload || payload.ok !== true) {
            setState({ ...EMPTY, loading: false, degraded: true });
            return;
          }

          setState({
            results: Array.isArray(payload.results) ? payload.results.filter(isValidResult) : [],
            limited: payload.limited === true,
            degraded: payload.degraded === true,
            loading: false,
          });
        } catch {
          if (myReqId !== reqIdRef.current) return;
          setState({ ...EMPTY, loading: false, degraded: true });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, lat, lng]);

  return state;
};
