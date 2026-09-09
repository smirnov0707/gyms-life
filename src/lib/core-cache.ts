import type { QueryClient } from "@tanstack/react-query";

/** Invalidates domain read models after a committed write. Never clears offline sets. */
const GROUPS = {
  training: [
    "active-plan",
    "training-programmes",
    "plan",
    "plans",
    "todays-workout",
    "workout",
    "profile",
    "nutrition-profile",
    "fridge-profile",
    "training-intake",
  ],
  meals: ["meal-plan", "meal-plan-targets", "meal-plan-i18n", "meal-preferences", "profile"],
  nutrition: ["nutrition", "nutrition-logs", "nutrition-today"],
} as const;
const SHARED = [
  "today",
  "today-decision",
  "today-signals",
  "live-signals",
  "digital-athlete",
  "athlete-state",
  "twin-snapshot",
  "lab-overview",
  "daily-brief",
  "future-lab-overview",
  "todays-targets",
  "training-load",
  "performance-overview",
  "weekly-intelligence-review",
];
export async function refreshCoreData(
  client: QueryClient,
  domain: keyof typeof GROUPS,
): Promise<void> {
  const keys = new Set<string>([...GROUPS[domain], ...SHARED]);
  await client.invalidateQueries({
    predicate: (query) => typeof query.queryKey[0] === "string" && keys.has(query.queryKey[0]),
  });
}
