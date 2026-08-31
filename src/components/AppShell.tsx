import React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  Apple,
  ArrowUpRight,
  Bell,
  Bot,
  ChevronRight,
  Dumbbell,
  Flame,
  Gauge,
  LayoutDashboard,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function headerName(name?: string | null): string {
  return name || "GYMS.LIFE";
}

export const Logo: React.FC<{ className?: string; href?: string }> = ({
  className = "",
  href = "/app",
}) => (
  <Link to={href} className={`flex items-center gap-3 group ${className}`}>
    <div className="relative w-9 h-9 rounded-xl bg-lime-400 text-black flex items-center justify-center font-black tracking-tighter shadow-[0_0_28px_rgba(190,242,100,0.16)] group-hover:scale-105 transition-transform">
      G
    </div>
    <div className="flex flex-col text-left">
      <span className="text-[15px] font-black tracking-[0.16em] uppercase text-white leading-none">
        GYMS<span className="text-lime-400">.LIFE</span>
      </span>
      <span className="mt-1 text-[8px] font-semibold tracking-[0.24em] text-zinc-500 uppercase">
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
  ];

  return (
    <div className={`inline-flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5 ${className}`}>
      {languages.map((language) => (
        <button
          key={language.code}
          type="button"
          onClick={() => setLang(language.code as any)}
          className={`rounded-md px-2 py-1 text-[9px] font-bold tracking-wider transition-all ${
            lang === language.code
              ? "bg-lime-400 text-black shadow-sm"
              : "text-zinc-500 hover:text-white"
          }`}
        >
          {language.label}
        </button>
      ))}
    </div>
  );
};

const navGroups = (lang: string) => [
  {
    title: lang === "lt" ? "Pagrindinis" : "Workspace",
    items: [
      { to: "/app", icon: LayoutDashboard, label: lang === "lt" ? "Skydelis" : "Dashboard" },
      { to: "/workout/1", icon: Dumbbell, label: lang === "lt" ? "Treniruotė" : "Training" },
      { to: "/progress", icon: TrendingUp, label: lang === "lt" ? "Progresas" : "Progress" },
    ],
  },
  {
    title: lang === "lt" ? "Sistema" : "Library",
    items: [
      { to: "/exercises", icon: Sparkles, label: lang === "lt" ? "Pratimai" : "Exercises" },
      { to: "/nutrition", icon: Apple, label: lang === "lt" ? "Mityba" : "Nutrition" },
      { to: "/form", icon: ShieldCheck, label: lang === "lt" ? "Technika & AR" : "Technique & AR" },
    ],
  },
];

const isRouteActive = (pathname: string, to: string) =>
  to === "/app" ? pathname === "/app" : pathname.startsWith(to);

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useI18n();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const groups = navGroups(lang);

  return (
    <div className="min-h-screen bg-[#090a08] text-zinc-100 selection:bg-lime-400/30 selection:text-lime-200">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[252px] flex-col border-r border-white/[0.07] bg-[#0b0c0a] lg:flex">
        <div className="flex h-[78px] items-center border-b border-white/[0.06] px-6">
          <Logo />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-6">
          <div className="mb-6 rounded-2xl border border-lime-400/10 bg-lime-400/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">GYMS AI</span>
              <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-lime-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400" /> Online
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-black">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">AI Coach</p>
                <p className="truncate text-[10px] text-zinc-500">Your training intelligence</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-zinc-600" />
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.title} className="mb-7">
              <p className="px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-600">
                {group.title}
              </p>
              <nav className="space-y-1">
                {group.items.map((item) => {
                  const active = isRouteActive(location.pathname, item.to);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-semibold transition-all ${
                        active
                          ? "bg-lime-400 text-black shadow-[0_8px_28px_rgba(190,242,100,0.12)]"
                          : "text-zinc-500 hover:bg-white/[0.045] hover:text-zinc-100"
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-black" : "text-zinc-600 group-hover:text-zinc-300"}`} />
                      <span>{item.label}</span>
                      {item.to === "/progress" && (
                        <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[8px] font-bold ${active ? "bg-black/10" : "bg-white/[0.05] text-zinc-600"}`}>
                          LIVE
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.06] p-3">
          <Link
            to="/app"
            className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-white/[0.04]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-800">
              <UserRound className="h-4 w-4 text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-200">Athlete</p>
              <p className="truncate text-[10px] text-zinc-600">Personal workspace</p>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-zinc-700" />
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#090a08]/90 backdrop-blur-2xl lg:hidden">
        <div className="flex h-[64px] items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Open navigation"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-zinc-300"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
          <Logo className="scale-90" />
          <div className="flex items-center gap-2">
            <LangSwitch />
            <button type="button" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03]">
              <Bell className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-[64px] bottom-0 w-[285px] border-r border-white/[0.07] bg-[#0b0c0a] p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-5 rounded-2xl border border-lime-400/10 bg-lime-400/[0.035] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime-400 text-black"><Bot className="h-4 w-4" /></div>
                <div><p className="text-sm font-semibold">AI Coach</p><p className="text-[10px] text-zinc-500">Ready to help</p></div>
              </div>
            </div>
            {groups.flatMap((group) => group.items).map((item) => {
              const active = isRouteActive(location.pathname, item.to);
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${active ? "bg-lime-400 text-black" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main workspace */}
      <div className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-30 hidden h-[78px] items-center justify-between border-b border-white/[0.06] bg-[#090a08]/80 px-8 backdrop-blur-2xl lg:flex">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-zinc-600">Performance workspace</p>
            <p className="mt-1 text-sm font-semibold text-zinc-300">
              {lang === "lt" ? "Tavo treniruočių centras" : "Your training command center"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden xl:flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-zinc-600">
              <Search className="h-3.5 w-3.5" />
              <span className="text-[10px] font-medium">Search anything</span>
              <kbd className="ml-3 rounded border border-white/[0.07] px-1.5 py-0.5 text-[8px] text-zinc-600">⌘ K</kbd>
            </div>
            <LangSwitch />
            <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-zinc-400 hover:text-white">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-lime-400" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-zinc-800">
              <UserRound className="h-4 w-4 text-zinc-400" />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-3 inset-x-3 z-40 lg:hidden">
        <div className="grid grid-cols-5 rounded-2xl border border-white/[0.10] bg-[#10110f]/95 p-1.5 shadow-2xl backdrop-blur-2xl">
          {[
            { to: "/app", icon: Activity, label: lang === "lt" ? "Skydelis" : "Home" },
            { to: "/workout/1", icon: Dumbbell, label: lang === "lt" ? "Treniruotė" : "Train" },
            { to: "/exercises", icon: Sparkles, label: lang === "lt" ? "Pratimai" : "Library" },
            { to: "/progress", icon: TrendingUp, label: lang === "lt" ? "Progresas" : "Progress" },
            { to: "/nutrition", icon: Apple, label: lang === "lt" ? "Mityba" : "Nutrition" },
          ].map((item) => {
            const active = isRouteActive(location.pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center justify-center rounded-xl py-2 transition-all ${active ? "bg-lime-400 text-black" : "text-zinc-600 hover:text-zinc-200"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="mt-1 text-[8px] font-bold tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
