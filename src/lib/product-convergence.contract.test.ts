import { describe, expect, it } from "vitest";
import { NAV_GROUPS, PRIMARY_WORLD_NAV } from "./nav-map";
import { buildTwinPulse } from "./twin-pulse";
import { TWIN_VIEWS } from "./twin-navigation";
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
  it("keeps exactly four canonical product worlds", () => {
    expect(PRIMARY_WORLD_NAV.map((item) => item.to)).toEqual(["/app", "/twin", "/lab", "/coach"]);
  });
  it("keeps past and future inside the Twin rather than as separate worlds", () => {
    expect(TWIN_VIEWS).toEqual(["overview", "systems", "future", "journal"]);
    expect(PRIMARY_WORLD_NAV.map((item) => item.to)).not.toContain("/progress");
    expect(PRIMARY_WORLD_NAV.map((item) => item.to)).not.toContain("/history");
  });

  it("keeps duplicate product worlds out of the secondary drawer", () => {
    expect(secondaryRoutes).not.toContain("/progress");
    expect(secondaryRoutes).not.toContain("/history");
    expect(secondaryRoutes).not.toContain("/coach");
    expect(secondaryRoutes).not.toContain("/readiness");
    expect(secondaryRoutes).not.toContain("/achievements");
    expect(secondaryRoutes).not.toContain("/reminders");
    expect(secondaryRoutes).not.toContain("/meal-plan");
    expect(secondaryRoutes).not.toContain("/supplements");
  });
  it("keeps nutrition as a contextual entry point while Coach stays a world", () => {
    expect(secondaryRoutes.filter((route) => route === "/nutrition")).toHaveLength(1);
    expect(secondaryRoutes).not.toContain("/coach");
  });

  it("keeps cross-feature recommendation maps out of the navigation contract", async () => {
    const navMap = await import("./nav-map");
    expect("RELATED" in navMap).toBe(false);
  });

  it("never gives Twin Pulse decision authority", () => {
    expect(
      buildTwinPulse([signal("sleep", 0.5), signal("hrv", 2), signal("restingHr", -2)])
        .decisionAuthority,
    ).toBe(false);
  });
});
