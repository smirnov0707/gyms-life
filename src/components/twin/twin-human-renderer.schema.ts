import { z } from "zod";

/**
 * Visual representation only. This contract must never be interpreted as a
 * measured body scan, body-composition estimate or physiological observation.
 */
export const TwinHumanRendererModeSchema = z.enum(["photoreal", "schematic"]);

export const TwinHumanAssetSchema = z
  .object({
    version: z.string().trim().min(1).max(80),
    url: z.string().trim().min(1).max(500),
    /**
     * Asset-space transform needed to align the visible human with the stable
     * analytical hit-map. It is visual calibration only.
     */
    position: z.tuple([z.number(), z.number(), z.number()]),
    rotation: z.tuple([z.number(), z.number(), z.number()]),
    scale: z.number().positive().max(100),
  })
  .strict();

export const DEFAULT_TWIN_HUMAN_ASSET = TwinHumanAssetSchema.parse({
  version: "photoreal-human-1",
  url: "/models/twin-human.glb",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
});

export type TwinHumanRendererMode = z.infer<typeof TwinHumanRendererModeSchema>;
export type TwinHumanAsset = z.infer<typeof TwinHumanAssetSchema>;
