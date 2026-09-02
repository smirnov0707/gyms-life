import React from "react";
import { Activity, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";

export interface ReadinessBannerProps {
  score?: number;
  onApplyAdjustment?: () => void;
  isAdjusted?: boolean;
}

export const ReadinessBanner: React.FC<ReadinessBannerProps> = ({
  score = 62,
  onApplyAdjustment,
  isAdjusted = false,
}) => {
  const { t } = useI18n();
  if (score >= 75) return null;

  return (
    <div className="lift mb-6 flex flex-col items-start justify-between gap-4 rounded-2xl border border-accent/35 bg-surface/80 p-4 shadow-lg backdrop-blur-lg md:flex-row md:items-center">
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-accent/25 bg-accent/10 p-2.5 text-accent">
          <Activity className="h-5 w-5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wide text-accent">
              {t("ms.readiness.title").replace("{n}", String(score))}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("ms.readiness.desc")}</p>
        </div>
      </div>

      <Button
        onClick={onApplyAdjustment}
        disabled={isAdjusted}
        size="sm"
        className={`shrink-0 rounded-xl font-medium transition-all ${
          isAdjusted
            ? "border border-primary/40 bg-primary/15 text-primary"
            : "hard-shadow bg-accent font-semibold text-accent-foreground hover:brightness-110"
        }`}
      >
        {isAdjusted ? (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> {t("ms.readiness.adjusted")}
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4" /> {t("ms.readiness.apply")}
          </span>
        )}
      </Button>
    </div>
  );
};
