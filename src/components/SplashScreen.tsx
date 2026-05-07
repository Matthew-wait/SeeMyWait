import { useState, useEffect } from "react";
import { Stethoscope, MapPin } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
  duration?: number;
}

export function SplashScreen({ onComplete, duration = 2500 }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const enterTimer = setTimeout(() => setPhase("hold"), 400);
    const exitTimer = setTimeout(() => setPhase("exit"), duration - 500);
    const completeTimer = setTimeout(onComplete, duration);
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, duration]);

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${
        phase === "exit" ? "opacity-0" : "opacity-100"
      }`}
      style={{
        background: "linear-gradient(135deg, hsl(222 47% 11%), hsl(250 40% 16%), hsl(222 47% 11%))",
      }}
    >
      {/* Animated background pulse rings */}
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute rounded-full border border-primary/10"
            style={{
              width: `${200 + i * 140}px`,
              height: `${200 + i * 140}px`,
              animation: `splash-pulse 3s ease-in-out ${i * 0.6}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Floating map pin ripple */}
      <div className="absolute bottom-1/4 right-1/4 opacity-20">
        <div className="relative">
          <MapPin className="h-6 w-6 text-primary" style={{ animation: "splash-float 4s ease-in-out infinite" }} />
          <div
            className="absolute -inset-3 rounded-full border border-primary/30"
            style={{ animation: "splash-ripple 2s ease-out infinite" }}
          />
        </div>
      </div>

      {/* Logo & Content */}
      <div
        className={`relative z-10 flex flex-col items-center gap-5 transition-all duration-700 ${
          phase === "enter" ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
        }`}
      >
        {/* App icon */}
        <div className="relative">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-2xl"
            style={{
              background: "linear-gradient(135deg, hsl(198 93% 59%), hsl(200 98% 39%))",
              boxShadow: "0 0 60px hsl(198 93% 59% / 0.3)",
            }}
          >
            <Stethoscope className="h-10 w-10" style={{ color: "hsl(222 47% 11%)" }} />
          </div>
          <div
            className="absolute -inset-2 rounded-3xl"
            style={{
              background: "linear-gradient(135deg, hsl(198 93% 59% / 0.2), transparent)",
              animation: "splash-glow 2s ease-in-out infinite alternate",
            }}
          />
        </div>

        {/* App name */}
        <h1
          className="text-2xl font-bold tracking-tight sm:text-3xl"
          style={{ color: "hsl(210 40% 98%)" }}
        >
          SeeMyWait
        </h1>

        {/* Tagline */}
        <p
          className="text-sm font-medium tracking-wide sm:text-base"
          style={{ color: "hsl(198 93% 59%)" }}
        >
          Right Data. Right Spot. Right Time.
        </p>

        {/* Subtext */}
        <p
          className="max-w-xs text-center text-xs sm:text-sm"
          style={{ color: "hsl(215 20% 65%)" }}
        >
          Real-time wait times. Verified at the doctor office.
        </p>

        {/* Loading indicator */}
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: "hsl(198 93% 59%)",
                animation: `splash-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.1; }
        }
        @keyframes splash-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes splash-ripple {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes splash-glow {
          0% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
        @keyframes splash-dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
