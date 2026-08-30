import React, { useState } from "react";
import { TrendingUp, Award, Zap, ArrowRight } from "lucide-react";
import { Slider } from "./ui/slider";
import { useI18n } from "@/lib/i18n";

export const TransformationCalculator: React.FC = () => {
  const { t } = useI18n();
  const [weeks, setWeeks] = useState<number>(12);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(4);

  const estimatedStrengthGain = Math.round(weeks * 2.1 * (daysPerWeek / 3));
  const estimatedKcalBurned = Math.round(weeks * daysPerWeek * 480);
  const consistencyScore = Math.min(99, Math.round(70 + (weeks * 1.5) + (daysPerWeek * 2.5)));

  return (
    <div className="my-10 p-6 md:p-8 rounded-3xl border border-border bg-gradient-to-b from-surface to-surface shadow-2xl backdrop-blur-xl">
      <div className="text-center max-w-xl mx-auto mb-8">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
          <Zap className="w-3.5 h-3.5" /> {t("tl.tc.badge")}
        </span>
        <h3 className="text-2xl md:text-3xl font-black text-foreground mt-2">{t("tl.tc.title")}</h3>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          {t("tl.tc.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 items-center max-w-4xl mx-auto">
        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-xs font-mono text-foreground mb-2">
              <span>{t("tl.tc.duration")}</span>
              <strong className="text-indigo-400 text-sm">{t("tl.tc.durationWeeks").replace("{n}", String(weeks))}</strong>
            </div>
            <Slider min={4} max={24} step={1} value={[weeks]} onValueChange={([v]) => setWeeks(v ?? 12)} />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono text-foreground mb-2">
              <span>{t("tl.tc.frequency")}</span>
              <strong className="text-indigo-400 text-sm">{t("tl.tc.frequencyPerWeek").replace("{n}", String(daysPerWeek))}</strong>
            </div>
            <Slider min={2} max={6} step={1} value={[daysPerWeek]} onValueChange={([v]) => setDaysPerWeek(v ?? 4)} />
          </div>
        </div>

        {/* Output Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="p-4 rounded-2xl bg-surface border border-border shadow-md">
            <span className="text-[10px] uppercase font-mono text-muted-foreground">{t("tl.tc.strengthGain")}</span>
            <div className="text-2xl font-black text-primary mt-1">+{estimatedStrengthGain}%</div>
            <span className="text-[10px] text-muted-foreground">{t("tl.tc.strengthGainSub")}</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-border shadow-md">
            <span className="text-[10px] uppercase font-mono text-muted-foreground">{t("tl.tc.kcalBurned")}</span>
            <div className="text-2xl font-black text-accent mt-1">{(estimatedKcalBurned / 1000).toFixed(1)}k</div>
            <span className="text-[10px] text-muted-foreground">{t("tl.tc.kcalBurnedSub")}</span>
          </div>
          <div className="p-4 rounded-2xl bg-surface border border-border shadow-md col-span-2">
            <span className="text-[10px] uppercase font-mono text-muted-foreground">{t("tl.tc.goalProbability")}</span>
            <div className="text-2xl font-black text-indigo-400 mt-1">{consistencyScore}%</div>
            <span className="text-[10px] text-muted-foreground">{t("tl.tc.goalProbabilitySub")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
