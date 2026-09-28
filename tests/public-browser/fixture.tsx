import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "sonner";
import { Route as Landing } from "@/routes/index";
import { Route as Pricing } from "@/routes/pricing";
import { Route as Privacy } from "@/routes/privacy";
import { Route as Terms } from "@/routes/terms";
import { Route as Refund } from "@/routes/refund";
import { params } from "./state";
import "@/styles.css";
localStorage.setItem("forma_lang", params.get("lang") ?? "en");
localStorage.setItem("forma_theme", params.get("theme") ?? "dark");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Component = (
  params.get("screen") === "home"
    ? Landing
    : params.get("screen") === "privacy"
      ? Privacy
      : params.get("screen") === "terms"
        ? Terms
        : params.get("screen") === "refund"
          ? Refund
          : Pricing
).options.component;
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <LangProvider>
        <ThemeProvider>
          <aside
            data-testid="synthetic-public"
            style={{
              padding: "8px 16px",
              fontSize: 10,
              textAlign: "center",
              background: "var(--surface-2)",
              color: "var(--muted-foreground)",
            }}
          >
            SYNTHETIC BILLING RESPONSES — NO PURCHASE OR ACCOUNT ACTION
          </aside>
          <Component />
          <Toaster />
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
