import { useState } from "react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import {
  MapPin, Clock, Shield, Search, CheckCircle, Eye, Zap,
  Users, Lock, ArrowRight, ChevronDown, Smartphone,
  Timer, AlertTriangle, TrendingDown, Fingerprint, Globe,
  Heart, CalendarCheck, ShieldCheck, Activity
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ──────────────────── helpers ──────────────────── */

function Section({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isVisible } = useScrollAnimation(0.1);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-10"
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function GlowButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  if (variant === "secondary") {
    return (
      <button
        className={`group relative inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm font-medium text-white/90 backdrop-blur-sm transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-105 ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      className={`group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-cyan-500/40 hover:shadow-xl hover:scale-105 active:scale-[0.98] ${className}`}
    >
      <span className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-50" />
      <span className="relative z-10 flex items-center gap-2">
        {children}
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
      </span>
    </button>
  );
}

/* ──────────────────── phone mockup ──────────────────── */

function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[260px] sm:w-[280px]">
      {/* floating labels */}
      <div className="absolute -left-20 top-16 animate-float-slow z-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-md">
          <CheckCircle className="h-3 w-3" /> Location Verified
        </span>
      </div>
      <div className="absolute -right-16 top-36 animate-float-delayed z-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-300 backdrop-blur-md">
          <Users className="h-3 w-3" /> Real Patient Data
        </span>
      </div>
      <div className="absolute -left-12 bottom-28 animate-float z-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/20 border border-purple-500/30 px-3 py-1.5 text-xs font-medium text-purple-300 backdrop-blur-md">
          <Shield className="h-3 w-3" /> Spam Protected
        </span>
      </div>

      {/* phone frame */}
      <div className="relative rounded-[2.5rem] border-2 border-white/10 bg-gradient-to-b from-slate-800 to-slate-900 p-3 shadow-2xl shadow-cyan-500/10">
        <div className="absolute left-1/2 top-3 h-5 w-20 -translate-x-1/2 rounded-full bg-black" />
        <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-slate-900 to-slate-950">
          {/* status bar */}
          <div className="flex items-center justify-between px-5 pt-8 pb-2">
            <span className="text-[10px] text-white/50">9:41</span>
            <div className="flex gap-1">
              <div className="h-1.5 w-3 rounded-sm bg-white/50" />
              <div className="h-1.5 w-3 rounded-sm bg-white/30" />
            </div>
          </div>
          {/* header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-4 py-3">
            <p className="text-xs font-semibold text-white">See Your Wait Time</p>
            <p className="text-[9px] text-white/70">Miami, FL</p>
          </div>
          {/* clinic list */}
          <div className="space-y-2 p-3">
            {[
              { name: "Dr. Martinez", wait: "~15 min", color: "bg-emerald-500", pulse: false },
              { name: "Dr. Thompson", wait: "~45 min", color: "bg-amber-500", pulse: true },
              { name: "Dr. Patel", wait: "~1 hr+", color: "bg-red-500", pulse: false },
            ].map((c, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 px-3 py-2.5 transition-all duration-500"
                style={{ animationDelay: `${i * 200}ms` }}
              >
                <div>
                  <p className="text-[11px] font-medium text-white">{c.name}</p>
                  <p className="text-[9px] text-white/40">Family Medicine</p>
                </div>
                <span className={`relative flex items-center gap-1 rounded-full ${c.color}/20 px-2 py-0.5 text-[10px] font-semibold text-white`}>
                  {c.pulse && (
                    <span className={`absolute inset-0 rounded-full ${c.color}/30 animate-ping`} />
                  )}
                  <Clock className="h-2.5 w-2.5" />
                  {c.wait}
                </span>
              </div>
            ))}
            {/* report buttons */}
            <div className="mt-2 rounded-xl bg-white/5 border border-white/5 p-2">
              <p className="mb-1.5 text-[9px] text-white/40 text-center">Report Wait Time</p>
              <div className="flex gap-1.5 justify-center">
                {["On Time", "30 Min", "1 Hour"].map((t) => (
                  <span key={t} className="rounded-lg bg-cyan-500/20 border border-cyan-500/20 px-2 py-1 text-[9px] font-medium text-cyan-300">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {/* mini map */}
            <div className="relative mt-2 h-20 overflow-hidden rounded-xl bg-slate-800/80 border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/20 to-blue-900/20" />
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="relative">
                  <div className="h-3 w-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                  <div className="absolute inset-0 h-3 w-3 animate-ping rounded-full bg-cyan-400/60" />
                  <div className="absolute -inset-3 rounded-full border border-cyan-400/20 animate-pulse" />
                  <div className="absolute -inset-6 rounded-full border border-cyan-400/10" />
                </div>
              </div>
              <MapPin className="absolute left-8 top-4 h-3 w-3 text-red-400/60" />
              <MapPin className="absolute right-10 bottom-4 h-3 w-3 text-red-400/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────── LANDING PAGE ──────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white overflow-x-hidden">
      {/* ── NAV ── */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">See Your Wait Time</span>
          </div>
          <GlowButton variant="secondary" className="text-xs px-4 py-2">
            Get the App
          </GlowButton>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-screen pt-20 flex items-center">
        {/* bg effects */}
        <div className="absolute inset-0">
          <div className="absolute left-1/4 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-600/10 blur-[120px]" />
          <div className="absolute right-1/4 bottom-1/4 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/5 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center">
          {/* left */}
          <Section>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-xs font-medium text-cyan-300">
              <Activity className="h-3 w-3" />
              Launching Soon on Google Play
            </p>
            <h1 className="mb-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Stop Waiting.{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Start Saving Time.
              </span>
            </h1>
            <p className="mb-2 max-w-lg text-lg text-white/70">
              See real-time, location-verified wait times at doctor's offices before you leave home.
            </p>
            <p className="mb-6 text-sm font-medium text-cyan-300/80 italic">
              Right data. Right spot. Right time.
            </p>
            <ul className="mb-8 space-y-3 text-sm text-white/80">
              {[
                "Verified by real patients physically at the clinic",
                "No fake or dummy listings",
                "Anonymous & privacy-first reporting",
                "Designed to actually save you hours",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <GlowButton>Get the App – Coming Soon</GlowButton>
              <GlowButton variant="secondary">Notify Me at Launch</GlowButton>
            </div>
          </Section>

          {/* right - phone mockup */}
          <Section delay={200} className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </Section>
        </div>

        {/* scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-5 w-5 text-white/30" />
        </div>
      </section>

      {/* ── SECTION 2 – THE PROBLEM ── */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <Section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">The Problem</p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Doctor Visits Shouldn't{" "}
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">Waste Your Time.</span>
            </h2>
            <p className="mx-auto mb-12 max-w-2xl text-white/60">
              Patients often wait 30–90 minutes with no information. You drive across town, sit in a crowded waiting room, and wonder if you should have just stayed home.
            </p>
          </Section>

          {/* timeline */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* old way */}
            <Section delay={100}>
              <div className="rounded-2xl border border-red-500/10 bg-red-500/5 p-6 text-left">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-red-400">Without the App</p>
                <div className="space-y-3">
                  {[
                    { icon: CalendarCheck, text: "Arrive at scheduled time" },
                    { icon: Timer, text: "Wait 30–90 mins in lobby" },
                    { icon: AlertTriangle, text: "No updates, no info" },
                    { icon: TrendingDown, text: "Wasted time & frustration" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-white/60">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                        <s.icon className="h-4 w-4 text-red-400" />
                      </div>
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>
            </Section>
            {/* new way */}
            <Section delay={200}>
              <div className="rounded-2xl border border-emerald-500/10 bg-emerald-500/5 p-6 text-left">
                <p className="mb-4 text-xs font-bold uppercase tracking-wider text-emerald-400">With See Your Wait Time</p>
                <div className="space-y-3">
                  {[
                    { icon: Search, text: "Check wait times from home" },
                    { icon: Eye, text: "See real-time patient reports" },
                    { icon: Zap, text: "Arrive at the right moment" },
                    { icon: Heart, text: "Save time, reduce stress" },
                  ].map((s, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-white/60">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                        <s.icon className="h-4 w-4 text-emerald-400" />
                      </div>
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* ── SECTION 3 – HOW IT WORKS ── */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/10 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          <Section className="text-center mb-16">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">How It Works</p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Simple.{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Verified. Smart.</span>
            </h2>
          </Section>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Search, step: "01", title: "Search", desc: "Find a doctor or clinic near you." },
              { icon: Eye, step: "02", title: "View Wait Times", desc: "See live updates from real patients at the location." },
              { icon: MapPin, step: "03", title: "Location Verified", desc: "Reports only accepted within 50–100m of the clinic." },
              { icon: Zap, step: "04", title: "Arrive Smart", desc: "Plan your visit based on real conditions." },
            ].map((s, i) => (
              <Section key={i} delay={i * 100}>
                <div className="group relative rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-cyan-500/20 hover:bg-white/[0.04] hover:-translate-y-1">
                  <span className="mb-3 block text-3xl font-black text-white/5 transition-colors group-hover:text-cyan-500/20">
                    {s.step}
                  </span>
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/10">
                    <s.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="mb-1 font-bold">{s.title}</h3>
                  <p className="text-sm text-white/50">{s.desc}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4 – WHY DIFFERENT ── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <Section className="text-center mb-16">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">Why We're Different</p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Not Just Notifications.{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Verified Reality.</span>
            </h2>
          </Section>

          <Section delay={100}>
            <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 sm:px-6 font-medium text-white/40">Feature</th>
                    <th className="px-4 py-3 sm:px-6 font-medium text-white/40">Typical Apps</th>
                    <th className="px-4 py-3 sm:px-6 font-medium text-cyan-400">See Your Wait Time</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Data Source", "Static info", "Real-time updates"],
                    ["Listings", "Dummy listings", "Verified location-based data"],
                    ["Validation", "No validation", "Anti-spam & geofencing"],
                    ["Accuracy", "Data guessing", "Real patient reports"],
                    ["Privacy", "Tracks users", "Anonymous & privacy-first"],
                  ].map(([f, old, us], i) => (
                    <tr key={i} className="border-b border-white/5 transition-colors hover:bg-white/[0.02]">
                      <td className="px-4 py-3 sm:px-6 text-white/70 font-medium">{f}</td>
                      <td className="px-4 py-3 sm:px-6 text-white/30">{old}</td>
                      <td className="px-4 py-3 sm:px-6 text-cyan-300">{us}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      </section>

      {/* ── SECTION 5 – BENEFITS ── */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          <Section className="text-center mb-16">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">Benefits</p>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Built For{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Smarter Visits</span>
            </h2>
          </Section>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: "Save Time", desc: "Know the wait before you go." },
              { icon: Eye, title: "Reduce Uncertainty", desc: "Real data, not guesses." },
              { icon: CalendarCheck, title: "Plan Better", desc: "Choose the best time to visit." },
              { icon: Users, title: "Avoid Crowds", desc: "Skip the packed waiting rooms." },
              { icon: Lock, title: "Privacy-First", desc: "No personal data collected." },
              { icon: Heart, title: "Community Powered", desc: "By patients, for patients." },
            ].map((b, i) => (
              <Section key={i} delay={i * 80}>
                <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all duration-300 hover:border-cyan-500/20 hover:bg-white/[0.04] hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/5">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-600/10 border border-cyan-500/10 transition-colors group-hover:from-cyan-500/20 group-hover:to-blue-600/20">
                    <b.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="mb-1 font-bold">{b.title}</h3>
                  <p className="text-sm text-white/50">{b.desc}</p>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 – PRIVACY ── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <Section>
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/10">
              <ShieldCheck className="h-8 w-8 text-emerald-400" />
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-400">Privacy & Trust</p>
            <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
              Built With{" "}
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">Privacy In Mind.</span>
            </h2>
            <p className="mx-auto mb-10 max-w-xl text-white/60">
              We don't collect names, health conditions, or any personal info. Your privacy is the foundation of the app.
            </p>
          </Section>

          <div className="grid gap-4 sm:grid-cols-2 text-left">
            {[
              { icon: Lock, text: "No PII stored" },
              { icon: Shield, text: "No health condition data collected" },
              { icon: Fingerprint, text: "Anonymous reporting" },
              { icon: Smartphone, text: "Device-based spam prevention" },
              { icon: MapPin, text: "Location only for verification" },
              { icon: Globe, text: "Transparent & open about data use" },
            ].map((p, i) => (
              <Section key={i} delay={i * 60}>
                <div className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-colors hover:border-emerald-500/10">
                  <p.icon className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="text-sm text-white/70">{p.text}</span>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 7 – CTA ── */}
      <section className="relative py-24 sm:py-32">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-600/10 blur-[150px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <Section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">Coming Soon</p>
            <h2 className="mb-4 text-3xl font-bold sm:text-5xl">
              Launching Soon on{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Google Play</span>
            </h2>
            <p className="mb-8 text-lg text-white/60">Be the first to save hours.</p>
            <GlowButton className="mx-auto">Get the App – Coming Soon</GlowButton>
          </Section>
        </div>
      </section>

      {/* ── SECTION 8 – FAQ ── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <Section className="text-center mb-12">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-cyan-400">FAQ</p>
            <h2 className="text-3xl font-bold sm:text-4xl">Frequently Asked Questions</h2>
          </Section>

          <Section delay={100}>
            <Accordion type="single" collapsible className="space-y-2">
              {[
                {
                  q: "How do you verify wait times?",
                  a: "Users can only submit wait time reports when physically present at a clinic, verified through GPS geofencing within 50–100 meters. Combined with device-based rate limiting, this ensures authentic reports.",
                },
                {
                  q: "Is my location tracked?",
                  a: "No. Your location is only checked momentarily to verify you're at the clinic. We don't store location history or track your movements.",
                },
                {
                  q: "Do I need to create an account?",
                  a: "No. You can browse wait times without any account. Reporting wait times is anonymous and doesn't require personal information.",
                },
                {
                  q: "Is my medical information stored?",
                  a: "Absolutely not. We don't collect, store, or process any medical or health-related information. The app only deals with wait times.",
                },
                {
                  q: "What if someone submits fake data?",
                  a: "Our system uses GPS geofencing to ensure reporters are physically at the clinic, plus device-based rate limiting to prevent spam. Anomalous reports are automatically flagged.",
                },
                {
                  q: "When is the app launching?",
                  a: "We're launching soon on Google Play Store. Join our notification list to be the first to know!",
                },
                {
                  q: "Is this available nationwide?",
                  a: "We're starting with Miami, FL and expanding to more cities based on demand. Stay tuned for updates!",
                },
              ].map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="rounded-xl border border-white/5 bg-white/[0.02] px-4 transition-colors hover:border-white/10 data-[state=open]:border-cyan-500/20"
                >
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline text-white/90">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-white/50">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Section>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                <Clock className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold">See Your Wait Time</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-white/40">
              <a href="#" className="transition-colors hover:text-white/70">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-white/70">Terms of Service</a>
              <a href="mailto:contact@seeyourwait.com" className="transition-colors hover:text-white/70">Contact</a>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-white/20">
            Made for smarter healthcare visits. © {new Date().getFullYear()} See Your Wait Time.
          </p>
        </div>
      </footer>

      {/* ── GLOBAL ANIMATION KEYFRAMES ── */}
      <style>{`
        @keyframes float-slow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes float-delayed {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 5s ease-in-out infinite 1s; }
        .animate-float { animation: float 3.5s ease-in-out infinite 0.5s; }
      `}</style>
    </div>
  );
}
