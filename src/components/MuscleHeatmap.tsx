import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

export interface MuscleGroupStatus {
  key: string;
  name: string;
  volumeKg: number;
  recoveryPct: number; // 0 (fatigued) to 100 (fully recovered)
  lastHours: number | null;
}

const HALF_LIFE_HOURS = 40; // fatigue decays with this time constant
const VOLUME_FATIGUE_FACTOR = 7; // fatigue points per ton of fresh volume

export const MuscleHeatmap: React.FC = () => {
  const { t } = useI18n();
  const { user } = useAuth();

  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ["muscle-heatmap", user?.id, since.slice(0, 10)],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: logs }, { data: exercises }] = await Promise.all([
        supabase
          .from("set_logs")
          .select("exercise_slug, reps, weight_kg, done, created_at")
          .eq("user_id", user!.id)
          .gte("created_at", since),
        supabase.from("exercises").select("slug, muscle_group"),
      ]);
      return { logs: logs ?? [], exercises: exercises ?? [] };
    },
  });

  const muscles: MuscleGroupStatus[] = useMemo(() => {
    if (!data) return [];
    const groupBySlug = new Map<string, string>();
    for (const e of data.exercises) groupBySlug.set(e.slug, e.muscle_group);

    const acc = new Map<string, { volume: number; fatigue: number; lastHours: number | null }>();
    const now = Date.now();

    for (const log of data.logs) {
      if (log.done === false) continue;
      const group = groupBySlug.get(log.exercise_slug);
      if (!group) continue;
      const reps = Number(log.reps ?? 0);
      const weight = Number(log.weight_kg ?? 0);
      const volume = reps * weight;
      const hours = Math.max(0, (now - new Date(log.created_at).getTime()) / 3_600_000);
      const entry = acc.get(group) ?? { volume: 0, fatigue: 0, lastHours: null };
      entry.volume += volume;
      entry.fatigue += (volume / 1000) * Math.exp(-hours / HALF_LIFE_HOURS) * VOLUME_FATIGUE_FACTOR;
      entry.lastHours = entry.lastHours === null ? hours : Math.min(entry.lastHours, hours);
      acc.set(group, entry);
    }

    return [...acc.entries()]
      .map(([key, v]) => ({
        key,
        name: t(`mg.${key}` as TKey),
        volumeKg: Math.round(v.volume),
        recoveryPct: Math.max(0, Math.min(100, Math.round(100 - v.fatigue))),
        lastHours: v.lastHours === null ? null : Math.round(v.lastHours),
      }))
      .sort((a, b) => a.recoveryPct - b.recoveryPct);
  }, [data, t]);

  return (
    <div className="p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            {t("tl.heat.title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("tl.heat.subtitle")}</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : muscles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("tl.heat.empty")}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {muscles.map((m) => (
            <div
              key={m.key}
              className="p-3.5 rounded-2xl bg-surface border border-border space-y-2"
            >
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-foreground">{m.name}</span>
                <span className="font-mono text-muted-foreground">
                  {m.volumeKg >= 1000 ? `${(m.volumeKg / 1000).toFixed(1)} t` : `${m.volumeKg} kg`}
                </span>
              </div>
              <div className="w-full bg-surface-2 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    m.recoveryPct >= 80
                      ? "bg-emerald-400"
                      : m.recoveryPct >= 55
                        ? "bg-amber-400"
                        : "bg-rose-500"
                  }`}
                  style={{ width: `${m.recoveryPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                <span>
                  {t("tl.heat.recoveryStatus")}
                  {m.lastHours !== null
                    ? ` · ${t("tl.heat.lastTrained").replace("{h}", String(m.lastHours))}`
                    : ""}
                </span>
                <span
                  className={
                    m.recoveryPct >= 80
                      ? "text-primary"
                      : m.recoveryPct >= 55
                        ? "text-accent"
                        : "text-rose-400"
                  }
                >
                  {m.recoveryPct >= 80
                    ? t("tl.heat.ready")
                    : m.recoveryPct >= 55
                      ? t("tl.heat.optimal")
                      : t("tl.heat.fatigued")}{" "}
                  ({m.recoveryPct}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
