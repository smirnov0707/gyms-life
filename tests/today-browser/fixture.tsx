import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Overview } from "@/components/Overview";
import { ConnectHealthSource } from "@/components/ConnectHealthSource";
import { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";
import { FutureMeSimulationDeck } from "@/components/future-lab/FutureMeSimulationDeck";
import { JournalIntelligence } from "@/components/future-lab/JournalIntelligence";
import { BodyCompositionCard } from "@/components/BodyCompositionCard";
import { TwinScreen } from "@/components/twin/TwinScreen";
import { OfflineQueueSync } from "@/components/OfflineQueueSync";
import { LangProvider } from "@/lib/i18n";
import "@/styles.css";

/**
 * Renders the Today screen against sources that return nothing, which is what
 * this account's database actually holds. The point of the fixture is that the
 * screen has to stay readable and honest in exactly that state — no invented
 * figures, no panel that silently disappears.
 *
 * Test-only. This directory is not a product route and never queries user data.
 */
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
    case "body":
      return <BodyCompositionCard />;
    case "twin":
      return <TwinScreen />;
    case "offline":
      return <OfflineQueueSync />;
    default:
      return <Overview />;
  }
}

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <LangProvider>
        <p style={{ color: "#64748b", fontSize: 12, padding: "12px 16px 0" }}>
          TEST FIXTURE — NOT USER DATA
        </p>
        <div style={{ padding: 16 }}>
          <Panel />
        </div>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
