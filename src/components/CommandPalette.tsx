import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Apple,
  Box,
  Dumbbell,
  HeartPulse,
  LineChart,
  MessageSquare,
  Trophy,
  Sparkles,
  UtensilsCrossed,
  Bell,
  Pill,
} from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const items: { to: string; key: TKey; icon: typeof Activity }[] = [
  { to: "/app", key: "nav.dashboard", icon: Activity },
  { to: "/exercises", key: "nav.exercises", icon: Dumbbell },
  { to: "/ar", key: "ar.title", icon: Box },
  { to: "/meal-plan", key: "mp.title", icon: UtensilsCrossed },
  { to: "/nutrition", key: "nut.title", icon: Apple },
  { to: "/supplements", key: "supp.title", icon: Pill },
  { to: "/achievements", key: "ach.title", icon: Trophy },
  { to: "/progress", key: "nav.progress", icon: LineChart },

  { to: "/readiness", key: "rd.title", icon: HeartPulse },
  { to: "/coach", key: "nav.coach", icon: MessageSquare },
  { to: "/coach-history", key: "coach.history", icon: MessageSquare },

  { to: "/reminders", key: "rem.title", icon: Bell },
  { to: "/onboarding", key: "dash.regenerate", icon: Sparkles },
];

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}

export function CommandPalette({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t("cmd.ph")} />
      <CommandList>
        <CommandEmpty>{t("cmd.empty")}</CommandEmpty>
        <CommandGroup heading={t("cmd.nav")}>
          {items.map((item) => (
            <CommandItem
              key={item.to}
              value={t(item.key)}
              onSelect={() => {
                setOpen(false);
                navigate({ to: item.to });
              }}
            >
              <item.icon className="mr-2 size-4 text-primary" />
              {t(item.key)}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
