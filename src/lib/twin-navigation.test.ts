import { describe, expect, it } from "vitest";
import { nextTwinView, parseTwinNavigation } from "./twin-navigation";

describe("Twin reference navigation", () => {
  it("keeps the ordinary route valid without search parameters", () => {
    expect(parseTwinNavigation({})).toEqual({});
  });
  it("round trips each muscle evidence tab", () => {
    for (const detail of ["status", "history", "impact"]) {
      const input = { view: "overview", region: "chest", detail };
      expect(parseTwinNavigation(input)).toEqual(input);
    }
  });
  it("does not treat unknown or multi-valued inputs as muscle evidence", () => {
    expect(
      parseTwinNavigation({ view: ["systems"], region: "<script>", detail: "impact" }),
    ).toEqual({});
    expect(parseTwinNavigation({ region: ["chest"], detail: "status" })).toEqual({});
  });
  it.each(["cardio", "mobility", "fullbody"])(
    "retains evidence navigation for off-body group %s",
    (region) => {
      const input = { view: "overview", region, detail: "history" };
      expect(parseTwinNavigation(input)).toEqual(input);
    },
  );
  it("drops detached detail tabs and unrelated user data", () => {
    expect(parseTwinNavigation({ view: "future", detail: "history", recovery: 72 })).toEqual({
      view: "future",
    });
  });
  it("keeps a recognized region when its detail tab is invalid", () => {
    expect(parseTwinNavigation({ region: "back", detail: "prediction" })).toEqual({
      region: "back",
    });
  });
  it("cycles tabs in both directions", () => {
    expect(nextTwinView("overview", "ArrowLeft")).toBe("journal");
    expect(nextTwinView("journal", "ArrowRight")).toBe("overview");
    expect(nextTwinView("overview", "ArrowRight")).toBe("systems");
  });
  it("supports Home and End without intercepting unrelated keys", () => {
    expect(nextTwinView("future", "Home")).toBe("overview");
    expect(nextTwinView("systems", "End")).toBe("journal");
    expect(nextTwinView("overview", "Tab")).toBeNull();
  });
});
