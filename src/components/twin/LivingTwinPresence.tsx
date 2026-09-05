import { mapTwinSnapshotToVisualState } from "@/lib/digital-twin.visual-state";
import type { TwinSnapshot } from "@/lib/digital-twin.schema";

/**
 * Ambient interface motion around the Twin.
 * This is deliberately non-biometric: no cadence maps to heart rate,
 * respiration, readiness, or another physiological measurement.
 */
export function LivingTwinPresence({ snapshot }: { snapshot: TwinSnapshot }) {
  const visual = mapTwinSnapshotToVisualState(snapshot);
  const moving = visual.ambientMotion !== "still";
  const active = visual.ambientMotion === "active";

  return (
    <div
      aria-hidden="true"
      data-twin-motion={visual.ambientMotion}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className={`absolute left-1/2 top-[49%] aspect-[0.72] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border transition-opacity duration-700 motion-reduce:animate-none ${
          moving ? "animate-pulse border-emerald-300/[0.10]" : "border-white/[0.035]"
        } ${active ? "opacity-100" : "opacity-65"}`}
        style={{ animationDuration: active ? "3.8s" : "6.8s" }}
      />
      <div
        className={`absolute left-1/2 top-[49%] aspect-[0.72] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[48%] border transition-opacity duration-700 motion-reduce:animate-none ${
          moving ? "animate-pulse border-emerald-300/[0.055]" : "border-white/[0.025]"
        } ${active ? "opacity-80" : "opacity-45"}`}
        style={{ animationDuration: active ? "5.2s" : "8.4s", animationDelay: "-1.7s" }}
      />
      <div
        className={`absolute inset-x-[20%] top-[17%] h-px bg-gradient-to-r from-transparent via-emerald-300/20 to-transparent transition-opacity motion-reduce:animate-none ${
          moving ? "animate-pulse" : "opacity-20"
        }`}
        style={{ animationDuration: active ? "2.9s" : "5.8s" }}
      />
      <div className="absolute bottom-[12%] left-1/2 h-16 w-[48%] -translate-x-1/2 rounded-[50%] bg-emerald-400/[0.035] blur-2xl" />
    </div>
  );
}
