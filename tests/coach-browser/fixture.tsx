import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Route as CoachRoute } from "@/routes/_authenticated/coach";
import "./services";
import "@/styles.css";
import "@/components/future-lab-shell.css";
import "@/components/future-lab-visual-system.css";

const query = new URLSearchParams(location.search);
localStorage.setItem("forma_lang", query.get("lang") ?? "en");
localStorage.setItem("forma_theme", query.get("theme") ?? "dark");
const Coach = CoachRoute.options.component;
if (!Coach) throw new Error("The actual Coach route component is required");
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
const app = (
  <LangProvider>
    <ThemeProvider>
      <main className="min-h-screen bg-background p-4 text-foreground">
        <p className="mb-4 text-xs" data-synthetic-coach>Synthetic Coach data. No live account.</p>
        <Coach />
      </main>
    </ThemeProvider>
  </LangProvider>
);
createRoot(root).render(query.get("strict") === "1" ? <StrictMode>{app}</StrictMode> : app);
