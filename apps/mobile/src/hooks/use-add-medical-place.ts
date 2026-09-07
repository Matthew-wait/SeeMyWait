import { useCallback, useRef, useState } from 'react';

import { getDeviceFingerprint } from '@/src/lib/device-fingerprint';
import { supabase } from '@/src/lib/supabase';

/** The clinic row returned by the `add` action after a Google place is saved. */
export type AddedClinic = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  specialty: string | null;
  google_place_id: string | null;
};

export type AddResult =
  | { ok: true; clinic: AddedClinic; existed: boolean }
  | { ok: false; reason: 'rate_limited' | 'not_medical' | 'permanently_closed' | 'no_coordinates' | 'failed' | 'busy' };

const reasonFrom = (p: Record<string, unknown> | null): AddResult => {
  const err = typeof p?.error === 'string' ? p.error : '';
  const reason =
    p?.limited === true || err === 'rate_limited'
      ? 'rate_limited'
      : err === 'not_medical'
        ? 'not_medical'
        : err === 'permanently_closed'
          ? 'permanently_closed'
          : err === 'no_coordinates'
            ? 'no_coordinates'
            : 'failed';
  return { ok: false, reason };
};

/**
 * Saves a Google place into the directory by place_id. Idempotent server-side
 * (returns the existing clinic if already saved). Guards against double-taps and
 * never throws — failures come back as a typed reason.
 */
export const useAddMedicalPlace = () => {
  const [addingId, setAddingId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const addPlace = useCallback(async (placeId: string): Promise<AddResult> => {
    if (inFlight.current) return { ok: false, reason: 'busy' };
    inFlight.current = true;
    setAddingId(placeId);
    try {
      const deviceId = await getDeviceFingerprint();
      const { data, error } = await supabase.functions.invoke('medical-search', {
        body: { action: 'add', placeId, deviceId },
      });
      const p = (data ?? null) as Record<string, unknown> | null;
      if (error || !p || p.ok !== true) return reasonFrom(p);

      const clinic = p.clinic as AddedClinic | undefined;
      if (!clinic || typeof clinic.id !== 'string') return { ok: false, reason: 'failed' };
      return { ok: true, clinic, existed: p.existed === true };
    } catch {
      return { ok: false, reason: 'failed' };
    } finally {
      inFlight.current = false;
      setAddingId(null);
    }
  }, []);

  return { addPlace, addingId };
};
