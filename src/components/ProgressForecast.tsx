import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { LineChart, Loader2, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n, type TKey } from "@/lib/i18n";
import { aiErrorMessage } from "@/lib/ai-error";
import { forecastProgress } from "@/lib/forecast.functions";
import { cn } from "@/lib/utils";

type Lift = {
  name: string;
  current1rm: number;
  projected4w: number;
  projected12w: number;
  nextWorkingWeight: number;
  trend: "rising" | "flat" | "falling";
  plateauRisk: number;
  note: string;
};

const forecastMetricKeys = ["nx.fc.now", "nx.fc.in4", "nx.fc.in12", "nx.fc.next"] satisfies TKey[];

export function ProgressForecast() {
  const { t, lang } = useI18n();
  const run = useServerFn(forecastProgress);
  const [loading, setLoading] = useState(false);
  const [lifts, setLifts] = useState<Lift[] | null>(null);
  const [summary, setSummary] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [empty, setEmpty] = useState(false);

  const go = async () => {
    setLoading(true);
    try {
      const res = await run({ data: { lang } });
      if (!res.ok) {
        setEmpty(true);
        setLifts(null);
        return;
      }
      setEmpty(false);
      setLifts(res.lifts as Lift[]);
      setSummary(res.summary);
      setActions(res.actions);
    } catch (error) {
      toast.error(aiErrorMessage(error, t));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-primary/25 bg-primary/10 p-2 text-primary">
            <LineChart className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">{t("nx.fc.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("nx.fc.subtitle")}</p>
          </div>
        </div>
        <Button size="sm" onClick={go} disabled={loading} className="font-bold">
          {loading ? (
            <Loader2 className="mr-1 size-4 animate-spin" />
          ) : (
            <Sparkles className="mr-1 size-4" />
          )}
          {loading ? t("nx.fc.loading") : lifts ? t("nx.fc.again") : t("nx.fc.run")}
        </Button>
      </div>

      {empty && <p className="text-xs text-muted-foreground">{t("nx.fc.empty")}</p>}

      {lifts?.length ? (
        <div className="grid gap-3">
          {lifts.map((l) => {
            const Trend =
              l.trend === "rising" ? TrendingUp : l.trend === "falling" ? TrendingDown : Minus;
            const tone =
              l.trend === "rising"
                ? "text-primary"
                : l.trend === "falling"
                  ? "text-destructive"
                  : "text-accent";
            return (
              <div key={l.name} className="rounded-2xl border border-border bg-surface-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold uppercase tracking-wide">{l.name}</h4>
                  <span className={cn("flex items-center gap-1 font-mono text-xs", tone)}>
                    <Trend className="size-4" /> {t("nx.fc.trend")}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[l.current1rm, l.projected4w, l.projected12w, l.nextWorkingWeight].map(
                    (value, index) => {
                      const key = forecastMetricKeys[index];
                      if (!key) return null;
                      return (
                        <div key={key} className="rounded-xl bg-surface p-2">
                          <div className="text-display text-xl text-foreground">{value} kg</div>
                          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            {t(key)}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="uppercase tracking-widest">{t("nx.fc.plateau")}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        l.plateauRisk > 60 ? "bg-destructive" : "bg-accent",
                      )}
                      style={{ width: `${Math.max(4, Math.min(100, l.plateauRisk))}%` }}
                    />
                  </div>
                  <span className="font-mono">{Math.round(l.plateauRisk)}%</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{l.note}</p>
              </div>
            );
          })}

          {summary && (
            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <p className="text-[10px] uppercase tracking-widest text-primary">
                {t("nx.fc.summary")}
              </p>
              <p className="mt-1 text-sm">{summary}</p>
              {actions.length > 0 && (
                <>
                  <p className="mt-3 text-[10px] uppercase tracking-widest text-primary">
                    {t("nx.fc.actions")}
                  </p>
                  <ul className="mt-1 grid gap-1 text-sm">
                    {actions.map((a) => (
                      <li key={a}>→ {a}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
