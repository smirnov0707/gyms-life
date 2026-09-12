import React, { useId, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, Menu, MoonStar, UserRound } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";
import { baseLang, formatLocale, useI18n, type Lang, type TKey } from "@/lib/i18n";
import { NAV_GROUPS, PRIMARY_WORLD_NAV, byRoute, type NavItem } from "@/lib/nav-map";
import { getOvernightWork } from "@/lib/night-lab.functions";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import "./future-lab-shell.css";

const futureNavItems = PRIMARY_WORLD_NAV;

function groupedToolNavigation(): { key: TKey; items: NavItem[] }[] {
  return NAV_GROUPS.map((group) => ({
    key: group.key,
    items: group.routes.flatMap((route) => {
      const item = byRoute(route);
      return item ? [item] : [];
    }),
  }));
}

function MoreNavigation() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const groups = groupedToolNavigation();

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button type="button" aria-label={t("nav.more")} className="fl-shell-icon-button">
          <Menu aria-hidden="true" size={17} />
        </button>
      </DrawerTrigger>
      <DrawerContent className="future-lab-drawer max-h-[85vh] rounded-t-2xl border-border bg-surface px-4 text-foreground sm:mx-auto sm:max-w-2xl">
        <div className="min-h-0 overflow-y-auto pb-[max(1.5rem,var(--sab))]" data-vaul-no-drag>
          <DrawerHeader className="px-1 pb-4 pt-5 text-left">
            <DrawerTitle className="text-lg font-semibold text-foreground">
              {t("nav.more")}
            </DrawerTitle>
            <DrawerDescription className="mt-1 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {t("nav.moreDescription")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="grid gap-5">
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {t(group.key)}
                </h2>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <DrawerClose key={item.to} asChild>
                        <Link
                          to={item.to}
                          className="group flex min-h-20 flex-col justify-between rounded-xl border border-border bg-surface-2 p-3 transition-colors hover:border-primary/40 hover:bg-primary/[0.06]"
                        >
                          <Icon aria-hidden="true" className="size-4 text-primary" />
                          <span className="flex items-end justify-between gap-2 text-xs font-bold text-foreground">
                            <span className="leading-tight">{t(item.key)}</span>
                            <ArrowUpRight
                              aria-hidden="true"
                              className="size-3 shrink-0 text-muted-foreground group-hover:text-primary"
                            />
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
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3"
              >
                <UserRound aria-hidden="true" className="size-5 text-primary" />
                <span className="flex-1">
                  <span className="block text-sm font-bold">{t("nav.athlete")}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {t("nav.athleteDescription")}
                  </span>
                </span>
                <ArrowUpRight aria-hidden="true" className="size-4 text-primary" />
              </Link>
            </DrawerClose>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-3 py-2">
              <LangSwitch />
              <ThemeToggle />
            </div>
          </div>
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
}) => {
  const gradientId = useId();
  return (
    <Link to={href} className={`fl-brand ${className}`} aria-label="GYMS.LIFE Future Lab">
      <svg className="fl-brand-mark" viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <defs>
          <linearGradient
            id={gradientId}
            x1="5"
            y1="4"
            x2="34"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#bea3ff" />
            <stop offset=".56" stopColor="#8251ee" />
            <stop offset="1" stopColor="#5ecaf0" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="38" height="38" rx="9" className="fl-brand-mark-frame" />
        <path
          d="M27 10H15L9 16V28L14 32H27L32 27V19H22V23H27V26L25 28H16L13 25V18L17 14H25L28 17L31 14L27 10Z"
          fill={`url(#${gradientId})`}
        />
        <path d="M19 19H16V24H19V19Z" fill="#86c7ff" fillOpacity=".85" />
      </svg>
      <span className="fl-brand-wordmark">
        <span>GYMS.LIFE</span>
        <small>FUTURE LAB</small>
      </span>
    </Link>
  );
};

export const LangSwitch: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { lang, setLang } = useI18n();
  const languages = [
    { code: "lt", label: "LT" },
    { code: "en", label: "EN" },
  ] satisfies ReadonlyArray<{ code: Lang; label: string }>;
  return (
    <div
      className={`fl-language-switch ${className}`}
      role="group"
      aria-label={baseLang(lang) === "en" ? "Language" : "Kalba"}
    >
      {languages.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => setLang(item.code)}
          aria-pressed={lang === item.code}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

function NightLabStatus() {
  const { user } = useAuth();
  const { lang, t } = useI18n();
  const english = baseLang(lang) === "en";
  const { data, isError } = useQuery({
    queryKey: ["overnight-work", user?.id],
    queryFn: () => getOvernightWork(),
    enabled: !!user,
    staleTime: 60_000,
  });
  const work = isError ? { state: "unreadable" as const } : data;
  const status = !work
    ? english
      ? "Checking"
      : "Tikrinama"
    : work.state === "unreadable"
      ? english
        ? "Unavailable"
        : "Nepasiekiama"
      : work.state === "never"
        ? english
          ? "No run yet"
          : "Dar nevykdyta"
        : work.nightsAgo <= 1
          ? english
            ? "Twin updated"
            : "Dvynys atnaujintas"
          : english
            ? `${work.nightsAgo} days ago`
            : `Prieš ${work.nightsAgo} d.`;
  const when =
    work?.state === "ran"
      ? new Date(work.at).toLocaleString(formatLocale(lang), {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : undefined;
  const label = `${t("nl.title")}: ${status}${when ? ` · ${when}` : ""}`;
  return (
    <Link
      to="/lab"
      className="fl-night-status"
      data-state={work?.state ?? "loading"}
      aria-label={label}
      title={label}
    >
      <MoonStar className="fl-night-icon" aria-hidden="true" size={15} />
      <span className="fl-night-dot" aria-hidden="true" />
      <span className="fl-night-copy">
        <strong>NIGHT LAB</strong>
        <small>{status}</small>
      </span>
      <ChevronDown className="fl-night-chevron" aria-hidden="true" size={12} />
    </Link>
  );
}

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t, lang } = useI18n();
  const location = useLocation();
  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);
  const navTitle = (to: string): string | undefined => {
    if (to === "/app") return t("dash.welcomeBack");
    if (to === "/twin") return t("nav.twin");
    if (to === "/progress") return t("pr.title");
    return undefined;
  };
  const profileLabel = baseLang(lang) === "en" ? "My profile" : "Mano profilis";

  return (
    <div className="future-lab-app">
      <header className="fl-shell-header">
        <div className="fl-shell-header-inner">
          <Logo />
          <nav className="fl-desktop-navigation" aria-label="Future Lab">
            {futureNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                title={navTitle(item.to)}
                aria-current={isActive(item.to) ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="fl-shell-actions">
            <NightLabStatus />
            <LangSwitch className="fl-header-language" />
            <MoreNavigation />
            <Link
              to="/me"
              aria-label={profileLabel}
              title={profileLabel}
              className="fl-profile-control"
            >
              <span className="fl-profile-avatar">
                <UserRound aria-hidden="true" size={16} />
              </span>
              <span className="fl-profile-copy">{profileLabel}</span>
              <ChevronDown className="fl-profile-chevron" aria-hidden="true" size={12} />
            </Link>
          </div>
        </div>
      </header>
      <main className="fl-shell-main">{children}</main>
      <nav className="fl-mobile-navigation" aria-label="Future Lab">
        {futureNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              title={navTitle(item.to)}
              aria-current={isActive(item.to) ? "page" : undefined}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.7} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};

export default AppShell;
