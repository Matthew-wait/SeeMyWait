# SeeMyWait – Real-Time Doctor Wait Times

SeeMyWait is a modern web application that allows patients to see real-time, location-verified wait times at doctor's offices before they leave home. 

---

## 🛠️ Tech Stack

This project is built using:
- **Frontend Framework**: [React](https://react.dev/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Database & Auth**: [Supabase](https://supabase.com/)
- **Maps & Geocoding**: [Google Maps Platform](https://developers.google.com/maps)
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
Create a `.env` file in the root directory and add the following keys (see `.env.example` for details):
```env
VITE_SUPABASE_PROJECT_ID="your_project_id"
VITE_SUPABASE_PUBLISHABLE_KEY="your_publishable_key"
VITE_SUPABASE_URL="your_supabase_url"
GOOGLE_MAPS_API_KEY="your_google_maps_key"
GOOGLE_GEOCODE_API_KEY="your_google_geocode_key"
```

### 3. Start Development Server
```bash
npm run dev
```
The app will run locally at `http://localhost:8080` (or `http://localhost:5173`).

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
