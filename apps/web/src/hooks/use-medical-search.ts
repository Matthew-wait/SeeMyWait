import { useEffect, useRef, useState } from "react";
import {
  MedicalSearchResult,
  MIN_QUERY_LENGTH,
  SEARCH_DEBOUNCE_MS,
  searchMedicalPlaces,
} from "@/lib/medical-search";

interface MedicalSearchState {
  results: MedicalSearchResult[];
  loading: boolean;
  /** Rate limit hit — only saved offices are shown. */
  limited: boolean;
  /** Google unavailable — only saved offices are shown. */
  degraded: boolean;
  /** True once a search for the current query has actually completed. */
  searched: boolean;
}

const EMPTY: MedicalSearchState = {
  results: [],
  loading: false,
  limited: false,
  degraded: false,
  searched: false,
};

/**
 * Debounced place search against the `medical-search` edge function.
 *
 * Responses are sequence-checked: a slow answer to an older keystroke is
 * dropped rather than overwriting results for what the user has since typed.
 */
export function useMedicalSearch(
  query: string,
  location: { latitude: number; longitude: number } | null
): MedicalSearchState {
  const [state, setState] = useState<MedicalSearchState>(EMPTY);

  const requestIdRef = useRef(0);
  // Keep location out of the effect deps: a drifting GPS fix would otherwise
  // re-fire the search on every position update.
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    const trimmed = query.trim();

    if (trimmed.length < MIN_QUERY_LENGTH) {
      requestIdRef.current += 1; // invalidate anything in flight
      setState(EMPTY);
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    const timer = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      const response = await searchMedicalPlaces(trimmed, locationRef.current);

      // A newer keystroke started while this was in flight — discard.
      if (requestId !== requestIdRef.current) return;

      setState({
        results: response.results,
        loading: false,
        limited: response.limited,
        degraded: response.degraded,
        searched: true,
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return state;
}
