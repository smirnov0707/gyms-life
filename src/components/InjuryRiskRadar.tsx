import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck, ShieldQuestion } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { buildRiskReport, type RiskLevel } from "@/lib/injury-risk";
import { cn } from "@/lib/utils";

const TONE: Record<RiskLevel, string> = {
  low: "text-primary border-primary/30 bg-primary/10",
  moderate: "text-accent border-accent/30 bg-accent/10",
  high: "text-destructive border-destructive/30 bg-destructive/10",
};

export function InjuryRiskRadar() {
  const { t } = useI18n();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["injury-risk", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const [sets, sessions, checkins] = await Promise.all([
        supabase
          .from("set_logs")
          .select("created_at, exercise_slug, exercise_name, weight_kg, reps")
          .eq("user_id", user!.id)
          .gte("created_at", since)
          .order("created_at", { ascending: true }),
        supabase
          .from("workout_sessions")
          .select("started_at, total_volume")
          .eq("user_id", user!.id)
          .gte("started_at", since),
        supabase
          .from("daily_checkins")
          .select("checkin_on, soreness, readiness_score")
          .eq("user_id", user!.id)
          .order("checkin_on", { ascending: false })
          .limit(14),
      ]);
      return buildRiskReport(sets.data ?? [], sessions.data ?? [], checkins.data ?? []);
    },
  });

  const level = data?.level ?? "low";
  const Icon = !data?.hasData ? ShieldQuestion : level === "low" ? ShieldCheck : ShieldAlert;

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-xl border p-2", TONE[level])}>
            <Icon className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">{t("nx.risk.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("nx.risk.subtitle")}</p>
          </div>
        </div>
        {data?.hasData && (
          <div className="text-right">
            <span className="block text-[10px] font-mono uppercase text-muted-foreground">
              {t("nx.risk.score")}
            </span>
            <span className={cn("text-display text-2xl", TONE[level].split(" ")[0])}>
              {data.score}/100 · {t(`nx.risk.${level}` as never)}
            </span>
          </div>
        )}
      </div>

      {!data?.hasData || !data.factors.length ? (
        <p className="text-xs text-muted-foreground">{t("nx.risk.empty")}</p>
      ) : (
        <>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                level === "low" ? "bg-primary" : level === "moderate" ? "bg-accent" : "bg-destructive",
              )}
              style={{ width: `${Math.max(4, data.score)}%` }}
            />
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {data.factors.map((f) => (
              <div key={f.key} className="space-y-1 rounded-2xl border border-border bg-surface-2 p-3 text-xs">
                <div className="flex items-center justify-between gap-2 font-semibold">
                  <span>{t(f.key as never)}</span>
                  <span className={cn("font-mono", TONE[f.level].split(" ")[0])}>{f.value}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{t(f.adviceKey as never)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
