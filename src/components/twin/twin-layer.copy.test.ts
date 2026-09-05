import { describe, expect, it } from "vitest";
import { formatTwinValue, twinLayerCopy } from "./twin-layer.copy";
import { TWIN_LAYERS, TWIN_DISPLAY_COLORS } from "./twin-scene.model";

describe("Twin layer labels", () => {
  it("never prints an unknown reading as zero or a percentage", () => {
    expect(formatTwinValue(null, "logged_volume", "lt")).toBe("—");
    expect(formatTwinValue(0, "logged_volume", "en")).toBe("0 kg × reps");
    expect(formatTwinValue(55, "recovery", "en")).toBe("55%");
  });
  it.each(["lt", "en"] as const)("labels every layer and tone in %s", (language) => {
    const copy = twinLayerCopy(language);
    for (const layer of TWIN_LAYERS) expect(copy.label[layer].length).toBeGreaterThan(0);
    expect(Object.keys(copy.band).sort()).toEqual(Object.keys(TWIN_DISPLAY_COLORS).sort());
  });
});
