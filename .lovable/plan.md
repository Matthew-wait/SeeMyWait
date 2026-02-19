

# See Your Wait Time Tracker — MVP Plan

## Overview
A mobile app (wrapped with Capacitor for App Store/Play Store) that works like "Waze for Doctor's Offices." Patients can search for clinics in Miami, see real-time wait times reported by other patients, and submit wait times when physically at a clinic. Includes an admin dashboard for managing data.

---

## Phase 1: Database & Backend Setup

### Doctor/Clinic Database
- Create a `clinics` table storing name, address, latitude, longitude, phone, and metadata
- Edge function to search and import clinics from Google Places API for the Miami area
- Store Google Place IDs to avoid duplicates

### Wait Time Reports
- Create a `wait_time_reports` table storing clinic ID, wait time category (On Time / 30 min / 1 hour / 1.5+ hours), timestamp, and device fingerprint
- Reports are anonymous — no user accounts required to submit
- Spam prevention: limit one report per device per clinic per hour
- Aggregation logic to show the most recent/averaged wait time for each clinic

### User-Suggested Clinics
- Create a `clinic_suggestions` table for user-submitted clinics pending admin review
- Fields: doctor name, address (with Google Places autocomplete)

### Admin Authentication & Roles
- Admin login with email/password via Supabase Auth
- Role-based access using a `user_roles` table
- RLS policies so only admins can manage clinics and approve suggestions

---

## Phase 2: Patient-Facing Experience (Mobile UI)

### Home / Search Screen
- Search bar for doctor or clinic name
- "Near Me" button that uses GPS to find clinics within 5 miles
- Results show clinic name, address, distance, and current wait time indicator
- Clean, fast, bottom-bar navigation

### Clinic Detail Screen
- Clinic name, address, and embedded map view (Google Maps)
- Live wait time display based on recent reports (e.g., "Current Wait: ~45 mins" or "No reports yet")
- Timestamp of last report for transparency

### Report Wait Time Screen
- **Geofencing check**: App verifies user's GPS is within ~100 meters of the clinic before allowing a report
- Simple tap-to-report buttons: **On Time** | **30 Min** | **1 Hour** | **1.5+ Hours**
- Confirmation feedback after submission
- If user is not at the clinic, show a friendly message explaining they must be on-site

### Add a Doctor / Suggest a Clinic
- Simple form with doctor name and address (with Google Places autocomplete)
- Submission goes to admin review queue

---

## Phase 3: Admin Dashboard

### Clinic Management
- Table view of all clinics with search and filters
- Create, edit, and delete clinic entries
- Bulk import option from Google Places search

### Suggestion Review Queue
- List of user-submitted clinic suggestions
- Approve (adds to main database) or reject with one click

### Data Oversight
- View recent wait time reports per clinic
- Ability to flag or remove erroneous/spam reports
- Manual wait time reset if needed

---

## Phase 4: Capacitor Native Wrapping

- Configure Capacitor for iOS and Android builds
- Set up proper app ID and metadata for store submissions
- Geolocation permissions configured for native GPS access
- Instructions provided for building and submitting to App Store and Google Play

---

## Design & UX Principles
- **Mobile-first**, clean, minimal UI — speed and utility over decoration
- Bottom navigation bar: Search | Report | Settings
- Color-coded wait time badges (green = on time, yellow = moderate, red = long wait)
- Works great on all phone sizes

---

## Key Technical Components
- **Google Maps API** (Places, Geocoding, Maps display) via Edge Function to keep API key secure
- **Supabase** for database, auth, and edge functions
- **Browser Geolocation API / Capacitor Geolocation** for GPS verification
- **Anonymous usage** — no registration required to search or report; admin login only for management

