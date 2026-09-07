import { useEffect, useRef, useState } from 'react';

import type { LatLng } from '@/src/lib/geolocation';
import { supabase } from '@/src/lib/supabase';
import { getDeviceFingerprint } from '@/src/lib/device-fingerprint';
import { searchMedicalPlaces, type MedicalSearchResult } from '@seemywait/core';

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 300;

/**
 * A medical place result. `db` = already in our directory. `npi` = an NPPES
 * registry match the user must confirm ("Verify & Add") before it's saved.
 */
export type MedicalPlaceResult = MedicalSearchResult & {
  /** legacy alias some components still read */
  id?: string;
  place_id?: string;
};

export type MedicalSearchState = {
  results: MedicalPlaceResult[];
  loading: boolean;
  /** The registry was skipped because a rate limit was hit. */
  limited: boolean;
  /** The registry was attempted but unavailable; DB results still valid. */
  degraded: boolean;
};

const EMPTY: Pick<MedicalSearchState, 'results' | 'limited' | 'degraded'> = {
  results: [],
  limited: false,
  degraded: false,
};

/**
 * DB-first medical search (NPPES-backed). Debounced, cancels stale responses,
 * and never throws — any failure surfaces as `degraded` with whatever results
 * are available.
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
          const location =
            typeof lat === 'number' && typeof lng === 'number'
              ? { latitude: lat, longitude: lng }
              : null;
          const res = await searchMedicalPlaces(supabase, deviceId, q, location);
          if (myReqId !== reqIdRef.current) return; // stale — a newer request won
          setState({
            results: res.results as MedicalPlaceResult[],
            limited: res.limited,
            degraded: res.degraded,
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
