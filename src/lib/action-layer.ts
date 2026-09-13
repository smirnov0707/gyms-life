import type { TKey } from "./i18n";

export const CONTEXT_ACTIONS = [
  {
    to: "/training",
    label: "action.startWorkout",
    description: "action.startWorkout.d",
    intent: "workout",
  },
  { to: "/readiness", label: "action.checkIn", description: "action.checkIn.d", intent: "checkin" },
  {
    to: "/nutrition",
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
