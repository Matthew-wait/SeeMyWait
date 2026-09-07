# SeeMyWait – Real-Time Doctor Wait Times

SeeMyWait is a modern web application that allows patients to see real-time, location-verified wait times at doctor's offices before they leave home. 

---

## 🛠️ Tech Stack

This project is built using:
- **Frontend Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Maps**: [Leaflet](https://leafletjs.com/) + [OpenStreetMap](https://www.openstreetmap.org/) tiles
- **Directory & Geocoding**: [NPPES NPI Registry](https://npiregistry.cms.hhs.gov/api/), [US Census geocoder](https://geocoding.geo.census.gov/), [Nominatim](https://nominatim.openstreetmap.org/), [Photon](https://photon.komoot.io/) — all free, no API key
- **Testing**: [Vitest](https://vitest.dev/)

---

## ⚙️ Local Development Setup

### Prerequisites
Ensure you have [Node.js (v20+)](https://nodejs.org/) installed.

### 1. Clone & Install
```bash
# Clone the repository
git clone https://github.com/Matthew-wait/SeeMyWait.git
cd SeeMyWait

# Install dependencies
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in the Supabase values (Dashboard → Project
Settings → API):
```env
VITE_SUPABASE_URL="your_supabase_url"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
```
The map runs on keyless OpenStreetMap tiles by default. For production set
`VITE_MAP_TILE_URL` to a provider with a commercial free tier (e.g. Stadia Maps)
and put the key in `VITE_MAP_TILE_KEY`. The `medical-search` edge function needs
no API keys — see `supabase/functions/medical-search/README.md`.

### 3. Start Development Server
```bash
npm run dev
```
The app runs locally at `http://localhost:3001`.

---

## 🧪 Production Build & Testing

### Run Tests
```bash
npm run test
```

### Compile Production Build
```bash
npm run build
```
This generates compiled static assets in the `dist/` directory.

---

## 🚀 Deployment

The project is configured for automated deployments to **Vercel** with client-side SPA routing supported via `vercel.json`. Whenever changes are pushed to the `main` branch, Vercel will automatically build and deploy the update live to [seemywait.com](https://seemywait.com).
