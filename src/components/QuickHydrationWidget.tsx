import React, { useEffect, useState } from "react";
import { Droplets, Plus, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { browserTimeZone, dayInTimeZone } from "@/lib/local-day";

const todayKey = () => dayInTimeZone(new Date(), browserTimeZone());
const storageKey = (userId: string) => `gymslife:hydration:${userId}:${todayKey()}`;

export const QuickHydrationWidget: React.FC<{ targetMl?: number }> = ({ targetMl = 3000 }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const [currentMl, setCurrentMl] = useState<number>(0);
  const [ready, setReady] = useState(false);

  // Load today's real intake (starts at 0 for a fresh day / fresh login).
  useEffect(() => {
    if (!user) return;
    try {
      const raw = window.localStorage.getItem(storageKey(user.id));
      const parsed = raw ? Number(raw) : 0;
      setCurrentMl(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    } catch {
      setCurrentMl(0);
    }
    setReady(true);
  }, [user]);

  const persist = (value: number) => {
    setCurrentMl(value);
    if (!user) return;
    try {
      window.localStorage.setItem(storageKey(user.id), String(value));
    } catch {
      /* storage unavailable — keep in-memory only */
    }
  };

  const addWater = (amount: number) => persist(Math.min(targetMl + 1000, currentMl + amount));
  const resetWater = () => persist(0);

  const percentage = Math.min(100, Math.round((currentMl / targetMl) * 100));

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-cyan-950/30 via-surface to-surface p-5 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Droplets className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
              {t("ms.hydration.title")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("ms.hydration.progress")
                .replace("{cur}", String(ready ? currentMl : 0))
                .replace("{target}", String(targetMl))
                .replace("{pct}", String(ready ? percentage : 0))}
            </p>
          </div>
        </div>
        <Button
          onClick={resetWater}
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>

      <div className="relative w-full h-3.5 bg-surface rounded-full overflow-hidden mb-4 border border-border">
        <div
          className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 rounded-full"
          style={{ width: `${ready ? percentage : 0}%` }}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[250, 500, 750].map((amount) => (
          <Button
            key={amount}
            onClick={() => addWater(amount)}
            variant="outline"
            size="sm"
            className="border-border bg-surface hover:bg-cyan-950/40 hover:border-cyan-500/40 text-foreground text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1 text-cyan-400" /> {amount} ml
          </Button>
        ))}
      </div>
    </div>
  );
};
