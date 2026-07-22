/**
 * Prefill contract for the Add-Doctor form. Passed via router state from the
 * map's tap-to-add flows (POI tap and empty-point "Add here"). Every field is
 * optional; the form hydrates its initial state from whatever is present.
 */
export interface AddDoctorPrefill {
  name?: string;
  address?: string;
  specialty?: string;
  type?: "doctor" | "clinic" | "hospital" | "urgent_care";
  place_id?: string | null;
  lat?: number | null;
  lng?: number | null;
}
