import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { TwinSnapshotView, twinCopyFor } from "../../src/components/TwinView";
import { KNOWN_MUSCLE_GROUPS } from "../../src/lib/muscle-load.schema";
import type { TwinSnapshot, TwinRegionState } from "../../src/lib/digital-twin.schema";
import "../../src/styles.css";

// Test-only inputs. This directory is not a product route and never queries user data.
const known: Record<
  string,
  { recoveryPct: number; recoveryBand: TwinRegionState["recoveryBand"] }
> = {
  chest: { recoveryPct: 77, recoveryBand: "moderate" },
  back: { recoveryPct: 40, recoveryBand: "fatigued" },
  arms: { recoveryPct: 87, recoveryBand: "fresh" },
  legs: { recoveryPct: 83, recoveryBand: "fresh" },
};
function snapshot(empty: boolean): TwinSnapshot {
  return {
    calculationVersion: "TEST-FIXTURE-NOT-USER-DATA",
    computedAt: "2026-09-05T12:00:00Z",
    evidenceWindowDays: 14,
    dataAvailable: true,
    regions: KNOWN_MUSCLE_GROUPS.map((region) => {
      const value = empty ? undefined : known[region];
      return {
        region,
        provenance: value ? "calculated" : "unknown",
        recoveryPct: value?.recoveryPct ?? null,
        recoveryBand: value?.recoveryBand ?? "unknown",
        volumeKg: value ? 1000 : null,
        lastTrainedHoursAgo: value ? 48 : null,
      };
    }),
  };
}
export function Fixture() {
  const [mounted, setMounted] = useState(true);
  const [empty, setEmpty] = useState(false);
  // The app stamps `light` or `dark` on <html> and paints everything from the
  // tokens those classes define. Only the Twin's own stage is deliberately
  // dark in both; the evidence list beside it has to follow the theme, and
  // once shipped white-on-white because nothing checked.
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const applyTheme = (next: "dark" | "light") => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(next);
    document.body.style.background = next === "light" ? "#f8fafc" : "#050706";
    setTheme(next);
  };
  return (
    <main style={{ maxWidth: 1000, margin: "auto", padding: 16 }}>
      <p style={{ color: "#b3bec6", fontSize: 12 }}>TEST FIXTURE — NOT USER DATA</p>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <button onClick={() => applyTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "Light theme" : "Dark theme"}
        </button>
        <button onClick={() => setMounted((value) => !value)}>Toggle Twin</button>
        <button onClick={() => setEmpty((value) => !value)}>
          {empty ? "Restore evidence" : "Clear evidence"}
        </button>
      </div>
      {mounted && (
        <TwinSnapshotView
          data={snapshot(empty)}
          copy={twinCopyFor("en")}
          lang="en"
          label={(region) => region.charAt(0).toUpperCase() + region.slice(1)}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
