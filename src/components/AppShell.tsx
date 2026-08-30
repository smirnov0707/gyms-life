import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Dumbbell, LogOut, Menu, X, Search, LayoutGrid, ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { nav, NAV_GROUPS } from "@/lib/nav-map";
import { cn } from "@/lib/utils";
import { tactileClick } from "@/lib/tactile";
import { Button } from "@/components/ui/button";
import { CommandPalette, useCommandPalette } from "@/components/CommandPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


export function LangSwitch() {
  const { lang, setLang } = useI18n();
  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0]!;
  return (
    <label className="relative inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold">
      <span className="pointer-events-none flex items-center gap-1.5 whitespace-nowrap">
        <span className="uppercase">{current.code}</span>
      </span>
      <select
        aria-label="Language"
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}


export function Logo() {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Dumbbell aria-hidden="true" className="size-4" />
      </span>
      <span className="text-display text-2xl leading-none tracking-wider">GYMS.LIFE</span>
    </Link>
  );
}

/** Links that always stay visible in the top bar; the rest live in the grouped "More" menu. */
const PRIMARY = ["/app", "/exercises", "/meal-plan", "/progress", "/coach"];
const primaryNav = nav.filter((n) => PRIMARY.includes(n.to));
const secondaryNav = nav.filter((n) => !PRIMARY.includes(n.to));
const groupedNav = NAV_GROUPS.map((g) => ({
  key: g.key,
  items: g.routes.map((r) => nav.find((n) => n.to === r)).filter((n): n is (typeof nav)[number] => Boolean(n)),
})).filter((g) => g.items.length > 0);

export function headerName(user: { email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  const meta = user.user_metadata ?? {};
  const raw =
    (meta["full_name"] as string | undefined) ||
    (meta["name"] as string | undefined) ||
    (user.email ? user.email.split("@")[0] : "");
  const first = (raw ?? "").trim().split(/\s+/)[0] ?? "";
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "";
}

export function AppShell({ children }: { children: ReactNode }) {

  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const palette = useCommandPalette();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div className="aurora" aria-hidden="true" />
      <CommandPalette open={palette.open} setOpen={palette.setOpen} />
      <header className="sticky top-0 z-40 border-b border-border bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4">
          <Logo />
          <nav className="hidden shrink-0 items-center gap-1 lg:flex">
            {primaryNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => tactileClick()}
                className={cn(
                  "nav-pill press flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold",
                  pathname.startsWith(item.to)
                    ? "nav-pill-active text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                <span>{t(item.key)}</span>
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "nav-pill press flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-semibold outline-none",
                  secondaryNav.some((i) => pathname.startsWith(i.to))
                    ? "nav-pill-active text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="size-4 shrink-0" />
                <span>{t("nav.more")}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={10}
                className="w-[26rem] rounded-2xl border-border/70 bg-background/85 p-2 backdrop-blur-xl"
              >
                <div className="grid gap-2">
                  {groupedNav.map((group) => (
                    <div key={group.key}>
                      <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {t(group.key)}
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {group.items.map((item) => (
                          <DropdownMenuItem key={item.to} asChild className="rounded-xl p-0 focus:bg-transparent">
                            <Link
                              to={item.to}
                              onClick={() => tactileClick()}
                              className={cn(
                                "menu-tile flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold",
                                pathname.startsWith(item.to) ? "text-primary" : "text-foreground",
                              )}
                            >
                              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-primary">
                                <item.icon className="size-4" />
                              </span>
                              <span className="truncate">{t(item.key)}</span>
                            </Link>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => palette.setOpen(true)}
              title={t("cmd.hint")}
              className="hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground xl:flex"
            >
              <Search className="size-3.5" />
              <kbd className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px]">⌘K</kbd>
            </button>
            <ThemeToggle />
            <LangSwitch />
            {user ? (
              <>
                <span className="hidden max-w-[8rem] truncate whitespace-nowrap text-xs font-semibold uppercase tracking-widest text-muted-foreground xl:inline">
                  {headerName(user)}
                </span>
                <Button variant="ghost" size="icon" onClick={signOut} title={t("nav.signout")}>
                  <LogOut className="size-4" />
                </Button>
              </>

            ) : (
              <Button asChild size="sm">
                <Link to="/auth">{t("landing.login")}</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
        {open && (
          <nav className="menu-reveal grid max-h-[70vh] gap-4 overflow-y-auto border-t border-border bg-background/90 px-4 py-3 backdrop-blur-xl lg:hidden">
            {[{ key: "nav.dashboard" as const, items: nav.filter((n) => n.to === "/app") }, ...groupedNav].map(
              (group) => (
                <div key={group.key}>
                  <p className="pb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t(group.key)}
                  </p>
                  <div className="grid gap-2 [grid-template-columns:repeat(2,minmax(0,1fr))] sm:[grid-template-columns:repeat(3,minmax(0,1fr))]">
                    {group.items.map((item) => (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={() => {
                          tactileClick();
                          setOpen(false);
                        }}
                        className={cn(
                          "menu-tile flex min-w-0 items-center gap-2.5 rounded-xl border border-border/70 bg-surface px-3 py-3 text-[13px] font-semibold leading-tight",
                          pathname.startsWith(item.to) ? "text-primary" : "text-foreground",
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-primary">
                          <item.icon className="size-4" />
                        </span>
                        <span className="truncate">{t(item.key)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ),
            )}
          </nav>
        )}
      </header>
      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-3 sm:px-4 md:px-6 py-4 sm:py-8 safe-bottom">{children}</main>
      <footer className="relative z-10 border-t border-border bg-surface">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row">
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GYMS.LIFE
          </span>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <Link to="/pricing" className="text-muted-foreground transition-colors hover:text-primary">
              {t("footer.pricing")}
            </Link>
            <Link to="/privacy" className="text-muted-foreground transition-colors hover:text-primary">
              {t("footer.privacy")}
            </Link>
            <Link to="/terms" className="text-muted-foreground transition-colors hover:text-primary">
              {t("footer.terms")}
            </Link>
            <Link to="/refund" className="text-muted-foreground transition-colors hover:text-primary">
              {t("footer.refund")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );

}
