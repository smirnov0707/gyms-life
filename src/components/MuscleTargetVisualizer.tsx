import React from "react";

import { Target } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import { exerciseAnatomy } from "@/lib/exercise-anatomy";

export interface MuscleTargetVisualizerProps {
  slug?: string | null;
  muscleGroup: string;
}

export const MuscleTargetVisualizer: React.FC<MuscleTargetVisualizerProps> = ({
  slug,
  muscleGroup,
}) => {
  const { t } = useI18n();
  const data = exerciseAnatomy(slug, muscleGroup);

  // Nothing known about this movement. Cardio, mobility and full-body work
  // have no primary agonist to name, and the panel used to fill the gap with
  // three phrases shaped like anatomy — under the same headings as a real
  // entry, so there was no telling them apart.
  if (!data) return null;

  return (
    <div className="p-5 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-3.5">
      <div className="flex items-center gap-2">
        <Target className="w-5 h-5 text-indigo-400" />
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          {t("tl.mtv.title")}
        </h3>
      </div>

      {/* Said once, at the top: this is what exercises of this kind train,
          not what this particular movement was measured to train. */}
      {data.scope === "group" ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{t("tl.mtv.generic")}</p>
      ) : null}

      <div className="space-y-2 text-xs">
        <div className="p-3 rounded-2xl bg-indigo-950/30 border border-indigo-500/30">
          <span className="block text-[10px] font-mono font-bold uppercase text-indigo-400">
            {t("tl.mtv.primaryLabel")}
          </span>
          <p className="font-bold text-foreground mt-0.5">{data.primary}</p>
        </div>

        <div className="p-3 rounded-2xl bg-surface border border-border">
          <span className="block text-[10px] font-mono font-bold uppercase text-accent">
            {t("tl.mtv.synergistsLabel")}
          </span>
          <p className="text-foreground mt-0.5">{data.synergists}</p>
        </div>

        <div className="p-3 rounded-2xl bg-surface border border-border">
          <span className="block text-[10px] font-mono font-bold uppercase text-teal-400">
            {t("tl.mtv.stabilizersLabel")}
          </span>
          <p className="text-foreground mt-0.5">{data.stabilizers}</p>
        </div>
      </div>
    </div>
  );
};
