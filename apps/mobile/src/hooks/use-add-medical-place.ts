import { useCallback, useRef, useState } from 'react';

import { getDeviceFingerprint } from '@/src/lib/device-fingerprint';
import { supabase } from '@/src/lib/supabase';
import { addMedicalPlace, type AddedClinic as CoreAddedClinic } from '@seemywait/core';

/** The clinic row returned by the `add` action after an NPPES place is saved. */
export type AddedClinic = CoreAddedClinic;

export type AddResult =
  | { ok: true; clinic: AddedClinic; existed: boolean }
  | {
      ok: false;
      reason: 'rate_limited' | 'not_medical' | 'permanently_closed' | 'no_coordinates' | 'failed' | 'busy';
    };

const reasonFrom = (error?: string, limited?: boolean): AddResult => {
  const reason: Extract<AddResult, { ok: false }>['reason'] =
    limited === true || error === 'rate_limited'
      ? 'rate_limited'
      : error === 'not_medical'
        ? 'not_medical'
        : error === 'permanently_closed'
          ? 'permanently_closed'
          : error === 'no_coordinates'
            ? 'no_coordinates'
            : 'failed';
  return { ok: false, reason };
};

/**
 * Saves an NPPES provider into the directory by NPI. Idempotent server-side
 * (returns the existing clinic if already saved). Guards against double-taps and
 * never throws — failures come back as a typed reason.
 */
export const useAddMedicalPlace = () => {
  const [addingId, setAddingId] = useState<string | null>(null);
  const inFlight = useRef(false);

  const addPlace = useCallback(async (npi: string): Promise<AddResult> => {
    if (inFlight.current) return { ok: false, reason: 'busy' };
    inFlight.current = true;
    setAddingId(npi);
    try {
      const deviceId = await getDeviceFingerprint();
      const res = await addMedicalPlace(supabase, deviceId, npi);
      if (!res.ok || !res.clinic?.id) return reasonFrom(res.error, res.limited);
      return { ok: true, clinic: res.clinic, existed: res.existed === true };
    } catch {
      return { ok: false, reason: 'failed' };
    } finally {
      inFlight.current = false;
      setAddingId(null);
    }
  }, []);

  return { addPlace, addingId };
};
