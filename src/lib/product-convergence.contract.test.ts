import { describe, expect, it } from "vitest";
import { PRIMARY_WORLD_NAV } from "./nav-map";
import { CONTEXT_ACTIONS } from "./action-layer";
import { buildTwinPulse } from "./twin-pulse";
import { TWIN_VIEWS } from "./twin-navigation";
import { PRODUCT_SURFACES } from "./product-surfaces";
import type { LiveSignal } from "./live-signals.engine";

const actionRoutes = CONTEXT_ACTIONS.map((action) => action.to);

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

  it("replaces the feature catalogue with a bounded contextual action layer", () => {
    expect(actionRoutes).toEqual(["/training", "/readiness", "/nutrition", "/ar", "/coach"]);
    for (const legacy of [
      "/progress",
      "/history",
      "/achievements",
      "/reminders",
      "/meal-plan",
      "/supplements",
      "/exercises",
    ]) {
      expect(actionRoutes).not.toContain(legacy);
    }
  });
  it("uses Coach as an action without creating a fifth product world", () => {
    expect(actionRoutes.filter((route) => route === "/coach")).toHaveLength(1);
    expect(PRIMARY_WORLD_NAV.filter((item) => item.to === "/coach")).toHaveLength(1);
  });
  it("classifies legacy and embedded capabilities without exposing them as worlds", () => {
    expect(PRODUCT_SURFACES["/readiness"]).toBe("EMBEDDED_FLOW");
    expect(PRODUCT_SURFACES["/exercises"]).toBe("EMBEDDED_FLOW");
    expect(PRODUCT_SURFACES["/meal-plan"]).toBe("EMBEDDED_FLOW");
    expect(PRODUCT_SURFACES["/supplements"]).toBe("EMBEDDED_FLOW");
    expect(PRODUCT_SURFACES["/achievements"]).toBe("LEGACY_COMPAT");
    expect(PRODUCT_SURFACES["/reminders"]).toBe("LEGACY_COMPAT");
    expect(PRODUCT_SURFACES["/coach-history"]).toBe("LEGACY_COMPAT");
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
