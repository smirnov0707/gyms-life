import React, { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Activity, CalendarClock, Loader2, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n, type TKey } from "@/lib/i18n";
import { analyzeSupplementCycles, type CycleAdvice } from "@/lib/supplement-cycle.functions";

const STATUS_STYLE: Record<string, string> = {
  continue: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  cycle_soon: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  break_now: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  reduce: "bg-sky-500/10 text-sky-400 border-sky-500/30",
};

export const SupplementCycleAdvisor: React.FC = () => {
  const { t, lang } = useI18n();
  const run = useServerFn(analyzeSupplementCycles);
  const [advice, setAdvice] = useState<CycleAdvice | null>(null);
  const [empty, setEmpty] = useState(false);

  const analyze = useMutation({
    mutationFn: async () => run({ data: { lang } }),
    onSuccess: (res) => {
      if (res.empty) {
        setEmpty(true);
        setAdvice(null);
      } else {
        setEmpty(false);
        setAdvice(res.advice);
      }
    },
    onError: () => toast.error(t("supp.cycle.failed")),
  });

  return (
    <section className="panel grid gap-4 p-5">
      <div className="flex items-start gap-2.5">
        <div className="rounded-xl border border-primary/20 bg-primary/10 p-2 text-primary">
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
            {t("supp.cycle.title")} <Sparkles className="size-4 text-primary" />
          </h2>
          <p className="text-xs text-muted-foreground">{t("supp.cycle.sub")}</p>
        </div>
      </div>

      {empty && <p className="text-sm text-muted-foreground">{t("supp.cycle.empty")}</p>}

      {advice && (
        <div className="grid gap-3">
          <p className="text-sm text-foreground">{advice.summary}</p>

          <div className="grid gap-1.5">
            <div className="flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5 text-primary" />
                {t("supp.cycle.adherence")}
              </span>
              <span className="font-mono font-bold text-foreground">
                {Math.max(0, Math.min(100, Math.round(advice.adherence)))}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.max(0, Math.min(100, Math.round(advice.adherence)))}%` }}
              />
            </div>
          </div>

          <ul className="grid gap-2">
            {advice.items.map((item, i) => (
              <li key={`${item.name}-${i}`} className="rounded-2xl border border-border bg-surface p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold">{item.name}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      STATUS_STYLE[item.status] ?? STATUS_STYLE["continue"]
                    }`}
                  >
                    {t(`supp.cycle.status.${item.status}` as TKey)}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{item.reason}</p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2 font-mono text-[10px] text-muted-foreground">
                  <span>{t("supp.cycle.daysOn").replace("{n}", String(Math.max(0, Math.round(item.daysOn))))}</span>
                  {item.status !== "continue" && item.breakLengthDays > 0 && (
                    <>
                      <span>{t("supp.cycle.breakIn").replace("{n}", String(Math.max(0, Math.round(item.breakInDays))))}</span>
                      <span className="text-foreground">
                        {t("supp.cycle.breakLen").replace("{n}", String(Math.round(item.breakLengthDays)))}
                      </span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {advice.progress.length > 0 && (
            <div className="grid gap-1.5 rounded-2xl border border-border bg-surface p-3.5">
              <h3 className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                <TrendingUp className="size-3.5 text-primary" />
                {t("supp.cycle.progress")}
              </h3>
              <ul className="grid gap-1">
                {advice.progress.map((p, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    · {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Button onClick={() => analyze.mutate()} disabled={analyze.isPending} className="press">
        {analyze.isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            {t("supp.cycle.running")}
          </>
        ) : advice || empty ? (
          <>
            <RefreshCw className="size-4" />
            {t("supp.cycle.rerun")}
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            {t("supp.cycle.run")}
          </>
        )}
      </Button>
    </section>
  );
};
