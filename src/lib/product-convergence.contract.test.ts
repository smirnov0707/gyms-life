import { describe, expect, it } from "vitest";
import { NAV_GROUPS } from "./nav-map";
import { buildTwinPulse } from "./twin-pulse";
import type { LiveSignal } from "./live-signals.engine";

const secondaryRoutes = NAV_GROUPS.flatMap((group) => group.routes);

function signal(id: LiveSignal["id"], delta: number): LiveSignal {
  return {
    id,
    state: "measured",
    value: 1,
    recordedOn: "2026-09-12",
    ageDays: 0,
    delta,
    source: "device",
    history: [],
  };
}

describe("Product Convergence contract", () => {
  it("keeps duplicate product worlds out of the secondary drawer", () => {
    expect(secondaryRoutes).not.toContain("/progress");
    expect(secondaryRoutes).not.toContain("/readiness");
    expect(secondaryRoutes).not.toContain("/achievements");
    expect(secondaryRoutes).not.toContain("/reminders");
    expect(secondaryRoutes).not.toContain("/meal-plan");
    expect(secondaryRoutes).not.toContain("/supplements");
  });
  it("keeps nutrition and intelligence as contextual entry points", () => {
    expect(secondaryRoutes.filter((route) => route === "/nutrition")).toHaveLength(1);
    expect(secondaryRoutes.filter((route) => route === "/coach")).toHaveLength(1);
  });

  it("never gives Twin Pulse decision authority", () => {
    expect(
      buildTwinPulse([signal("sleep", 0.5), signal("hrv", 2), signal("restingHr", -2)])
        .decisionAuthority,
    ).toBe(false);
  });
});
