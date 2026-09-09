/**
 * Which AI tasks the athlete's central context is sent with — and the reason
 * this is not inside the orchestrator with the rest of the task policy.
 *
 * The privacy card on the Coach screen has always named two features: "Coach
 * and Daily Brief can send only 7/28/30-day summaries and up to 12 active
 * facts, preferences, and patterns." Seventeen tasks carry that context. A
 * person reading the card would reasonably conclude that generating a meal
 * plan, scanning a food photo or asking for exercise suggestions does not send
 * their summaries and their memory facts. All three do.
 *
 * The card was a hand-written list of two beside a table of twenty-six, so it
 * was wrong the moment a third task became personalized, and nothing could
 * notice. The scope now lives here, in a module the browser can import, so the
 * card counts the table instead of describing it from memory — the same reason
 * `COACH_HISTORY_TURNS` was pulled out of the query that used it.
 *
 * The orchestrator keeps the model routing. Scope is a privacy fact the
 * athlete is entitled to see; a model id is not, and must never reach the
 * browser bundle.
 */

/**
 * `personalized` — the central user context goes to the provider with this
 *                  task: 7/28/30-day summaries and up to 12 active memory
 *                  facts, as the consent describes.
 * `none`         — the task's own inputs and nothing else.
 */
export type AiContextScope = "none" | "personalized";

export const AI_TASK_CONTEXT_SCOPE = {
  "body-scan": "none",
  "coach.ask": "personalized",
  "coach.warmup": "personalized",
  "daily-brief": "personalized",
  dineout: "personalized",
  "exercise-filter": "none",
  "exercise-suggestion": "personalized",
  "food-vision": "personalized",
  "form-analysis": "none",
  fridge: "personalized",
  "meal-adaptation": "personalized",
  "meal-plan": "personalized",
  "meal-translation": "none",
  "medical-report": "none",
  micronutrients: "personalized",
  motivation: "personalized",
  "nutrition-analysis": "personalized",
  "plan-translation": "none",
  "supplement-cycle": "personalized",
  "supplement-vision": "none",
  "training-plan": "personalized",
  "voice-log-structuring": "none",
  "workout-request": "personalized",
  biomechanics: "none",
} as const satisfies Record<string, AiContextScope>;

export type ScopedAiTask = keyof typeof AI_TASK_CONTEXT_SCOPE;

/** Every task the athlete's context is sent with, for anything that discloses it. */
export const PERSONALIZED_AI_TASKS: readonly ScopedAiTask[] = (
  Object.keys(AI_TASK_CONTEXT_SCOPE) as ScopedAiTask[]
).filter((task) => AI_TASK_CONTEXT_SCOPE[task] === "personalized");

/**
 * The tasks the privacy card names by their product feature.
 *
 * Coach and the daily brief are three executable tasks between them, which is why the card
 * cannot say "and N−2 others" and be right. The rest are counted rather than
 * listed: seventeen task ids in a privacy card is not a disclosure anybody
 * reads, and a number that comes from the table is truer than a sentence
 * somebody has to remember to update.
 */
export const NAMED_AI_TASKS = [
  "coach.ask",
  "coach.warmup",
  "daily-brief",
] as const satisfies readonly ScopedAiTask[];

/** Personalized tasks beyond the ones the card names outright. */
export const OTHER_PERSONALIZED_AI_TASK_COUNT: number = PERSONALIZED_AI_TASKS.filter(
  (task) => !(NAMED_AI_TASKS as readonly string[]).includes(task),
).length;

/**
 * The rolling windows the athlete's summaries are measured over.
 *
 * The card said "7/28/30-day summaries". A fourteen-day one goes too —
 * `loggedDaysLast14Days`, how many days of the last fortnight carry a food log
 * — and it was simply not on the list. Nothing was hiding it; the list was
 * written by hand from the fields somebody remembered.
 *
 * A test walks the context schema for `Last<n>Days` fields and fails if a
 * window appears there that is missing here, so the sentence cannot fall
 * behind the payload again.
 */
export const AI_CONTEXT_WINDOW_DAYS: readonly number[] = [7, 14, 28, 30];

/** "7/14/28/30", for the sentence that has to name them. */
export const AI_CONTEXT_WINDOW_LABEL: string = AI_CONTEXT_WINDOW_DAYS.join("/");
