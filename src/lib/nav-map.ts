import {
  Activity,
  Apple,
  Box,
  Dumbbell,
  MessageSquare,
  FlaskConical,
  PersonStanding,
} from "lucide-react";
import type { TKey } from "./i18n";

export type NavItem = { to: string; key: TKey; icon: typeof Activity };

export const PRIMARY_WORLD_NAV = [
  { to: "/app", icon: Activity, label: "TODAY" },
  { to: "/twin", icon: PersonStanding, label: "MY TWIN" },
  { to: "/lab", icon: FlaskConical, label: "LAB" },
  { to: "/coach", icon: MessageSquare, label: "COACH" },
] as const;

/**
 * Backs `byRoute` only. The four primary product worlds are Today, Twin,
 * Lab and Coach. Everything below is a contextual tool, not another world.
 */
const nav: NavItem[] = [
  { to: "/app", key: "nav.dashboard", icon: Activity },
  { to: "/training", key: "nav.training", icon: Dumbbell },
  { to: "/exercises", key: "nav.exercises", icon: Dumbbell },
  { to: "/ar", key: "nav.ar", icon: Box },
  { to: "/nutrition", key: "nav.nutrition", icon: Apple },
];

export const byRoute = (to: string) => nav.find((n) => n.to === to);

/** Logical clusters used by the "More" menu and the mobile drawer. */
export const NAV_GROUPS: { key: TKey; routes: string[] }[] = [
  { key: "nav.group.train", routes: ["/training", "/exercises", "/ar"] },
  { key: "nav.group.nutrition", routes: ["/nutrition"] },
];
