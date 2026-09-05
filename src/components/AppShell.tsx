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

const mobileSideItems = [primaryNavItems[0], primaryNavItems[2], primaryNavItems[3]] as const;
const twinNavItem = primaryNavItems[1];

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
  dock = false,
}: {
  className?: string;
  compact?: boolean;
  dock?: boolean;
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
            dock
              ? `flex min-h-12 min-w-12 flex-col items-center justify-center rounded-2xl px-1.5 py-2 text-neutral-400 transition-colors hover:text-white ${className}`
              : compact
                ? `grid size-11 shrink-0 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-neutral-300 transition-colors hover:border-primary/40 hover:text-white ${className}`
                : `inline-flex min-h-11 items-center rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-neutral-400 transition-all hover:bg-white/[0.03] hover:text-white ${className}`
          }
        >
          {dock ? (
            <>
              <Menu className="size-[18px]" />
              <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.08em]">
                {t("nav.more")}
              </span>
            </>
          ) : (
            <span className={compact ? "" : "flex items-center gap-2"}>
              <Menu className="size-4" />
              {compact ? null : t("nav.more")}
            </span>
          )}
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh] overflow-y-auto rounded-t-[1.75rem] border-border bg-[#0b0b0d] px-4 pb-[max(1.5rem,var(--sab))] text-foreground sm:mx-auto sm:max-w-2xl">
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
  <Link to={href} className={`group flex items-center gap-2.5 ${className}`}>
    <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-sm font-black tracking-tighter text-black shadow-lg shadow-emerald-950/40 transition-transform group-hover:scale-105 motion-reduce:transition-none">
      G
    </div>
    <div className="flex flex-col text-left">
      <span className="font-mono text-base font-black uppercase leading-none tracking-wider text-white">
        GYMS<span className="text-emerald-400">.LIFE</span>
      </span>
      <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-neutral-500">
        FUTURE LAB
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
      className={`flex min-h-11 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.04] p-1 ${className}`}
    >
      {languages.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`min-h-9 min-w-9 rounded-lg px-2 py-0.5 font-mono text-[10px] font-bold transition-all ${
            lang === l.code
              ? "bg-emerald-500 font-black text-black shadow-sm"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};

function MobileDockLink({
  item,
  active,
}: {
  item: (typeof primaryNavItems)[number];
  active: boolean;
}) {
  const { t } = useI18n();
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 min-w-12 flex-col items-center justify-center rounded-2xl px-1.5 py-2 transition-colors motion-reduce:transition-none ${
        active ? "text-white" : "text-neutral-500 hover:text-white"
      }`}
    >
      <Icon className={`size-[18px] ${active ? "text-primary" : ""}`} />
      <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.08em]">
        {t(item.labelKey)}
      </span>
    </Link>
  );
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const location = useLocation();
  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <div className="flex min-h-screen flex-col bg-[#030303] text-[#f4f4f5] selection:bg-emerald-500/30 selection:text-emerald-300">
      <header className="sticky top-0 z-40 border-b border-white/[0.05] bg-[#030303]/82 pt-[var(--sat)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex">
            {primaryNavItems.map((item) => {
              const active = isActive(item.to);
              const Icon = item.icon;
              const isTwin = item.to === "/twin";
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all ${
                    active
                      ? isTwin
                        ? "border border-primary/25 bg-primary/[0.09] text-white"
                        : "border border-white/10 bg-white/[0.07] text-white"
                      : "text-neutral-400 hover:bg-white/[0.03] hover:text-white"
                  }`}
                >
                  <Icon
                    className={`size-3.5 ${active || isTwin ? "text-emerald-400" : "text-neutral-400"}`}
                  />
                  {t(item.labelKey)}
                </Link>
              );
            })}
            <MoreNavigation />
          </nav>

          <div className="flex items-center gap-2.5">
            <LangSwitch />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 pb-[calc(8.25rem+var(--sab))] sm:px-6 md:py-6 md:pb-12">
        {children}
      </main>

      <nav
        aria-label="Primary"
        className="fixed bottom-[max(.75rem,var(--sab))] left-[max(.75rem,var(--sal))] right-[max(.75rem,var(--sar))] z-50 md:hidden"
      >
        <div className="relative mx-auto grid max-w-md grid-cols-5 items-end rounded-[1.65rem] border border-white/[0.10] bg-black/88 px-1.5 pb-1.5 pt-2 shadow-[0_20px_80px_rgba(0,0,0,.65)] backdrop-blur-2xl">
          <MobileDockLink
            item={mobileSideItems[0]}
            active={isActive(mobileSideItems[0].to)}
          />
          <MobileDockLink
            item={mobileSideItems[1]}
            active={isActive(mobileSideItems[1].to)}
          />

          <Link
            to={twinNavItem.to}
            aria-current={isActive(twinNavItem.to) ? "page" : undefined}
            aria-label={t(twinNavItem.labelKey)}
            className="relative -mt-7 flex min-h-[68px] flex-col items-center justify-end"
          >
            <span
              className={`relative grid size-[58px] place-items-center rounded-full border shadow-[0_10px_35px_rgba(0,0,0,.6)] transition-transform motion-reduce:transition-none ${
                isActive(twinNavItem.to)
                  ? "border-primary/60 bg-primary text-black"
                  : "border-white/15 bg-[#0c0f0e] text-primary hover:scale-[1.04] hover:border-primary/40"
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-1 rounded-full border ${
                  isActive(twinNavItem.to) ? "border-black/15" : "border-primary/15"
                }`}
              />
              <PersonStanding className="relative z-10 size-6" />
            </span>
            <span
              className={`mt-1 text-[8px] font-black uppercase tracking-[0.14em] ${
                isActive(twinNavItem.to) ? "text-primary" : "text-neutral-300"
              }`}
            >
              {t(twinNavItem.labelKey)}
            </span>
          </Link>

          <MobileDockLink
            item={mobileSideItems[2]}
            active={isActive(mobileSideItems[2].to)}
          />
          <MoreNavigation dock />
        </div>
      </nav>
    </div>
  );
};

export default AppShell;
