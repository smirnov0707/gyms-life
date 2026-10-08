import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TwinLayerControls } from "@/components/twin/TwinLayerControls";
import type { TwinLayer } from "@/components/twin/twin-scene.model";
import "../../src/styles.css";
import "../../src/components/future-lab-shell.css";
import "../../src/components/future-lab-visual-system.css";

const query = new URLSearchParams(window.location.search);
const language = query.get("lang") === "lt" ? "lt" : "en";
document.documentElement.lang = language;
document.documentElement.className = query.get("theme") === "light" ? "light" : "dark";

function Selection({ compact }: { compact: boolean }) {
  const [layer, setLayer] = useState<TwinLayer>("recovery");
  const [changes, setChanges] = useState(0);
  return (
    <section data-variant={compact ? "cockpit" : "full"} className="min-w-0 space-y-2">
      <h2 className="text-sm text-foreground">{compact ? "Cockpit" : "Full Twin"}</h2>
      <div className="rounded-2xl bg-[#040a14] py-3 text-white">
        <TwinLayerControls
          language={language}
          layer={layer}
          compact={compact}
          onLayerChange={(next) => {
            setLayer(next);
            setChanges((count) => count + 1);
          }}
        />
      </div>
      <output data-selection>{layer}</output>
      <output data-changes>{changes}</output>
    </section>
  );
}

function Fixture() {
  return (
    <main className="min-h-screen bg-background p-4 text-foreground">
      <p className="mb-6 text-sm">Synthetic controls. No account, metrics or server writes.</p>
      <div className="grid max-w-lg gap-6">
        <Selection compact={false} />
        <Selection compact />
      </div>
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing Twin layer fixture root");
createRoot(root).render(<Fixture />);
