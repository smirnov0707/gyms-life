import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TwinSnapshotView, twinCopyFor } from "@/components/TwinView";
import { KNOWN_MUSCLE_GROUPS } from "@/lib/muscle-load.schema";
import type { TwinSnapshot } from "@/lib/digital-twin.schema";
import "../../src/styles.css";
import "../../src/components/future-lab-shell.css";
import "../../src/components/future-lab-visual-system.css";
import "../../src/components/twin/TwinScreen.css";

const query = new URLSearchParams(window.location.search);
const lang = query.get("lang") === "lt" ? "lt" : "en";
document.documentElement.lang = lang;
document.documentElement.className = query.get("theme") === "light" ? "light" : "dark";
const snapshot: TwinSnapshot = {
  calculationVersion: "SYNTHETIC-CAMERA-NOT-USER-DATA",
  bodyVariant: "male",
  computedAt: "2026-10-08T12:00:00Z",
  evidenceWindowDays: 14,
  dataAvailable: true,
  regions: KNOWN_MUSCLE_GROUPS.map(region => ({
    region, provenance: "unknown", recoveryPct: null, recoveryBand: "unknown",
    volumeKg: null, lastTrainedHoursAgo: null,
  })),
};
export function NavigationFixture() {
  const [selection, setSelection] = useState("");
  const [selections, setSelections] = useState(0);
  return <main className="twin-screen" style={{maxWidth:1280,margin:"auto",padding:16}}>
    <p data-navigation-fixture className="text-sm text-foreground">Synthetic camera test. No live account or writes.</p>
    <TwinSnapshotView data={snapshot} copy={twinCopyFor(lang)} lang={lang}
      label={region => region.charAt(0).toUpperCase()+region.slice(1)}
      onInspectRegion={region => { setSelection(region); setSelections(count=>count+1); }} />
    <output data-camera-selection>{selection}</output><output data-camera-selections>{selections}</output>
  </main>;
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing fixture root");
createRoot(root).render(<NavigationFixture />);
