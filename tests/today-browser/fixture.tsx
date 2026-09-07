import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Overview } from "@/components/Overview";
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
          <Overview />
        </div>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
