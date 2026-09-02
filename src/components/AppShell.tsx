import React, { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Activity, Apple, ArrowUpRight, Dumbbell, Menu, TrendingUp, UserRound } from "lucide-react";
import { useI18n, type Lang, type TKey } from "@/lib/i18n";
import { NAV_GROUPS, byRoute, type NavItem } from "@/lib/nav-map";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

const primaryNavItems = [
  { to: "/app", icon: Activity, labelKey: "nav.today" },
  { to: "/training", icon: Dumbbell, labelKey: "nav.training" },
  { to: "/nutrition", icon: Apple, labelKey: "nav.nutrition" },
  { to: "/progress", icon: TrendingUp, labelKey: "nav.progress" },
] as const;

function groupedToolNavigation(): { key: TKey; items: NavItem[] }[] {
  return NAV_GROUPS.map((group) => ({
    key: group.key,
    items: group.routes.flatMap((route) => {
      const item = byRoute(route);
      return item ? [item] : [];
    }),
  }));
}

function MoreNavigation({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const groups = groupedToolNavigation();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t("nav.more")}
          className={
            compact
              ? `grid size-9 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-neutral-300 transition-colors hover:border-primary/40 hover:text-white ${className}`
              : `rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all hover:bg-white/[0.03] hover:text-white ${className}`
          }
        >
          <span className={compact ? "" : "flex items-center gap-2"}>
            <Menu className="size-4" />
            {compact ? null : t("nav.more")}
          </span>
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] border-border bg-[#0b0b0d] px-4 pb-6 text-foreground sm:mx-auto sm:max-w-2xl">
        <DrawerHeader className="px-1 pb-4 pt-5 text-left">
          <DrawerTitle className="text-display text-2xl text-foreground">
            {t("nav.more")}
          </DrawerTitle>
          <DrawerDescription className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t("nav.moreDescription")}
          </DrawerDescription>
        </DrawerHeader>

        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {t(group.key)}
              </h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DrawerClose key={item.to} asChild>
                      <Link
                        to={item.to}
                        className="group flex min-h-20 flex-col justify-between rounded-2xl border border-border bg-surface-2 p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.06]"
                      >
                        <Icon className="size-4 text-primary" />
                        <span className="flex items-end justify-between gap-2 text-xs font-bold text-foreground">
                          <span className="leading-tight">{t(item.key)}</span>
                          <ArrowUpRight className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:text-primary" />
                        </span>
                      </Link>
                    </DrawerClose>
                  );
                })}
              </div>
            </section>
          ))}

          <DrawerClose asChild>
            <Link
              to="/me"
              className="group flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.08] px-4 py-3.5 transition-colors hover:border-primary/50 hover:bg-primary/[0.12]"
            >
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <UserRound className="size-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-bold text-foreground">{t("nav.athlete")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("nav.athleteDescription")}
                </span>
              </span>
              <ArrowUpRight className="size-4 text-primary transition-transform group-hover:-translate-y-0.5" />
            </Link>
          </DrawerClose>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

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
  const { t } = useI18n();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#030303] text-[#f4f4f5] flex flex-col selection:bg-emerald-500/30 selection:text-emerald-300">
      {/* Viršutinis statuso baras */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#030303]/85 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Logo />

          {/* Desktop navigacija */}
          <nav className="hidden md:flex items-center gap-1">
            {primaryNavItems.map((item) => {
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
                  {t(item.labelKey)}
                </Link>
              );
            })}
            <MoreNavigation />
          </nav>

          <div className="flex items-center gap-2.5">
            <MoreNavigation compact className="md:hidden" />
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
          {primaryNavItems.map((item) => {
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
                  {t(item.labelKey)}
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
