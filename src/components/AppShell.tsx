import React, { useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  FlaskConical,
  History,
  Menu,
  PersonStanding,
  Rocket,
  UserRound,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { baseLang, useI18n, type Lang, type TKey } from "@/lib/i18n";
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

const futureNavItems = [
  { to: "/app", icon: Activity, lt: "TODAY", en: "TODAY" },
  { to: "/twin", icon: PersonStanding, lt: "MY TWIN", en: "MY TWIN" },
  { to: "/lab", icon: FlaskConical, lt: "LAB", en: "LAB" },
  { to: "/progress", icon: Rocket, lt: "FUTURE ME", en: "FUTURE ME" },
  { to: "/history", icon: History, lt: "JOURNAL", en: "JOURNAL" },
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

function MoreNavigation({ className = "", dock = false }: { className?: string; dock?: boolean }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const groups = groupedToolNavigation();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t("nav.more")}
          className={dock
            ? `grid min-h-11 min-w-11 place-items-center rounded-xl border border-[#1a2941] bg-[#091321] text-slate-400 ${className}`
            : `inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#1a2941] bg-[#091321] px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:border-violet-400/40 hover:text-white ${className}`}
        >
          <Menu className="size-4" />
          {dock ? null : t("nav.more")}
        </button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] border-border bg-surface px-4 pb-[max(1.5rem,var(--sab))] text-foreground sm:mx-auto sm:max-w-2xl">
        <DrawerHeader className="px-1 pb-4 pt-5 text-left">
          <DrawerTitle className="text-display text-2xl text-foreground">{t("nav.more")}</DrawerTitle>
          <DrawerDescription className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t("nav.moreDescription")}
          </DrawerDescription>
        </DrawerHeader>
        <div className="grid gap-5">
          {groups.map((group) => (
            <section key={group.key}>
              <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{t(group.key)}</h2>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <DrawerClose key={item.to} asChild>
                      <Link to={item.to} className="group flex min-h-20 flex-col justify-between rounded-2xl border border-border bg-surface-2 p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.06]">
                        <Icon className="size-4 text-primary" />
                        <span className="flex items-end justify-between gap-2 text-xs font-bold text-foreground">
                          <span className="leading-tight">{t(item.key)}</span>
                          <ArrowUpRight className="size-3 shrink-0 text-muted-foreground group-hover:text-primary" />
                        </span>
                      </Link>
                    </DrawerClose>
                  );
                })}
              </div>
            </section>
          ))}
          <DrawerClose asChild>
            <Link to="/me" className="group flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/[0.08] px-4 py-3.5">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary"><UserRound className="size-4" /></span>
              <span className="flex-1"><span className="block text-sm font-bold text-foreground">{t("nav.athlete")}</span><span className="mt-0.5 block text-xs text-muted-foreground">{t("nav.athleteDescription")}</span></span>
              <ArrowUpRight className="size-4 text-primary" />
            </Link>
          </DrawerClose>
          <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{t("theme.label")}</span>
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

export const Logo: React.FC<{ className?: string; href?: string }> = ({ className = "", href = "/app" }) => (
  <Link to={href} className={`group flex items-center gap-2.5 ${className}`}>
    <div className="relative grid size-9 place-items-center rounded-xl border border-violet-400/35 bg-gradient-to-br from-violet-600/35 to-cyan-500/15 shadow-[0_0_25px_rgba(124,58,237,.24)]">
      <span className="font-mono text-sm font-black text-violet-200">G</span>
      <span aria-hidden="true" className="absolute inset-1 rounded-lg border border-cyan-300/10" />
    </div>
    <div className="flex flex-col text-left">
      <span className="font-mono text-base font-black uppercase leading-none tracking-[0.08em] text-white">GYMS.LIFE</span>
      <span className="mt-1 font-mono text-[8px] uppercase tracking-[0.2em] text-violet-300">FUTURE LAB</span>
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
    <div className={`flex min-h-10 items-center gap-1 rounded-xl border border-[#1a2941] bg-[#091321] p-1 ${className}`}>
      {languages.map((item) => (
        <button key={item.code} type="button" onClick={() => setLang(item.code)} className={`min-h-8 min-w-8 rounded-lg px-2 font-mono text-[9px] font-bold ${lang === item.code ? "bg-violet-500/25 text-violet-100" : "text-slate-500 hover:text-white"}`}>
          {item.label}
        </button>
      ))}
    </div>
  );
};

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang } = useI18n();
  const locale = baseLang(lang);
  const location = useLocation();
  const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-screen bg-[#02060c] text-foreground selection:bg-violet-500/35 selection:text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(40,82,160,.12),transparent_35%),radial-gradient(circle_at_10%_40%,rgba(109,40,217,.06),transparent_28%)]" />
      <header className="sticky top-0 z-40 border-b border-[#142239] bg-[#02060c]/92 pt-[var(--sat)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[68px] max-w-[1680px] items-center gap-4 px-4 sm:px-6 xl:px-8">
          <Logo className="shrink-0" />
          <nav className="mx-auto hidden h-full items-center gap-1 lg:flex" aria-label="Future Lab">
            {futureNavItems.map((item) => {
              const active = isActive(item.to);
              return (
                <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={`relative flex min-h-10 items-center rounded-xl px-4 text-[10px] font-bold uppercase tracking-[0.13em] transition-all ${active ? "border border-violet-400/30 bg-violet-500/12 text-white shadow-[0_0_25px_rgba(124,58,237,.08)]" : "border border-transparent text-slate-400 hover:bg-white/[0.03] hover:text-white"}`}>
                  {item[locale]}
                  {active ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-[15px] h-px bg-gradient-to-r from-transparent via-violet-400 to-transparent" /> : null}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden min-h-10 items-center gap-2 rounded-xl border border-[#1a2941] bg-[#07111d] px-3 xl:flex">
              <span className="size-1.5 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,.8)]" />
              <div><p className="text-[8px] font-bold uppercase tracking-[0.16em] text-slate-200">FUTURE LAB</p><p className="text-[7px] uppercase tracking-[0.12em] text-slate-600">{locale === "en" ? "REAL DATA" : "REALŪS DUOMENYS"}</p></div>
            </div>
            <LangSwitch className="hidden sm:flex" />
            <MoreNavigation />
            <Link to="/me" aria-label="Profile" className="grid size-10 place-items-center rounded-xl border border-[#1a2941] bg-[#091321] text-slate-400 transition-colors hover:border-violet-400/40 hover:text-white"><UserRound className="size-4" /></Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-[1680px] px-3 py-4 pb-[calc(7.5rem+var(--sab))] sm:px-5 md:py-5 lg:px-6 lg:pb-10 xl:px-8">{children}</main>

      <nav aria-label="Future Lab" className="fixed bottom-[max(.65rem,var(--sab))] left-[max(.6rem,var(--sal))] right-[max(.6rem,var(--sar))] z-50 lg:hidden">
        <div className="mx-auto grid max-w-xl grid-cols-5 rounded-[1.4rem] border border-[#1a2941] bg-[#030914]/94 px-1 py-1.5 shadow-[0_18px_60px_rgba(0,0,0,.7)] backdrop-blur-2xl">
          {futureNavItems.map((item) => {
            const active = isActive(item.to);
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={`flex min-h-12 flex-col items-center justify-center rounded-xl px-1 text-center transition-colors ${active ? "bg-violet-500/12 text-violet-200" : "text-slate-500 hover:text-slate-200"}`}>
                <Icon className="size-[17px]" />
                <span className="mt-1 text-[7px] font-bold uppercase tracking-[0.08em]">{item[locale]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
