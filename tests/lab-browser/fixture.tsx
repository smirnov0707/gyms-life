import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { LabView } from "@/components/LabView";
import { LabCommandDeck } from "@/components/future-lab/LabCommandDeck";
import "./services";
import "@/styles.css";
import "@/components/future-lab-shell.css";
import "@/components/future-lab-visual-system.css";

const query = new URLSearchParams(location.search);
localStorage.setItem("forma_lang", query.get("lang") ?? "en");
localStorage.setItem("forma_theme", query.get("theme") ?? "dark");
const client = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } },
});
window.__labQueries = client;
export function LabFixture() {
  return (
    <QueryClientProvider client={client}>
      <LangProvider>
        <ThemeProvider>
          <main className="min-h-screen bg-background p-4 text-foreground">
            <p className="mb-4 text-xs text-muted-foreground" data-testid="synthetic-lab">
              Synthetic Lab records. No live account or server writes.
            </p>
            <div className="mx-auto w-full max-w-5xl">
              {query.get("view") === "deck" ? <LabCommandDeck /> : <LabView />}
            </div>
          </main>
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}
const router = createRouter({
  routeTree: createRootRoute({ component: LabFixture }),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});
const root = document.getElementById("root");
if (!root) throw new Error("Missing Lab fixture root");
createRoot(root).render(<RouterProvider router={router} />);
