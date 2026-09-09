import { z } from "zod";

const coordinate = z.number().finite().min(-3).max(3);
const radius = z.number().finite().min(0.001).max(1);
const contourSchema = z
  .array(
    z.object({
      centre: z.tuple([coordinate, coordinate, coordinate]),
      radii: z.tuple([radius, radius, radius]),
      angle: z.number().finite().min(-Math.PI).max(Math.PI),
    }),
  )
  .min(1)
  .max(8);
export type TwinSculptContour = z.infer<typeof contourSchema>[number];

/** Only explicitly marked, byte-verified candidates call this parser. */
export function parseTwinSculptContours(value: unknown): TwinSculptContour[] {
  return contourSchema.parse(value);
}
