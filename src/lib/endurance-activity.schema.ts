import { z } from "zod";

export const EnduranceActivityKindSchema = z.enum(["run", "walk", "hike"]);
export const EnduranceEnvironmentSchema = z.enum(["outdoor", "treadmill", "indoor_track"]);
export const EnduranceSourceSchema = z.enum(["manual", "device", "wearable", "imported"]);

export const EnduranceActivitySchema = z
  .object({
    kind: EnduranceActivityKindSchema,
    environment: EnduranceEnvironmentSchema,
    source: EnduranceSourceSchema,
    startedAt: z.string().datetime({ offset: true }),
    durationSeconds: z.number().int().positive().max(60 * 60 * 24),
    distanceMeters: z.number().finite().positive().max(250_000).nullable(),
    averageHeartRateBpm: z.number().int().min(30).max(240).nullable().default(null),
    perceivedEffort: z.number().int().min(1).max(10).nullable().default(null),
  })
  .strict();

export type EnduranceActivity = z.infer<typeof EnduranceActivitySchema>;

export const RaceDistanceSchema = z.enum(["5k", "10k", "half_marathon", "marathon"]);
export type RaceDistance = z.infer<typeof RaceDistanceSchema>;

export const RACE_DISTANCE_METERS: Readonly<Record<RaceDistance, number>> = {
  "5k": 5_000,
  "10k": 10_000,
  half_marathon: 21_097.5,
  marathon: 42_195,
};
