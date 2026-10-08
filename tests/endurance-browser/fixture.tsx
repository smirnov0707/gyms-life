import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QuickRunLog } from "@/components/QuickRunLog";
import { LangProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { Toaster } from "@/components/ui/sonner";
import { state } from "./functions-stub";
import "@/styles.css";
const query = new URLSearchParams(location.search);
localStorage.setItem("forma_lang", query.get("lang") ?? "en");
localStorage.setItem("forma_theme", query.get("theme") ?? "dark");
window.addEventListener("gymslife:training-completed", () => state.trainingEvents++);
window.addEventListener("gymslife:endurance-updated", () => state.enduranceEvents++);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <LangProvider>
        <main className="mx-auto max-w-lg bg-surface p-4 text-foreground">
          <p data-testid="synthetic-watermark">SYNTHETIC TEST FIXTURE — NOT USER DATA</p>
          <QuickRunLog
            onLogged={async () => {
              state.refreshCalls++;
              if (state.failRefresh) throw new Error("Synthetic presentation refresh failure");
            }}
          />
        </main>
        <Toaster />
      </LangProvider>
    </ThemeProvider>
  </StrictMode>,
);
