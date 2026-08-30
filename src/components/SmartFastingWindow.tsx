import React from "react";
import { Clock, Zap, Flame, Utensils, Award, Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const SmartFastingWindow: React.FC = () => {
  const { t } = useI18n();
  return (
    <div className="p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-accent/10 text-accent border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              {t("ms.fasting.title")} <Sparkles className="w-4 h-4 text-accent" />
            </h3>
            <p className="text-xs text-muted-foreground">{t("ms.fasting.subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-surface border border-border space-y-1">
          <span className="block text-[10px] font-mono uppercase text-primary font-bold">{t("ms.fasting.refeedTitle")}</span>
          <div className="text-sm font-black text-foreground font-mono">18:00 – 20:30</div>
          <p className="text-[10px] text-muted-foreground leading-tight">{t("ms.fasting.refeedDesc")}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-surface border border-border space-y-1">
          <span className="block text-[10px] font-mono uppercase text-accent font-bold">{t("ms.fasting.fastingTitle")}</span>
          <div className="text-sm font-black text-foreground font-mono">20:30 – 12:30</div>
          <p className="text-[10px] text-muted-foreground leading-tight">{t("ms.fasting.fastingDesc")}</p>
        </div>

        <div className="p-3.5 rounded-2xl bg-surface border border-border space-y-1">
          <span className="block text-[10px] font-mono uppercase text-indigo-400 font-bold">{t("ms.fasting.superTitle")}</span>
          <div className="text-sm font-black text-foreground font-mono">{t("ms.fasting.superValue")}</div>
          <p className="text-[10px] text-muted-foreground leading-tight">{t("ms.fasting.superDesc")}</p>
        </div>
      </div>
    </div>
  );
};
