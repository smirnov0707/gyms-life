import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/error-reporting";
import { AuthProvider } from "@/lib/auth";
import { LangProvider, useI18n } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { ReminderProvider } from "@/lib/reminders";
import { ThemeProvider, themeInitScript } from "@/lib/theme";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="fl-route-state flex min-h-screen items-center justify-center bg-background px-4">
      <div className="fl-route-state-panel max-w-md">
        <h1 className="text-display text-7xl font-bold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("rt.notFoundTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("rt.notFoundHint")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="ui-button ui-button-primary inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("rt.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { t } = useI18n();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="fl-route-state flex min-h-screen items-center justify-center bg-background px-4">
      <div className="fl-route-state-panel max-w-md">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("rt.errorTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("rt.errorHint")}</p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="ui-button ui-button-primary inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("rt.tryAgain")}
          </button>
          <a
            href="/"
            className="ui-button inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("rt.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover, interactive-widget=resizes-content",
      },
      { name: "author", content: "GYMS.LIFE" },
      { name: "google-site-verification", content: "b1zYHPUG4ttUt9kbOSgIHLPi5OQ3qqplDXfUNFna1f4" },
      { property: "og:type", content: "website" },
      // `summary` stays the default for every route that sets no image of its
      // own. The card type is a promise about what the page provides, and a
      // large-image card with no image renders as a broken preview, so a route
      // earns `summary_large_image` by also setting `og:image` — the landing
      // page does, from `public/share-card.png`.
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preload",
        href: "/fonts/manrope-variable.ttf",
        as: "font",
        type: "font/ttf",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: "/fonts/space-grotesk-variable.ttf",
        as: "font",
        type: "font/ttf",
        crossOrigin: "anonymous",
      },
      {
        rel: "icon",
        href: "/favicon.ico?v=gyms-life-1",
        sizes: "16x16 32x32 48x48",
        type: "image/x-icon",
      },
      {
        rel: "icon",
        href: "/favicon.svg?v=gyms-life-1",
        type: "image/svg+xml",
        sizes: "any",
      },
      {
        rel: "apple-touch-icon",
        href: "/apple-touch-icon.png?v=gyms-life-1",
        sizes: "180x180",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="lt" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LangProvider>
          <AuthProvider>
            <ReminderProvider>
              {/* Route transitions: re-animate the page shell on every path change. */}
              <div key={pathname} className="page-enter">
                <Outlet />
              </div>
              <Toaster position="top-center" />
            </ReminderProvider>
          </AuthProvider>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
