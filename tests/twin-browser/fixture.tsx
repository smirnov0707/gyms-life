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
const volumes: Record<string, number> = { chest: 3000, back: 1500, arms: 250, legs: 2000 };
function snapshot(empty: boolean, unavailable: boolean): TwinSnapshot {
  return {
    calculationVersion: "TEST-FIXTURE-NOT-USER-DATA",
    computedAt: "2026-09-05T12:00:00Z",
    evidenceWindowDays: 14,
    dataAvailable: !unavailable,
    regions: KNOWN_MUSCLE_GROUPS.map((region) => {
      const value = empty ? undefined : known[region];
      return {
        region,
        provenance: value ? "calculated" : "unknown",
        recoveryPct: value?.recoveryPct ?? null,
        recoveryBand: value?.recoveryBand ?? "unknown",
        volumeKg: value ? (volumes[region] ?? null) : null,
        lastTrainedHoursAgo: value ? 48 : null,
      };
    }),
  };
}
export function Fixture() {
  const language = new URLSearchParams(window.location.search).get("lang") === "lt" ? "lt" : "en";
  const [mounted, setMounted] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  return (
    <main style={{ maxWidth: 1000, margin: "auto", padding: 16 }}>
      <p style={{ color: "#b3bec6", fontSize: 12 }}>TEST FIXTURE — NOT USER DATA</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 12 }}>
        <button onClick={() => setMounted((value) => !value)}>Toggle Twin</button>
        <button onClick={() => setEmpty((value) => !value)}>
          {empty ? "Restore evidence" : "Clear evidence"}
        </button>
        <button onClick={() => setUnavailable((value) => !value)}>
          {unavailable ? "Restore source" : "Fail source"}
        </button>
      </div>
      {mounted && (
        <TwinSnapshotView
          data={snapshot(empty, unavailable)}
          copy={twinCopyFor(language)}
          lang={language}
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
