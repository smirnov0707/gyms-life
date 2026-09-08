import { describe, expect, it } from "vitest";
import { nextTwinView, parseTwinNavigation } from "./twin-navigation";

describe("Twin reference navigation", () => {
  it("keeps the ordinary route valid without search parameters", () => {
    expect(parseTwinNavigation({})).toEqual({});
  });
  it("round trips each muscle evidence tab", () => {
    for (const detail of ["status", "history", "impact"]) {
      const input = { view: "muscles", region: "chest", detail };
      expect(parseTwinNavigation(input)).toEqual(input);
    }
  });
  it("does not treat unknown or multi-valued inputs as muscle evidence", () => {
    expect(
      parseTwinNavigation({ view: ["systems"], region: "<script>", detail: "impact" }),
    ).toEqual({});
    expect(parseTwinNavigation({ region: ["chest"], detail: "status" })).toEqual({});
  });
  it("drops detached detail tabs and unrelated user data", () => {
    expect(parseTwinNavigation({ view: "systems", detail: "history", recovery: 72 })).toEqual({
      view: "systems",
    });
  });
  it("keeps a recognized region when its detail tab is invalid", () => {
    expect(parseTwinNavigation({ region: "back", detail: "prediction" })).toEqual({
      region: "back",
    });
  });
  it("cycles tabs in both directions", () => {
    expect(nextTwinView("overview", "ArrowLeft")).toBe("systems");
    expect(nextTwinView("systems", "ArrowRight")).toBe("overview");
    expect(nextTwinView("overview", "ArrowRight")).toBe("muscles");
  });
  it("supports Home and End without intercepting unrelated keys", () => {
    expect(nextTwinView("muscles", "Home")).toBe("overview");
    expect(nextTwinView("muscles", "End")).toBe("systems");
    expect(nextTwinView("overview", "Tab")).toBeNull();
  });
});
