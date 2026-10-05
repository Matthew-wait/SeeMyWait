# City name clean-up (proposed, not applied)

Status: proposal for review. No data has been changed.

## Rule
1. Cut anything after a comma or period: "Miami, Florida 33133" -> "Miami", "Land O' Lakes" stays as is.
2. Remove non-letters (except spaces) before comparing, so "Miami Fl" and "Miami, Florida" compare as the same key.
3. Within each key, the canonical name is the spelling with the most offices and no comma or state suffix.
4. Only typos (for example "Miami Gradens", "Miami Bch") need a manual mapping, reviewed one by one.

## Florida sample (from the live data)
| Canonical | Variants (count) |
|---|---|
| Miami (63,164) | Miami, Florida, United States (1); Miami, Gardens,Fl (1); Miami, Florida 33133 (1) |
| Jacksonville (29,301) | Jacksonville, Fl 32209 (1); Jacksonville, (1); Jacksonville, Fl (1) |
| West Palm Beach (9,711) | West Palm Beach, (2); West Palm Beach, Fl (1) |
| Boca Raton (8,907) | Boca Raton, (1); Boca Raton, Fl (1) |
| Land O Lakes (767) | Land O' Lakes (8); Land 'O Lakes (1); Land O Lakes, (1) |

Typos still to map by hand, from the Florida list: "Miami Gradens" -> "Miami Gardens", "Miami Bch" -> "Miami Beach", "Miamia Beach" -> "Miami Beach", "Miami Bach" -> "Miami Beach", "Miami Lake" -> "Miami Lakes", "Miamidade" -> "Miami-Dade".

## Effect
Florida alone has a few hundred affected offices out of 589,657. Nationally, the same rule applies to all 56 jurisdictions.

## Next (after approval)
1. Apply rule 1 and 2 nationally, as one set-based update per state.
2. Review the typo list with you, then map those.
3. Rebuild the city summary (refresh_clinic_city_summary for each state) so the dropdowns show clean names.
