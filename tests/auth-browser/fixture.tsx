import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { Toaster } from "sonner";
import { Route as AuthRoute } from "@/routes/auth";
import { Route as ResetRoute } from "@/routes/reset-password";
import { params } from "./state";
import "@/styles.css";
localStorage.setItem("forma_lang", params.get("lang") ?? "en");
localStorage.setItem("forma_theme", params.get("theme") ?? "dark");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const Component =
  params.get("screen") === "reset" ? ResetRoute.options.component : AuthRoute.options.component;
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <LangProvider>
        <ThemeProvider>
          <AuthProvider>
            <aside
              data-testid="synthetic-auth"
              style={{
                padding: "8px 16px",
                fontSize: 10,
                textAlign: "center",
                background: "var(--surface-2)",
                color: "var(--muted-foreground)",
              }}
            >
              SYNTHETIC AUTH RESPONSES — NO EMAIL OR ACCOUNT ACTION
            </aside>
            <Component />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
