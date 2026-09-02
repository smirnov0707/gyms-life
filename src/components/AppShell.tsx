import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Dumbbell,
  Apple,
  ShieldCheck,
  Activity,
  TrendingUp,
  Sparkles,
  Zap,
  Globe,
} from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function headerName(name?: string | null): string {
  return name || "GYMS.LIFE";
}

export const Logo: React.FC<{ className?: string; href?: string }> = ({
  className = "",
  href = "/app",
}) => (
  <Link to={href} className={`flex items-center gap-2.5 group ${className}`}>
    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-black text-black text-sm tracking-tighter shadow-lg shadow-emerald-950/40 group-hover:scale-105 transition-transform">
      G
    </div>
    <div className="flex flex-col text-left">
      <span className="text-base font-black tracking-wider uppercase text-white font-mono leading-none">
        GYMS<span className="text-emerald-400">.LIFE</span>
      </span>
      <span className="text-[9px] font-mono tracking-widest text-neutral-500 uppercase">
        ATHLETIC INTELLIGENCE
      </span>
    </div>
  </Link>
);

export const LangSwitch: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { lang, setLang } = useI18n();
  const languages = [
    { code: "lt", label: "LT" },
    { code: "en", label: "EN" },
  ] satisfies ReadonlyArray<{ code: Lang; label: string }>;

  return (
    <div
      className={`flex items-center gap-1 bg-white/[0.04] p-1 rounded-xl border border-white/[0.08] ${className}`}
    >
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg transition-all ${
            lang === l.code
              ? "bg-emerald-500 text-black shadow-sm font-black"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useI18n();
  const location = useLocation();

  const navItems = [
    { to: "/app", icon: Activity, label: lang === "lt" ? "Skydelis" : "Dashboard" },
    { to: "/workout/1", icon: Dumbbell, label: lang === "lt" ? "Treniruotė" : "Workout" },
    { to: "/exercises", icon: Sparkles, label: lang === "lt" ? "Biblioteka" : "Exercises" },
    { to: "/nutrition", icon: Apple, label: lang === "lt" ? "Mityba" : "Nutrition" },
    { to: "/form", icon: ShieldCheck, label: lang === "lt" ? "Forma & AR" : "Technique" },
    { to: "/progress", icon: TrendingUp, label: lang === "lt" ? "Progresas" : "Progress" },
  ];

  return (
    <div className="min-h-screen bg-[#030303] text-[#f4f4f5] flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Viršutinis statuso baras */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#030303]/85 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />

          {/* Desktop navigacija */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = location.pathname.startsWith(item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all ${
                    isActive
                      ? "bg-white/[0.08] text-white border border-white/10 shadow-inner"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400" : "text-neutral-400"}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2.5">
            <LangSwitch />
            <div className="badge-telemetry text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hidden sm:inline-flex">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>AI READY</span>
            </div>
          </div>
        </div>
      </header>

      {/* Pagrindinis turinys */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 pb-28 md:pb-12">
        {children}
      </main>

      {/* Mobilus plaukiojantis apatinis dokas */}
      <nav className="md:hidden fixed bottom-4 inset-x-4 z-50">
        <div className="glass-panel rounded-2xl p-1.5 flex items-center justify-around shadow-2xl border border-white/15 bg-black/85 backdrop-blur-2xl">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-white/10 text-white border border-white/10"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-emerald-400 scale-110" : ""}`} />
                <span className="text-[9px] font-bold uppercase tracking-tight mt-1">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
