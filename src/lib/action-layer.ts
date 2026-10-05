import type { TKey } from "./i18n";

export const CONTEXT_ACTIONS = [
  {
    to: "/training",
    label: "action.startWorkout",
    description: "action.startWorkout.d",
    intent: "workout",
  },
  { to: "/app", label: "action.checkIn", description: "action.checkIn.d", intent: "checkin" },
  {
    to: "/app",
    label: "action.logFood",
    description: "action.logFood.d",
    intent: "nutrition",
  },
  {
    to: "/ar",
    label: "action.scanMovement",
    description: "action.scanMovement.d",
    intent: "movement",
  },
  { to: "/coach", label: "action.askCoach", description: "action.askCoach.d", intent: "coach" },
] as const satisfies readonly { to: string; label: TKey; description: TKey; intent: string }[];

export type ContextAction = (typeof CONTEXT_ACTIONS)[number];

export type ProductWorld = "today" | "twin" | "lab" | "coach";

const WORLD_ACTION_ORDER: Record<ProductWorld, readonly ContextAction["intent"][]> = {
  today: ["workout", "checkin", "nutrition", "movement", "coach"],
  twin: ["movement", "workout", "checkin", "coach", "nutrition"],
  lab: ["coach", "checkin", "workout", "nutrition", "movement"],
  coach: ["workout", "checkin", "nutrition", "movement", "coach"],
};

export function contextualActionsFor(world: ProductWorld): readonly ContextAction[] {
  const order = WORLD_ACTION_ORDER[world];
  return [...CONTEXT_ACTIONS].sort((a, b) => order.indexOf(a.intent) - order.indexOf(b.intent));
}
