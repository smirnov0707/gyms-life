import React, { useState } from "react";
import { Flame, Scale, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";

export const DynamicTDEECalculator: React.FC = () => {
  const { t } = useI18n();
  const [targetKcal, setTargetKcal] = useState<number>(2400);
  const [adjusted, setAdjusted] = useState(false);

  const avgWeightChange = -0.35; // kg per week
  const avgIntake = 2380;
  const calculatedTDEE = 2730; // dynamic estimate

  const handleAutoAdjust = () => {
    setTargetKcal(2250);
    setAdjusted(true);
  };

  return (
    <div className="p-5 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent/10 text-accent border border-amber-500/20">
            <Flame className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t("ms.tdee.title")}</h3>
            <p className="text-xs text-muted-foreground">{t("ms.tdee.subtitle")}</p>
          </div>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-surface border border-border text-accent">
          TDEE: ~{calculatedTDEE} kcal
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 text-center">
        <div className="p-3 rounded-2xl bg-surface border border-border">
          <span className="block text-[10px] uppercase font-mono text-muted-foreground">{t("ms.tdee.avgIntake")}</span>
          <span className="font-bold text-sm text-foreground">{avgIntake} kcal</span>
        </div>
        <div className="p-3 rounded-2xl bg-surface border border-border">
          <span className="block text-[10px] uppercase font-mono text-muted-foreground">{t("ms.tdee.weeklyChange")}</span>
          <span className="font-bold text-sm text-primary">{avgWeightChange} kg</span>
        </div>
        <div className="p-3 rounded-2xl bg-surface border border-border">
          <span className="block text-[10px] uppercase font-mono text-muted-foreground">{t("ms.tdee.dailyTarget")}</span>
          <span className="font-bold text-sm text-indigo-400">{targetKcal} kcal</span>
        </div>
      </div>

      <Button
        onClick={handleAutoAdjust}
        disabled={adjusted}
        size="sm"
        className={`w-full font-bold rounded-2xl transition-all ${
          adjusted
            ? "bg-emerald-950/60 border border-emerald-500/40 text-primary"
            : "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-background"
        }`}
      >
        <RefreshCw className="w-4 h-4 mr-1.5" />
        {adjusted ? t("ms.tdee.adjustedLabel") : t("ms.tdee.adjustButton")}
      </Button>
    </div>
  );
};
