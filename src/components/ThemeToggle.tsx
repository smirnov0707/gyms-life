import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/lib/theme";
import { useI18n, type TKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const modes: { value: ThemeMode; icon: typeof Sun; key: TKey }[] = [
  { value: "light", icon: Sun, key: "theme.light" },
  { value: "dark", icon: Moon, key: "theme.dark" },
  { value: "system", icon: Monitor, key: "theme.system" },
];

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const { t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("theme.label")}
      className="inline-flex items-center rounded-full border border-border bg-surface p-0.5"
    >
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => setMode(m.value)}
          title={t(m.key)}
          aria-label={t(m.key)}
          aria-pressed={mode === m.value}
          className={cn(
            "grid size-7 place-items-center rounded-full transition-colors",
            mode === m.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <m.icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
