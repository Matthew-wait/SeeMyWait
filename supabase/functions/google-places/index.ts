import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scoreAddressMatch(query: string, candidate: string): number {
  const queryNorm = normalizeText(query);
  const candidateNorm = normalizeText(candidate);
  if (!queryNorm || !candidateNorm) return 0;

  const tokens = queryNorm.split(" ").filter((t) => t.length >= 3);
  if (!tokens.length) return 0;

  let score = 0;
  for (const token of tokens) {
    if (candidateNorm.includes(token)) score += 1;
  }
  return score;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, query, location, radius, placeId, origin, destinations } = await req.json();
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "search") {
      // Text search for clinics/doctors
      const searchQuery = query || "doctor clinic";
      const hasLocationBias = typeof location === "string" && location.trim().length > 0;
      const rad = radius || 8000; // ~5 miles
      const biasParams = hasLocationBias ? `&location=${location}&radius=${rad}` : "";

      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        searchQuery
      )}${biasParams}&type=doctor&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "nearby") {
      const loc = location || "25.7617,-80.1918";
      const rad = radius || 8000;

      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${loc}&radius=${rad}&type=doctor&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "details") {
      if (!placeId) {
        return new Response(
          JSON.stringify({ error: "placeId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,geometry,formatted_phone_number,types&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "geocode") {
      const searchQuery = String(query || "").trim();
      if (!searchQuery) {
        return new Response(
          JSON.stringify({ error: "query is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const countryCode = "pk";
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        searchQuery
      )}&components=country:${countryCode}&region=${countryCode}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      // Primary: Google geocode
      if (Array.isArray(data?.results) && data.results.length > 0) {
        const ranked = [...data.results].sort((a: any, b: any) => {
          const aAddress = String(a?.formatted_address || "");
          const bAddress = String(b?.formatted_address || "");
          return scoreAddressMatch(searchQuery, bAddress) - scoreAddressMatch(searchQuery, aAddress);
        });
        return new Response(JSON.stringify({ ...data, results: ranked }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fallback: OpenStreetMap Nominatim for broad place names (e.g., city/locality inputs)
      const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=${countryCode}&q=${encodeURIComponent(
        searchQuery
      )}`;
      const osmResponse = await fetch(osmUrl, {
        headers: { "User-Agent": "seeyourwait-geocode-fallback/1.0" },
      });
      const osmData = await osmResponse.json();
      const rankedOsm = Array.isArray(osmData)
        ? [...osmData].sort((a: any, b: any) => {
            const aAddress = String(a?.display_name || "");
            const bAddress = String(b?.display_name || "");
            return scoreAddressMatch(searchQuery, bAddress) - scoreAddressMatch(searchQuery, aAddress);
          })
        : [];
      const first = rankedOsm[0] || null;
      const lat = first?.lat ? parseFloat(first.lat) : NaN;
      const lng = first?.lon ? parseFloat(first.lon) : NaN;

      if (!isNaN(lat) && !isNaN(lng)) {
        return new Response(
          JSON.stringify({
            results: [
              {
                place_id: first.place_id ? String(first.place_id) : null,
                formatted_address: first.display_name || searchQuery,
                geometry: { location: { lat, lng } },
              },
            ],
            provider: "nominatim_fallback",
            google_status: data?.status || null,
            google_error_message: data?.error_message || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          results: [],
          provider: "none",
          google_status: data?.status || null,
          google_error_message: data?.error_message || null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "autocomplete") {
      if (!query) {
        return new Response(
          JSON.stringify({ error: "query is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
        query
      )}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data?.status && data.status !== "OK") {
        return new Response(
          JSON.stringify({
            predictions: [],
            status: data.status,
            error_message: data.error_message || null,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "distance_matrix") {
      if (
        !origin ||
        typeof origin.lat !== "number" ||
        typeof origin.lng !== "number" ||
        !Array.isArray(destinations) ||
        destinations.length === 0
      ) {
        return new Response(
          JSON.stringify({ error: "origin and destinations are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const destinationCoords = destinations
        .filter(
          (d: any) =>
            d &&
            typeof d.id === "string" &&
            typeof d.lat === "number" &&
            typeof d.lng === "number"
        )
        .slice(0, 25);

      if (destinationCoords.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid destinations provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const originsParam = `${origin.lat},${origin.lng}`;
      const destinationsParam = destinationCoords
        .map((d: any) => `${d.lat},${d.lng}`)
        .join("|");

      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
        originsParam
      )}&destinations=${encodeURIComponent(destinationsParam)}&mode=driving&units=metric&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      let provider: "google" | "osrm_fallback" = "google";
      let distances:
        | { id: string; route_distance_meters: number | null; route_distance_miles: number | null }[]
        | null = null;

      const elements = data?.rows?.[0]?.elements;
      if (Array.isArray(elements)) {
        distances = destinationCoords.map((d: any, idx: number) => {
          const element = elements[idx];
          const meters =
            element?.status === "OK" && typeof element?.distance?.value === "number"
              ? element.distance.value
              : null;
          return {
            id: d.id,
            route_distance_meters: meters,
            route_distance_miles: meters !== null ? meters / 1609.34 : null,
          };
        });
      }

      // If Google distance matrix is denied/unavailable, fallback to OSRM route distance.
      if (!distances || data?.status !== "OK") {
        provider = "osrm_fallback";
        const originPart = `${origin.lng},${origin.lat}`;
        const osrmResults = await Promise.all(
          destinationCoords.map(async (d: any) => {
            try {
              const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${originPart};${d.lng},${d.lat}?overview=false`;
              const osrmResponse = await fetch(osrmUrl);
              const osrmData = await osrmResponse.json();
              const meters =
                Array.isArray(osrmData?.routes) &&
                typeof osrmData.routes[0]?.distance === "number"
                  ? osrmData.routes[0].distance
                  : null;
              return {
                id: d.id,
                route_distance_meters: meters,
                route_distance_miles: meters !== null ? meters / 1609.34 : null,
              };
            } catch {
              return {
                id: d.id,
                route_distance_meters: null,
                route_distance_miles: null,
              };
            }
          })
        );
        distances = osrmResults;
      }

      return new Response(JSON.stringify({ distances, provider }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "import") {
      // Admin action: import clinics from Google Places into DB
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const searchQuery = query || "doctor Miami";
      const loc = location || "25.7617,-80.1918";
      const rad = radius || 16000;

      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        searchQuery
      )}&location=${loc}&radius=${rad}&type=doctor&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      if (!data.results) {
        return new Response(
          JSON.stringify({ error: "No results from Google Places" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const clinics = data.results.map((place: any) => ({
        name: place.name,
        address: place.formatted_address,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        google_place_id: place.place_id,
      }));

      const inserted: unknown[] = [];
      let skippedDuplicates = 0;
      for (const row of clinics) {
        const { data: rowData, error: insertError } = await supabase
          .from("clinics")
          .upsert(row, { onConflict: "google_place_id" })
          .select();

        if (insertError) {
          const code = (insertError as { code?: string }).code;
          if (code === "23505") {
            skippedDuplicates++;
            continue;
          }
          return new Response(
            JSON.stringify({ error: insertError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (rowData?.length) inserted.push(...rowData);
      }

      return new Response(
        JSON.stringify({
          imported: inserted.length,
          skippedDuplicates,
          clinics: inserted,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: search, nearby, details, geocode, autocomplete, distance_matrix, import" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
