import "../core-browser/offline-fixture";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Overview } from "@/components/Overview";
import { ConnectHealthSource } from "@/components/ConnectHealthSource";
import { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";
import { FutureMeSimulationDeck } from "@/components/future-lab/FutureMeSimulationDeck";
import { JournalIntelligence } from "@/components/future-lab/JournalIntelligence";
import { RecoveryOutlook } from "@/components/RecoveryOutlook";
import { BodyCompositionCard } from "@/components/BodyCompositionCard";
import { TwinScreen } from "@/components/twin/TwinScreen";
import { OfflineQueueSync } from "@/components/OfflineQueueSync";
import { TwinHome } from "@/components/twin/TwinHome";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AppShell } from "@/components/AppShell";
import { Route as TodayRoute } from "@/routes/_authenticated/app";
import { Route as TwinRoute } from "@/routes/_authenticated/twin";
import { Route as LabRoute } from "@/routes/_authenticated/lab";
import { Route as FutureRoute } from "@/routes/_authenticated/progress";
import { Route as JournalRoute } from "@/routes/_authenticated/history";
import "@/styles.css";

/** Local-only rendering fixture. Every data record is explicitly synthetic. */
/* eslint-disable react-refresh/only-export-components -- the fixture is an
   entry point, not a module anything imports, and is never hot-reloaded. */

/**
 * Each of the Future Lab screens gets its own mode, so a deck that only exists
 * as a route in the running app can still be rendered on its own here.
 */
function Panel() {
  switch (new URLSearchParams(window.location.search).get("panel")) {
    case "health":
      return <ConnectHealthSource />;
    case "lab":
      return <LabCommandDeck />;
    case "futureme":
      return <FutureMeSimulationDeck />;
    case "journal":
      return <JournalIntelligence />;
    case "recovery":
      return <RecoveryOutlook />;
    case "body":
      return <BodyCompositionCard />;
    case "twin":
      return <TwinScreen />;
    case "offline":
      return <OfflineQueueSync />;
    case "home":
      return <TwinHome />;
    default:
      return <Overview />;
  }
}

const query = new URLSearchParams(window.location.search);
const withShell = query.get("shell") === "1";
if (withShell) {
  const preset =
    query.get("scenario") === "reference"
      ? {
          plan: "ready",
          twin: "regions",
          sleep: "staged",
          evidence: "some",
          body: "change",
          source: "scale",
        }
      : { twin: "empty", load: "none", sleep: "", body: "none", signals: "empty" };
  for (const [key, value] of Object.entries(preset)) if (!query.has(key)) query.set(key, value);
  history.replaceState(null, "", `?${query}`);
  localStorage.setItem("forma_theme", query.get("theme") === "light" ? "light" : "dark");
}
const routeComponents = {
  today: TodayRoute.options.component,
  twin: TwinRoute.options.component,
  muscle: TwinRoute.options.component,
  lab: LabRoute.options.component,
  futureme: FutureRoute.options.component,
  journal: JournalRoute.options.component,
};
function ReferenceScreen() {
  const screen = query.get("screen") ?? "today";
  const Component = routeComponents[screen as keyof typeof routeComponents];
  return (
    <AppShell>
      <aside
        data-testid="fixture-watermark"
        style={{
          position: "fixed",
          right: 6,
          bottom: 2,
          zIndex: 100,
          pointerEvents: "none",
          color: "var(--muted-foreground)",
          background: "var(--background)",
          fontSize: 9,
          letterSpacing: ".12em",
        }}
      >
        SYNTHETIC TEST FIXTURE · {query.get("scenario") ?? "empty"} · NOT USER DATA
      </aside>
      {Component ? (
        <Component />
      ) : (
        <section>
          <h1>Outside the visual fixture</h1>
          <p>
            {query.get("route")} is a production route, not included in this isolated rendering
            harness.
          </p>
        </section>
      )}
    </AppShell>
  );
}

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <LangProvider>
        <ThemeProvider>
          {withShell ? (
            <ReferenceScreen />
          ) : (
            <>
              <p style={{ color: "#64748b", fontSize: 12, padding: "12px 16px 0" }}>
                TEST FIXTURE — NOT USER DATA
              </p>
              <div style={{ padding: 16 }}>
                <Panel />
              </div>
            </>
          )}
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
