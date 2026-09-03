import {
  calculatedMemoryValueForTransparency,
  type UserMemoryTransparencyItem,
} from "./user-memory.schema";

type MemoryPresentationItem = Pick<
  UserMemoryTransparencyItem,
  "content" | "source" | "calculatedValue"
>;

/** Renders app-owned evidence in the user's language without trusting free-form content. */
export function displayedMemoryContent(memory: MemoryPresentationItem, lang: string): string {
  const value = calculatedMemoryValueForTransparency(memory);
  if (value === null) return memory.content;

  if (lang === "en") {
    switch (value.kind) {
      case "training_consistency_28d":
        return `You completed ${value.sessionsLast28Days} workouts in the last ${value.windowDays} days.`;
      case "recovery_low_7d":
        return `Your average readiness was ${value.averageReadiness}/100 in the last ${value.windowDays} days.`;
      case "weight_change_30d":
        return `Your recorded weight changed by ${value.weightChangeKg > 0 ? "+" : ""}${value.weightChangeKg.toFixed(1)} kg in the last ${value.windowDays} days.`;
      case "nutrition_logging_14d":
        return `You logged nutrition on ${value.loggedDaysLast14Days} of the last ${value.windowDays} days.`;
    }
  }

  if (lang !== "lt") return memory.content;

  switch (value.kind) {
    case "training_consistency_28d":
      return `Per pastarąsias ${value.windowDays} dienas atlikai ${value.sessionsLast28Days} treniruotes.`;
    case "recovery_low_7d":
      return `Per pastarąsias ${value.windowDays} dienas vidutinis tavo pasiruošimas buvo ${value.averageReadiness}/100.`;
    case "weight_change_30d":
      return `Per pastarąsias ${value.windowDays} dienas užregistruotas svorio pokytis: ${value.weightChangeKg > 0 ? "+" : ""}${value.weightChangeKg.toFixed(1)} kg.`;
    case "nutrition_logging_14d":
      return `Per pastarąsias ${value.windowDays} dienas mitybą užregistravai ${value.loggedDaysLast14Days} dienų.`;
  }
}

/** Explains observed records without exposing database IDs or raw rows. */
export function memoryEvidenceSummary(memory: MemoryPresentationItem, lang: string): string | null {
  const value = calculatedMemoryValueForTransparency(memory);
  if (value === null) return null;

  if (lang === "en") {
    switch (value.kind) {
      case "training_consistency_28d":
        return `Evidence: ${value.sessionsLast28Days} completed workout records across ${value.windowDays} days.`;
      case "recovery_low_7d":
        return `Evidence: ${value.checkinsLast7Days} readiness check-ins across ${value.windowDays} days.`;
      case "weight_change_30d":
        return `Evidence: ${value.measurementsLast30Days} weight measurements across ${value.windowDays} days.`;
      case "nutrition_logging_14d":
        return `Evidence: nutrition logged on ${value.loggedDaysLast14Days} days across ${value.windowDays} days.`;
    }
  }

  if (lang !== "lt") return null;

  switch (value.kind) {
    case "training_consistency_28d":
      return `Įrodymai: ${value.sessionsLast28Days} baigtų treniruočių įrašai per ${value.windowDays} dienas.`;
    case "recovery_low_7d":
      return `Įrodymai: ${value.checkinsLast7Days} pasiruošimo check-in'ai per ${value.windowDays} dienas.`;
    case "weight_change_30d":
      return `Įrodymai: ${value.measurementsLast30Days} svorio matavimai per ${value.windowDays} dienas.`;
    case "nutrition_logging_14d":
      return `Įrodymai: mityba užregistruota ${value.loggedDaysLast14Days} dienų per ${value.windowDays} dienas.`;
  }
}
