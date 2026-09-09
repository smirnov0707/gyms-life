/* eslint-disable react-refresh/only-export-components -- isolated browser entry */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LangProvider } from "@/lib/i18n";
import { MorningLabReview } from "@/components/future-lab/MorningLabReview";
import { SmartBrief } from "@/components/SmartBrief";
import { switchOwner, A, B } from "../offline-browser/client";
import { DailyBriefSchema } from "../../src/lib/brief.schema";
import "@/styles.css";
const params = new URLSearchParams(location.search);
localStorage.setItem("forma_lang", params.get("lang") ?? "en");
// The old ownerless cache is deliberately present; current code must never reuse it.
const old = {
  headline: "LEAKED OLD ACCOUNT",
  summary: "Private cached A content",
  focus: "Synthetic",
  signals: [],
  actions: [],
  watchouts: [],
  gaps: [],
  streakDays: 0,
  readiness: null,
};
for (const zone of ["Europe/Vilnius", "UTC"])
  localStorage.setItem(
    `gl_brief_en_${zone}_${new Date().toISOString().slice(0, 10)}`,
    JSON.stringify(DailyBriefSchema.parse(old)),
  );
Object.assign(window, { __nightAuth: { switchOwner, A, B } });
function Page() {
  const { user, loading } = useAuth();
  return (
    <main style={{ padding: 16, maxWidth: 850, margin: "auto" }}>
      <aside data-testid="synthetic-night">
        SYNTHETIC SERVER RESPONSES — REAL UI AND AUTH PROVIDER
      </aside>
      <p data-testid="night-owner">{loading ? "loading" : (user?.id ?? "signed-out")}</p>
      {params.get("screen") === "brief" ? <SmartBrief compact /> : <MorningLabReview />}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <LangProvider>
        <AuthProvider>
          <Page />
        </AuthProvider>
      </LangProvider>
    </QueryClientProvider>
  </StrictMode>,
);
