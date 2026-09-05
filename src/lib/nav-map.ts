import {
  Activity,
  Apple,
  Bell,
  Box,
  Dumbbell,
  HeartPulse,
  LineChart,
  MessageSquare,
  Pill,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import type { TKey } from "./i18n";

export type NavItem = { to: string; key: TKey; icon: typeof Activity };

/**
 * Backs `byRoute` only. The primary bottom-tab bar (Today/Twin/Lab/Coach)
 * is defined once, in AppShell.tsx — this list is the secondary "More"
 * surface and its icon/label metadata, not a second definition of the
 * primary navigation.
 */
const nav: NavItem[] = [
  { to: "/app", key: "nav.dashboard", icon: Activity },
  { to: "/training", key: "nav.training", icon: Dumbbell },
  { to: "/exercises", key: "nav.exercises", icon: Dumbbell },
  { to: "/ar", key: "nav.ar", icon: Box },
  { to: "/meal-plan", key: "nav.meal", icon: UtensilsCrossed },
  { to: "/nutrition", key: "nav.nutrition", icon: Apple },
  { to: "/supplements", key: "nav.supplements", icon: Pill },
  { to: "/achievements", key: "ach.title", icon: Trophy },
  { to: "/progress", key: "nav.progress", icon: LineChart },
  { to: "/readiness", key: "rd.title", icon: HeartPulse },
  { to: "/coach", key: "nav.coach", icon: MessageSquare },
  { to: "/reminders", key: "nav.reminders", icon: Bell },
];

export const byRoute = (to: string) => nav.find((n) => n.to === to);

/** Logical clusters used by the "More" menu and the mobile drawer. */
export const NAV_GROUPS: { key: TKey; routes: string[] }[] = [
  { key: "nav.group.train", routes: ["/training", "/exercises", "/ar", "/readiness"] },
  { key: "nav.group.nutrition", routes: ["/meal-plan", "/nutrition", "/supplements"] },
  { key: "nav.group.body", routes: ["/progress", "/achievements"] },
  { key: "nav.group.coach", routes: ["/coach", "/reminders"] },
];

/**
 * Cross-feature links: what naturally comes next from each page.
 * Keeps every screen connected instead of being a dead end.
 */
export const RELATED: Record<string, string[]> = {
  "/app": ["/readiness", "/coach", "/meal-plan"],
  "/exercises": ["/ar", "/app", "/progress"],
  "/ar": ["/exercises", "/progress", "/coach"],
  "/meal-plan": ["/nutrition", "/supplements", "/progress"],
  "/nutrition": ["/meal-plan", "/supplements", "/coach"],
  "/supplements": ["/nutrition", "/progress", "/reminders"],
  "/progress": ["/readiness", "/coach", "/achievements"],
  "/readiness": ["/app", "/progress", "/coach"],
  "/coach": ["/app", "/progress", "/meal-plan"],
  "/achievements": ["/progress", "/app", "/coach"],
  "/reminders": ["/supplements", "/readiness", "/app"],
};
