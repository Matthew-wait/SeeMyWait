import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { Menu, X as XIcon } from "lucide-react";
import {
  MapPin,
  Clock,
  Shield,
  Search,
  CheckCircle,
  Eye,
  Zap,
  Users,
  Lock,
  ArrowRight,
  ChevronDown,
  Smartphone,
  Timer,
  AlertTriangle,
  TrendingDown,
  Fingerprint,
  Globe,
  Heart,
  CalendarCheck,
  ShieldCheck,
  Activity,
  Mail,
  Send,
  Twitter,
  Instagram,
  Linkedin,
  Github,
  Bell,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

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
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
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
  onClick,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
  onClick?: () => void;
}) {
  if (variant === "secondary") {
    return (
      <button
        onClick={onClick}
        className={`group relative inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-xs sm:text-sm sm:px-6 sm:py-3 font-medium text-white/90 backdrop-blur-sm transition-all duration-300 hover:border-white/40 hover:bg-white/10 hover:scale-105 ${className}`}
      >
        {children}
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm sm:px-8 sm:py-4 sm:text-base font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all duration-300 hover:shadow-cyan-500/40 hover:shadow-xl hover:scale-105 active:scale-[0.98] ${className}`}
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
    <div className="relative mx-auto w-[240px] sm:w-[260px] md:w-[280px]">
      {/* floating labels - hidden on small screens to prevent overflow */}
      <div className="hidden sm:block absolute -left-20 top-16 animate-float-slow z-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 backdrop-blur-md">
          <CheckCircle className="h-3 w-3" /> Location Verified
        </span>
      </div>
      <div className="hidden sm:block absolute -right-16 top-36 animate-float-delayed z-20">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/20 border border-blue-500/30 px-3 py-1.5 text-xs font-medium text-blue-300 backdrop-blur-md">
          <Radio className="h-3 w-3" /> Live Updates
        </span>
      </div>
      <div className="hidden sm:block absolute -left-12 bottom-28 animate-float z-20">
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
            <p className="text-xs font-semibold text-white">SeeMyWait</p>
            <p className="text-[9px] text-white/70">Live Wait Times</p>
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
                <span
                  className={`relative flex items-center gap-1 rounded-full ${c.color}/20 px-2 py-0.5 text-[10px] font-semibold text-white`}
                >
                  {c.pulse && <span className={`absolute inset-0 rounded-full ${c.color}/30 animate-ping`} />}
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
                  <span
                    key={t}
                    className="rounded-lg bg-cyan-500/20 border border-cyan-500/20 px-2 py-1 text-[9px] font-medium text-cyan-300"
                  >
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

/* ──────────────────── Store Buttons ──────────────────── */

function StoreButtons() {
  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      <button
        onClick={() => toast.info("Coming soon to Google Play! 🚀")}
        className="group flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:px-5 sm:py-3 backdrop-blur-sm transition-all duration-300 hover:border-white/25 hover:bg-white/10 hover:scale-105 active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7 text-white" fill="currentColor">
          <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302-2.302 2.302-2.816-2.302 2.816-2.302zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
        </svg>
        <div className="text-left">
          <p className="text-[8px] sm:text-[9px] uppercase tracking-wider text-white/50 leading-none">Get it on</p>
          <p className="text-xs sm:text-sm font-semibold text-white leading-tight">Google Play</p>
        </div>
      </button>
      <button
        onClick={() => toast.info("Coming soon to the App Store! 🍎")}
        className="group flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 px-3 py-2 sm:px-5 sm:py-3 backdrop-blur-sm transition-all duration-300 hover:border-white/25 hover:bg-white/10 hover:scale-105 active:scale-[0.98]"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5 sm:h-7 sm:w-7 text-white" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        <div className="text-left">
          <p className="text-[8px] sm:text-[9px] uppercase tracking-wider text-white/50 leading-none">Download on the</p>
          <p className="text-xs sm:text-sm font-semibold text-white leading-tight">App Store</p>
        </div>
      </button>
    </div>
  );
}

const NAV_LINKS = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Benefits", href: "#benefits" },
  { label: "FAQs", href: "#faqs" },
  { label: "Contact Us", href: "#contact" },
];

function NavHeader({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleNavClick = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className={`fixed top-0 z-50 w-full transition-all duration-500 ${
        scrolled
          ? "border-b border-white/10 bg-[#0a0e1a]/90 backdrop-blur-2xl shadow-lg shadow-black/20"
          : "border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-xl"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/20">
            <Clock className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight">SeeMyWait</span>
        </div>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="relative px-4 py-2 text-sm font-medium text-white/60 transition-colors duration-300 hover:text-white group"
            >
              {link.label}
              <span className="absolute bottom-0 left-1/2 h-[2px] w-0 -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300 group-hover:w-2/3" />
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <GlowButton variant="secondary" className="text-xs px-4 py-2 hidden sm:inline-flex" onClick={() => navigate("/app")}>
            Get Started
          </GlowButton>
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition-all duration-300 hover:bg-white/10 hover:text-white"
          >
            {mobileOpen ? <XIcon className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-400 ease-out ${
          mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-white/5 bg-[#0a0e1a]/95 backdrop-blur-2xl px-4 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.href}
              onClick={() => handleNavClick(link.href)}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/60 transition-all duration-300 hover:bg-white/5 hover:text-white"
            >
              {link.label}
            </button>
          ))}
          <div className="pt-2">
            <button
              onClick={() => { setMobileOpen(false); navigate("/app"); }}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25"
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

/* ──────────────────── LANDING PAGE ──────────────────── */

export default function LandingPage() {
  const navigate = useNavigate();
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Thanks for reaching out! We'll get back to you soon.");
    setContactName("");
    setContactEmail("");
    setContactMessage("");
  };

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white overflow-x-hidden">
      {/* ── NAV ── */}
      <NavHeader navigate={navigate} />

      {/* ── HERO ── */}
      <section className="relative min-h-screen pt-16 sm:pt-20 flex items-center">
        {/* bg effects */}
        <div className="absolute inset-0">
          <div className="absolute left-1/4 top-1/4 h-[300px] w-[300px] sm:h-[500px] sm:w-[500px] rounded-full bg-cyan-600/10 blur-[120px]" />
          <div className="absolute right-1/4 bottom-1/4 h-[250px] w-[250px] sm:h-[400px] sm:w-[400px] rounded-full bg-blue-600/10 blur-[120px]" />
          <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] sm:h-[300px] sm:w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-600/5 blur-[100px]" />
        </div>

        <div className="relative z-10 mx-auto grid max-w-6xl gap-6 sm:gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:items-center py-6 sm:py-0">
          {/* left */}
          <Section className="text-center lg:text-left">
            <p className="mb-3 sm:mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium text-cyan-300">
              <Activity className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">Real-Time Wait Updates • Launching Soon</span>
              <span className="sm:hidden">Live Wait Updates • Soon</span>
            </p>
            <h1 className="mb-3 sm:mb-6 text-2xl font-extrabold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
              Stop Waiting.{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Start Saving Time.
              </span>
            </h1>
            <p className="mb-2 mx-auto lg:mx-0 max-w-lg text-sm sm:text-base md:text-lg text-white/70">
              See real-time, location-verified wait times at doctor's offices before you leave home.
            </p>
            <p className="mb-3 sm:mb-6 text-xs sm:text-sm font-medium text-cyan-300/80 italic">Right data. Right spot. Right time.</p>
            <ul className="mb-4 sm:mb-8 space-y-1.5 sm:space-y-3 text-xs sm:text-sm text-white/80 text-left mx-auto lg:mx-0 max-w-sm lg:max-w-none">
              {[
                "Verified by real patients physically at the clinic",
                "Live updates that refresh every few minutes",
                "Anonymous & privacy-first reporting",
                "Designed to actually save you hours",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex justify-center lg:justify-start">
              <StoreButtons />
            </div>
          </Section>

          {/* right - phone mockup */}
          <Section delay={200} className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </Section>
        </div>

        {/* scroll hint */}
        <div className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-5 w-5 text-white/30" />
        </div>
      </section>

      {/* ── SECTION 2 – THE PROBLEM ── */}
      <section className="relative py-16 sm:py-24 md:py-32">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
          <Section>
            <p className="mb-3 text-l font-semibold uppercase tracking-widest text-cyan-400">The Problem</p>
            <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl">
              Doctor Visits Shouldn't{" "}
              <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
                Waste Your Time.
              </span>
            </h2>
            <p className="mx-auto mb-8 sm:mb-12 max-w-2xl text-sm sm:text-base text-white/60">
              Patients often wait 30–90 minutes with no information. You drive across town, sit in a crowded waiting
              room, and wonder if you should have just stayed home.
            </p>
          </Section>

          {/* timeline */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* old way */}
            <Section delay={100}>
              <div className="rounded-2xl border border-red-500/10 bg-red-500/5 p-6 text-left">
                <p className="mb-4 text-sm font-bold uppercase tracking-wider text-red-400">Without the App</p>
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
                <p className="mb-4 text-sm font-bold uppercase tracking-wider text-emerald-400">With SeeMyWait</p>
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
      <section id="how-it-works" className="relative py-16 sm:py-28 md:py-36 overflow-hidden scroll-mt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/10 to-transparent" />
        <div className="absolute right-0 top-20 h-[300px] w-[300px] rounded-full bg-blue-600/5 blur-[100px]" />
        <div className="absolute left-0 bottom-20 h-[200px] w-[200px] rounded-full bg-cyan-600/5 blur-[80px]" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Section className="text-center mb-10 sm:mb-20">
            <p className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-widest text-cyan-400">How It Works</p>
            <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
              Four Steps to{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Smarter Visits
              </span>
            </h2>
          </Section>

          {/* Vertical timeline layout */}
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/40 via-blue-500/20 to-transparent hidden lg:block" />
            <div className="space-y-16 lg:space-y-20">
              {[
                {
                  icon: Search,
                  step: "01",
                  title: "Search",
                  desc: "Find a doctor or clinic near you using our smart search.",
                  visual: "search",
                },
                {
                  icon: Eye,
                  step: "02",
                  title: "View Verified Wait Times",
                  desc: "See live updates submitted by real patients physically at the location.",
                  visual: "eye",
                },
                {
                  icon: MapPin,
                  step: "03",
                  title: "Location-Verified Reporting",
                  desc: "Reports are only accepted within 50–100 meters. No fake data passes through.",
                  visual: "map",
                },
                {
                  icon: Zap,
                  step: "04",
                  title: "Arrive Smart",
                  desc: "Plan your visit based on real conditions and save hours of wasted time.",
                  visual: "zap",
                },
              ].map((s, i) => (
                <Section key={i} delay={i * 120}>
                  <div
                    className={`flex flex-col lg:flex-row items-start gap-6 lg:gap-12 ${i % 2 === 1 ? "lg:flex-row-reverse" : ""}`}
                  >
                    <div className="flex items-center gap-4 lg:min-w-[200px]">
                      <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 backdrop-blur-sm">
                        <s.icon className="h-7 w-7 text-cyan-400" />
                        <div className="absolute inset-0 rounded-2xl bg-cyan-500/10 blur-xl" />
                      </div>
                      <span className="text-3xl sm:text-5xl font-black bg-gradient-to-b from-white/10 to-transparent bg-clip-text text-transparent">
                        {s.step}
                      </span>
                    </div>
                    <div className="group relative flex-1 rounded-2xl sm:rounded-3xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 sm:p-8 backdrop-blur-sm transition-all duration-500 hover:border-cyan-500/20 hover:shadow-2xl hover:shadow-cyan-500/5">
                      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                      <div className="relative">
                        <h3 className="mb-1 sm:mb-2 text-base sm:text-xl font-bold">{s.title}</h3>
                        <p className="text-xs sm:text-base text-white/50 leading-relaxed max-w-md">{s.desc}</p>
                      </div>
                      <div className="absolute top-0 right-0 h-20 w-20 rounded-tr-3xl bg-gradient-to-bl from-cyan-500/5 to-transparent" />
                    </div>
                  </div>
                </Section>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 4 – WHY DIFFERENT ── */}
      <section className="relative py-16 sm:py-28 md:py-36">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <Section className="text-center mb-10 sm:mb-20">
            <p className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-widest text-cyan-400">Why We're Different</p>
            <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
              Not Just Notifications.{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Verified Reality.
              </span>
            </h2>
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section delay={100}>
              <div className="relative h-full rounded-2xl sm:rounded-3xl border border-red-500/10 bg-gradient-to-b from-red-500/[0.04] to-transparent p-5 sm:p-8 overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 rounded-bl-full bg-red-500/5" />
                <p className="mb-6 text-sm font-bold uppercase tracking-wider text-red-400/80">Typical Apps</p>
                <div className="space-y-5">
                  {[
                    { label: "Static info", detail: "Outdated data from months ago" },
                    { label: "Dummy listings", detail: "Unverified placeholder entries" },
                    { label: "No validation", detail: "Anyone can post anything" },
                    { label: "Data guessing", detail: "Estimated, never real" },
                    { label: "Tracks users", detail: "Sells data to third parties" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-start gap-3 group">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500/40" />
                      <div>
                        <p className="text-sm font-medium text-white/50">{row.label}</p>
                        <p className="text-xs text-white/25">{row.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>

            <Section delay={200}>
              <div className="relative h-full rounded-2xl sm:rounded-3xl border border-cyan-500/15 bg-gradient-to-b from-cyan-500/[0.06] to-transparent p-5 sm:p-8 overflow-hidden">
                <div className="absolute top-0 right-0 h-32 w-32 rounded-bl-full bg-cyan-500/5" />
                <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-[60px]" />
                <p className="mb-6 text-sm font-bold uppercase tracking-wider text-cyan-400">SeeMyWait</p>
                <div className="space-y-5">
                  {[
                    { label: "Real-time updates", detail: "Live data from patients right now" },
                    { label: "Verified location data", detail: "GPS-confirmed within 50-100m" },
                    { label: "Anti-spam & geofencing", detail: "Device + location verification" },
                    { label: "Real patient reports", detail: "From people actually in the clinic" },
                    { label: "Anonymous & private", detail: "Zero personal data collected" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-start gap-3 group">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
                      <div>
                        <p className="text-sm font-medium text-white/80">{row.label}</p>
                        <p className="text-xs text-white/40">{row.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* ── SECTION 5 – BENEFITS ── */}
      <section id="benefits" className="relative py-16 sm:py-28 md:py-36 overflow-hidden scroll-mt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent" />
        <div className="absolute left-1/4 top-0 h-[600px] w-[600px] rounded-full bg-cyan-600/[0.04] blur-[150px]" />
        <div className="absolute right-1/4 bottom-0 h-[400px] w-[400px] rounded-full bg-purple-600/[0.04] blur-[120px]" />

        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Section className="text-center mb-10 sm:mb-20">
            <p className="mb-3 text-xs sm:text-sm font-semibold uppercase tracking-widest text-cyan-400">Benefits</p>
            <h2 className="text-2xl font-bold sm:text-3xl md:text-4xl">
              Built For{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Smarter Visits
              </span>
            </h2>
            <p className="mt-4 text-white/40 max-w-lg mx-auto">
              Everything you need to take control of your time and never sit in a waiting room longer than you have to.
            </p>
          </Section>

          {/* Hero stat banner */}
          <Section delay={50} className="mb-8">
            <div className="relative rounded-2xl sm:rounded-3xl border border-cyan-500/10 bg-gradient-to-r from-cyan-500/[0.06] via-blue-600/[0.04] to-purple-500/[0.06] p-5 sm:p-8 md:p-10 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(6,182,212,0.08)_0%,_transparent_50%)]" />
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-[80px]" />
              <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-10">
                <div className="flex items-center gap-5">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-cyan-500/20 blur-md" />
                    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-500/20">
                      <Clock className="h-8 w-8 text-cyan-400" />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-300 to-blue-400 bg-clip-text text-transparent">
                        45
                      </span>
                      <span className="text-lg text-white/50 font-medium">min</span>
                    </div>
                    <p className="text-sm text-white/40 mt-0.5">Average time saved per visit</p>
                  </div>
                </div>
                <div className="hidden sm:block h-14 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-1">Save Real Hours</h3>
                  <p className="text-white/45 text-sm leading-relaxed max-w-md">
                    Stop wasting hours in crowded waiting rooms. Know exactly what to expect before you leave home, and
                    arrive when it's your turn.
                  </p>
                </div>
              </div>
            </div>
          </Section>

          {/* Feature row */}
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                icon: Eye,
                title: "Reduce Uncertainty",
                desc: "Real data replaces guesswork. See actual wait times from patients already there.",
                color: "purple",
                span: "lg:col-span-3",
              },
              {
                icon: CalendarCheck,
                title: "Plan Better",
                desc: "Choose the best time to visit based on real-time conditions and patterns.",
                color: "blue",
                span: "lg:col-span-2",
              },
              {
                icon: Users,
                title: "Avoid Crowds",
                desc: "See which clinics are packed and which have shorter waits right now.",
                color: "amber",
                span: "lg:col-span-2",
              },
              {
                icon: Heart,
                title: "Community Powered",
                desc: "Built by patients, for patients. Every report helps the entire community save time.",
                color: "rose",
                span: "lg:col-span-3",
              },
            ].map((b, i) => {
              const colors: Record<string, { accent: string; glow: string; border: string; bg: string }> = {
                purple: {
                  accent: "text-purple-400",
                  glow: "bg-purple-500/10",
                  border: "hover:border-purple-500/20",
                  bg: "from-purple-500/[0.07] to-purple-600/[0.02]",
                },
                blue: {
                  accent: "text-blue-400",
                  glow: "bg-blue-500/10",
                  border: "hover:border-blue-500/20",
                  bg: "from-blue-500/[0.07] to-indigo-600/[0.02]",
                },
                amber: {
                  accent: "text-amber-400",
                  glow: "bg-amber-500/10",
                  border: "hover:border-amber-500/20",
                  bg: "from-amber-500/[0.07] to-orange-600/[0.02]",
                },
                rose: {
                  accent: "text-rose-400",
                  glow: "bg-rose-500/10",
                  border: "hover:border-rose-500/20",
                  bg: "from-rose-500/[0.07] to-pink-600/[0.02]",
                },
              };
              const c = colors[b.color];
              return (
                <Section key={i} delay={80 + i * 60} className={b.span}>
                  <div
                    className={`group relative h-full rounded-2xl sm:rounded-3xl border border-white/[0.06] bg-gradient-to-br ${c.bg} p-4 sm:p-7 transition-all duration-500 ${c.border} hover:shadow-lg hover:-translate-y-1`}
                  >
                    <div
                      className={`absolute -top-6 -right-6 h-24 w-24 rounded-full ${c.glow} blur-[40px] opacity-0 transition-opacity duration-500 group-hover:opacity-100`}
                    />
                    <div className="relative flex items-start gap-3 sm:gap-5">
                      <div
                        className={`shrink-0 flex h-12 w-12 items-center justify-center rounded-2xl ${c.glow} border border-white/[0.06]`}
                      >
                        <b.icon className={`h-6 w-6 ${c.accent}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-lg mb-1">{b.title}</h3>
                        <p className="text-sm text-white/45 leading-relaxed">{b.desc}</p>
                      </div>
                    </div>
                  </div>
                </Section>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── SECTION 6 – PRIVACY ── */}
      <section className="relative py-16 sm:py-28 md:py-36 overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="relative rounded-2xl sm:rounded-[2.5rem] border border-emerald-500/10 bg-gradient-to-br from-emerald-500/[0.04] to-cyan-500/[0.02] p-5 sm:p-10 md:p-16 overflow-hidden">
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-emerald-500/10 blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-cyan-500/10 blur-[80px]" />
            <div className="absolute top-0 left-0 h-full w-px bg-gradient-to-b from-emerald-500/20 via-transparent to-transparent" />

            <div className="relative grid gap-12 lg:grid-cols-2 lg:items-center">
              <Section>
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/15 mb-6">
                  <ShieldCheck className="h-7 w-7 text-emerald-400" />
                </div>
                <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-emerald-400">Privacy & Trust</p>
                <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
                  Built With{" "}
                  <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                    Privacy In Mind.
                  </span>
                </h2>
                <p className="text-white/50 leading-relaxed max-w-md">
                  We don't collect names, health conditions, or any personal info. Your privacy is the foundation — not
                  an afterthought.
                </p>
              </Section>

              <Section delay={150}>
                <div className="space-y-3">
                  {[
                    { icon: Lock, text: "No personally identifiable information stored", accent: "emerald" },
                    { icon: Shield, text: "Zero health condition data collected", accent: "emerald" },
                    { icon: Fingerprint, text: "Fully anonymous reporting system", accent: "cyan" },
                    { icon: Smartphone, text: "Device-based spam prevention only", accent: "cyan" },
                    { icon: MapPin, text: "Location used for verification only", accent: "teal" },
                    { icon: Globe, text: "Transparent about every data practice", accent: "teal" },
                  ].map((p, i) => (
                    <div
                      key={i}
                      className="group flex items-center gap-4 rounded-2xl border border-white/[0.04] bg-white/[0.02] px-5 py-4 transition-all duration-300 hover:border-emerald-500/15 hover:bg-white/[0.04]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/10">
                        <p.icon className="h-4 w-4 text-emerald-400" />
                      </div>
                      <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                        {p.text}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECTION 7 – CTA ── */}
      <section className="relative py-32 sm:py-40 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-cyan-600/15 to-blue-600/15 blur-[150px]" />
        </div>
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6 text-center">
          <Section>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-1.5 text-sm font-large text-cyan-300">
              <Smartphone className="h-3.5 w-3.5" />
              Coming Soon to Google Play & App Store
            </div>
            <h2 className="mb-6 text-4xl font-extrabold sm:text-5xl leading-[1.1]">
              Ready to Stop{" "}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                Wasting Time?
              </span>
            </h2>
            <p className="mb-10 text-lg text-white/50 max-w-lg mx-auto">
              Be among the first to experience smarter healthcare visits. No more guessing. No more waiting blind.
            </p>
            <div className="flex flex-col items-center gap-6">
              <StoreButtons />
              <GlowButton variant="secondary" onClick={() => toast.info("We'll notify you at launch! 🔔")}>
                <Bell className="h-4 w-4 mr-1" />
                Notify Me at Launch
              </GlowButton>
            </div>
          </Section>
        </div>
      </section>

      {/* ── SECTION 8 – FAQ ── */}
      <section id="faqs" className="py-28 sm:py-36 scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.5fr] lg:items-start">
            <Section>
              <div className="lg:sticky lg:top-28">
                <p className="mb-3 text-l font-semibold uppercase tracking-widest text-cyan-400">FAQ</p>
                <h2 className="text-3xl font-bold sm:text-4xl mb-4">
                  Got{" "}
                  <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                    Questions?
                  </span>
                </h2>
                <p className="text-white/40 leading-relaxed">
                  Everything you need to know about how we protect your data and verify wait times.
                </p>
              </div>
            </Section>

            <Section delay={100}>
              <Accordion type="single" collapsible className="space-y-3">
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
                    q: "How long do wait time reports last?",
                    a: "Wait time reports automatically expire after 3 hours to ensure you always see the most current information.",
                  },
                  {
                    q: "What if someone submits fake data?",
                    a: "Our system uses GPS geofencing to ensure reporters are physically at the clinic, plus device-based rate limiting to prevent spam. Anomalous reports are automatically flagged.",
                  },
                  {
                    q: "When is the app launching?",
                    a: "We're launching soon on Google Play Store and App Store. Join our notification list to be the first to know!",
                  },
                ].map((faq, i) => (
                  <AccordionItem
                    key={i}
                    value={`faq-${i}`}
                    className="rounded-2xl border border-white/[0.06] bg-white/[0.02] px-6 transition-all duration-300 hover:border-white/10 data-[state=open]:border-cyan-500/15 data-[state=open]:bg-cyan-500/[0.03]"
                  >
                    <AccordionTrigger className="text-left text-[15px] font-medium hover:no-underline text-white/90 py-5">
                      {faq.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-white/50 leading-relaxed pb-5">{faq.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Section>
          </div>
        </div>
      </section>

      {/* ── SECTION 9 – GET IN TOUCH ── */}
      <section id="contact" className="relative py-28 sm:py-36 overflow-hidden scroll-mt-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-950/10 to-transparent" />
        <div className="absolute right-0 top-0 h-[400px] w-[400px] rounded-full bg-blue-600/5 blur-[120px]" />
        <div className="absolute left-0 bottom-0 h-[300px] w-[300px] rounded-full bg-cyan-600/5 blur-[100px]" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
          <Section className="text-center mb-16">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-cyan-400">Contact Us</p>
            <h2 className="text-3xl font-bold sm:text-4xl mb-4">
              Get In{" "}
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Touch</span>
            </h2>
            <p className="text-white/40 max-w-lg mx-auto">
              Have questions, feedback, or partnership ideas? We'd love to hear from you.
            </p>
          </Section>

          <Section delay={100}>
            <div className="relative rounded-3xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-8 sm:p-10 backdrop-blur-sm overflow-hidden">
              <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-cyan-500/10 blur-[80px]" />
              <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-blue-500/10 blur-[60px]" />

              <div className="relative grid gap-8 lg:grid-cols-[1fr_1.2fr]">
                {/* Info side */}
                <div className="space-y-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20">
                    <Mail className="h-7 w-7 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Let's Connect</h3>
                    <p className="text-white/50 text-sm leading-relaxed">
                      Whether you're a clinic looking to partner, a patient with feedback, or just curious — drop us a
                      message.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <a
                      href="mailto:contact@seemywait.com"
                      className="flex items-center gap-3 text-sm text-white/60 hover:text-cyan-400 transition-colors"
                    >
                      <Mail className="h-4 w-4" />
                      contact@seemywait.com
                    </a>
                  </div>
                  <div className="flex gap-3 pt-2">
                    {[
                      { icon: Twitter, label: "Twitter" },
                      { icon: Instagram, label: "Instagram" },
                      { icon: Linkedin, label: "LinkedIn" },
                    ].map((social) => (
                      <button
                        key={social.label}
                        onClick={() => toast.info(`Follow us on ${social.label} — coming soon!`)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/50 transition-all hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-cyan-500/10"
                      >
                        <social.icon className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form side */}
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60">Name</label>
                    <Input
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Your name"
                      className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-cyan-500/30 h-11"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60">Email</label>
                    <Input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-cyan-500/30 h-11"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-white/60">Message</label>
                    <Textarea
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      placeholder="How can we help?"
                      rows={4}
                      className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-white/30 focus-visible:ring-cyan-500/30 resize-none"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="group w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all duration-300 hover:shadow-cyan-500/40 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    Send Message
                  </button>
                </form>
              </div>
            </div>
          </Section>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-bold">SeeMyWait</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed max-w-xs">
                Real-time, location-verified wait times at doctor's offices. Built for smarter healthcare visits.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-4">Quick Links</h4>
              <div className="space-y-2.5">
                <a href="#" className="block text-sm text-white/40 hover:text-white/70 transition-colors">
                  How It Works
                </a>
                <button onClick={() => navigate("/privacy")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">
                  Privacy Policy
                </button>
                <button onClick={() => navigate("/terms")} className="block text-sm text-white/40 hover:text-white/70 transition-colors">
                  Terms of Service
                </button>
                <button
                  onClick={() => navigate("/app")}
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Try the App
                </button>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-4">Contact</h4>
              <div className="space-y-2.5">
                <a
                  href="mailto:contact@seemywait.com"
                  className="block text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  contact@seemywait.com
                </a>
                <p className="text-sm text-white/30">Miami, FL</p>
              </div>
            </div>

            {/* Social */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-4">Follow Us</h4>
              <div className="flex gap-3">
                {[
                  { icon: Twitter, label: "Twitter" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Linkedin, label: "LinkedIn" },
                  { icon: Github, label: "GitHub" },
                ].map((social) => (
                  <button
                    key={social.label}
                    onClick={() => toast.info(`Follow us on ${social.label} — coming soon!`)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 transition-all hover:border-cyan-500/30 hover:text-cyan-400 hover:bg-cyan-500/10"
                  >
                    <social.icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/20">© {new Date().getFullYear()} SeeMyWait. All rights reserved.</p>
            <p className="text-xs text-white/20">Made with ❤️ for smarter healthcare visits</p>
          </div>
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
