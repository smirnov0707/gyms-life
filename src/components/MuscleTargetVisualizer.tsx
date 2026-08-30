import React from "react";
import { Target, Zap, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface MuscleTargetVisualizerProps {
  muscleGroup: string;
}

export const MuscleTargetVisualizer: React.FC<MuscleTargetVisualizerProps> = ({ muscleGroup }) => {
  const { t } = useI18n();

  const MUSCLE_DATA: Record<string, { primary: string; synergists: string; stabilizers: string }> = {
    legs: {
      primary: t("tl.mtv.legs.primary"),
      synergists: t("tl.mtv.legs.synergists"),
      stabilizers: t("tl.mtv.legs.stabilizers"),
    },
    chest: {
      primary: t("tl.mtv.chest.primary"),
      synergists: t("tl.mtv.chest.synergists"),
      stabilizers: t("tl.mtv.chest.stabilizers"),
    },
    back: {
      primary: t("tl.mtv.back.primary"),
      synergists: t("tl.mtv.back.synergists"),
      stabilizers: t("tl.mtv.back.stabilizers"),
    },
    shoulders: {
      primary: t("tl.mtv.shoulders.primary"),
      synergists: t("tl.mtv.shoulders.synergists"),
      stabilizers: t("tl.mtv.shoulders.stabilizers"),
    },
    arms: {
      primary: t("tl.mtv.arms.primary"),
      synergists: t("tl.mtv.arms.synergists"),
      stabilizers: t("tl.mtv.arms.stabilizers"),
    },
    core: {
      primary: t("tl.mtv.core.primary"),
      synergists: t("tl.mtv.core.synergists"),
      stabilizers: t("tl.mtv.core.stabilizers"),
    },
  };

  const data = MUSCLE_DATA[muscleGroup] || {
    primary: t("tl.mtv.defaultPrimary"),
    synergists: t("tl.mtv.defaultSynergists"),
    stabilizers: t("tl.mtv.defaultStabilizers"),
  };

  return (
    <div className="p-5 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-3.5">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">{t("tl.mtv.title")}</h3>
      </div>

      <div className="space-y-2 text-xs">
        <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/30">
          <span className="block text-[10px] font-mono font-bold uppercase text-indigo-400">{t("tl.mtv.primaryLabel")}</span>
          <p className="font-bold text-foreground mt-0.5">{data.primary}</p>
        </div>

        <div className="p-3 rounded-2xl bg-surface border border-border">
          <span className="block text-[10px] font-mono font-bold uppercase text-accent">{t("tl.mtv.synergistsLabel")}</span>
          <p className="text-foreground mt-0.5">{data.synergists}</p>
        </div>

        <div className="p-3 rounded-2xl bg-surface border border-border">
          <span className="block text-[10px] font-mono font-bold uppercase text-teal-400">{t("tl.mtv.stabilizersLabel")}</span>
          <p className="text-foreground mt-0.5">{data.stabilizers}</p>
        </div>
      </div>
    </div>
  );
};
