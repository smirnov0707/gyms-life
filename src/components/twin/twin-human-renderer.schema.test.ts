import { describe, expect, it } from "vitest";
import {
  DEFAULT_TWIN_HUMAN_ASSET,
  TwinHumanAssetSchema,
  TwinHumanRendererModeSchema,
} from "./twin-human-renderer.schema";

describe("Twin human renderer contract", () => {
  it("keeps visual representation separate from physiological state", () => {
    expect(TwinHumanRendererModeSchema.parse("photoreal")).toBe("photoreal");
    expect(TwinHumanRendererModeSchema.parse("schematic")).toBe("schematic");
  });

  it("ships a same-origin GLB path for production self-hosting", () => {
    const asset = TwinHumanAssetSchema.parse(DEFAULT_TWIN_HUMAN_ASSET);
    expect(asset.url).toBe("/models/twin-human.glb");
    expect(asset.version).toBe("photoreal-human-1");
  });

  it("rejects invalid visual calibration scale", () => {
    expect(() =>
      TwinHumanAssetSchema.parse({
        ...DEFAULT_TWIN_HUMAN_ASSET,
        scale: 0,
      }),
    ).toThrow();
  });
});
