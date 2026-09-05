import React, { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  FlaskConical,
  Menu,
  MessageSquare,
  PersonStanding,
  UserRound,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  { to: "/twin", icon: PersonStanding, labelKey: "nav.twin" },
  { to: "/lab", icon: FlaskConical, labelKey: "nav.lab" },
  { to: "/coach", icon: MessageSquare, labelKey: "nav.coach" },
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
              ? `grid size-11 shrink-0 place-items-center rounded-xl border border-border bg-foreground/[0.04] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${className}`
              : `inline-flex min-h-11 items-center rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-foreground/[0.04] hover:text-foreground ${className}`
          }
        >
          <span className={compact ? "" : "flex items-center gap-2"}>
            <Menu className="size-4" />
            {compact ? null : t("nav.more")}
          </span>
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] border-border bg-surface px-4 pb-[max(1.5rem,var(--sab))] text-foreground sm:mx-auto sm:max-w-2xl">
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

          {/* The theme control lived only on the marketing page, so an
              athlete who switched to light before signing in had no way
              back once inside the app. This is the way back. */}
          <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
              {t("theme.label")}
            </span>
            <ThemeToggle />
          </section>
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
      <span className="text-base font-black tracking-wider uppercase text-foreground font-mono leading-none">
        GYMS<span className="text-emerald-400 light:text-emerald-600">.LIFE</span>
      </span>
      <span className="text-[9px] font-mono tracking-widest text-muted-foreground uppercase">
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
      className={`flex min-h-11 items-center gap-1 rounded-xl border border-border bg-foreground/[0.04] p-1 ${className}`}
    >
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`min-h-9 min-w-9 rounded-lg px-2 py-0.5 text-[10px] font-mono font-bold transition-all ${
            lang === l.code
              ? "bg-emerald-500 text-black shadow-sm font-black"
              : "text-muted-foreground hover:text-foreground"
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
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/30 selection:text-foreground">
      {/* Viršutinis statuso baras */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 pt-[var(--sat)] backdrop-blur-2xl">
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
                  className={`flex min-h-11 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? "bg-foreground/[0.08] text-foreground border border-border shadow-inner"
                      : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${isActive ? "text-emerald-400 light:text-emerald-600" : "text-muted-foreground"}`}
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
          </div>
        </div>
      </header>

      {/* Pagrindinis turinys */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-[calc(7.5rem+var(--sab))] sm:px-6 md:pb-12">
        {children}
      </main>

      {/* Mobilus plaukiojantis apatinis dokas */}
      <nav className="fixed bottom-[max(1rem,var(--sab))] left-[max(1rem,var(--sal))] right-[max(1rem,var(--sar))] z-50 md:hidden">
        <div className="glass-panel rounded-2xl p-1.5 flex items-center justify-around shadow-2xl border border-border bg-background/85 backdrop-blur-2xl">
          {primaryNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex min-h-12 min-w-12 flex-col items-center justify-center rounded-xl px-3 py-2 transition-all ${
                  isActive
                    ? "bg-foreground/10 text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${isActive ? "text-emerald-400 light:text-emerald-600 scale-110" : ""}`}
                />
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
