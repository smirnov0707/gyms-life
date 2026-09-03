import { z } from "zod";
import { DigitalAthleteStateSchema } from "./digital-athlete.schema";
import { UserMemoryTransparencyItemResultSchema } from "./user-memory.schema";
import {
  WeeklyIntelligenceReviewSchema,
  type WeeklyIntelligenceAction,
  type WeeklyIntelligenceReview,
} from "./weekly-intelligence.schema";

const WeeklyIntelligenceInputSchema = z
  .object({
    state: DigitalAthleteStateSchema,
    memories: z.array(UserMemoryTransparencyItemResultSchema).max(50),
  })
  .strict();

function nextActionFor(gaps: string[]): WeeklyIntelligenceAction {
  if (gaps.includes("no_completed_workouts_28d")) return "start_training";
  if (gaps.includes("no_recovery_checkins_7d")) return "check_readiness";
  if (gaps.includes("no_nutrition_logs_14d")) return "log_nutrition";
  if (gaps.includes("no_body_measurements_30d")) return "log_body_metrics";
  return "open_today";
}

/**
 * Produces a concise weekly story from the canonical athlete state and only
 * calculated memory that already passed its evidence threshold. It never asks
 * an AI provider to infer, rank, or manufacture discoveries.
 */
export function buildWeeklyIntelligenceReview(value: unknown): WeeklyIntelligenceReview {
  const input = WeeklyIntelligenceInputSchema.parse(value);
  const discoveries = input.memories
    .flatMap((memory) => {
      if (memory.source !== "calculated" || memory.calculatedValue === null) return [];
      return [
        {
          type: memory.type,
          content: memory.content,
          source: memory.source,
          confidence: memory.confidence,
          importance: memory.importance,
          calculatedValue: memory.calculatedValue,
        },
      ];
    })
    .sort((left, right) => right.importance - left.importance)
    .slice(0, 3);

  return WeeklyIntelligenceReviewSchema.parse({
    status: discoveries.length > 0 ? "ready" : "learning",
    thisWeek: {
      completedWorkouts: input.state.training.sessionsLast7Days,
      readinessCheckins: input.state.recovery.checkinsLast7Days,
      averageReadiness: input.state.recovery.averageReadinessLast7Days,
    },
    discoveries,
    nextAction: { action: nextActionFor(input.state.dataGaps) },
    stillLearning: input.state.dataGaps,
  });
}
