import { StrictMode, createElement } from "react";
import { createRoot } from "react-dom/client";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Route } from "@/routes/_authenticated/coach";
import "./services";
import "@/styles.css";
import "@/components/future-lab-shell.css";
import "@/components/future-lab-visual-system.css";

const query = new URLSearchParams(location.search);
localStorage.setItem("forma_lang", query.get("lang") ?? "en");
localStorage.setItem("forma_theme", query.get("theme") ?? "dark");
const element = document.getElementById("root");
if (!element) throw new Error("Missing Coach fixture root");
const component = Route.options.component;
if (!component) throw new Error("Missing actual Coach route component");
const page = <LangProvider><ThemeProvider><main className="min-h-screen bg-background p-4 text-foreground">
  <p className="mb-3 text-xs" data-synthetic-conversation>Synthetic conversation. No real AI, account, or database calls.</p>
  {createElement(component)}
</main></ThemeProvider></LangProvider>;
createRoot(element).render(query.has("strict") ? <StrictMode>{page}</StrictMode> : page);
