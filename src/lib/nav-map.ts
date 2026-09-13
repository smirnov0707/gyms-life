import { Activity, FlaskConical, MessageSquare, PersonStanding } from "lucide-react";

export const PRIMARY_WORLD_NAV = [
  { to: "/app", icon: Activity, label: "TODAY" },
  { to: "/twin", icon: PersonStanding, label: "MY TWIN" },
  { to: "/lab", icon: FlaskConical, label: "LAB" },
  { to: "/coach", icon: MessageSquare, label: "COACH" },
] as const;
