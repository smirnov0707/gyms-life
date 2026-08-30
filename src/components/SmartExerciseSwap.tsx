import React, { useState } from "react";
import { ArrowLeftRight, Check, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useI18n } from "@/lib/i18n";

export interface ExerciseSwapProps {
  currentExercise: string;
  muscleGroup?: string;
  onSwap: (newExercise: { name: string; slug: string }) => void;
}

export const SmartExerciseSwap: React.FC<ExerciseSwapProps> = ({ currentExercise, onSwap }) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const SWAP_DATABASE: Record<string, { name: string; slug: string; reason: string }[]> = {
    squat: [
      { name: t("tl.swap.squat1.name"), slug: "goblet-squat", reason: t("tl.swap.squat1.reason") },
      { name: t("tl.swap.squat2.name"), slug: "leg-press", reason: t("tl.swap.squat2.reason") },
      { name: t("tl.swap.squat3.name"), slug: "lunge", reason: t("tl.swap.squat3.reason") },
    ],
    "bench-press": [
      { name: t("tl.swap.bench1.name"), slug: "dumbbell-press", reason: t("tl.swap.bench1.reason") },
      { name: t("tl.swap.bench2.name"), slug: "push-up", reason: t("tl.swap.bench2.reason") },
    ],
    deadlift: [
      { name: t("tl.swap.deadlift1.name"), slug: "romanian-deadlift", reason: t("tl.swap.deadlift1.reason") },
      { name: t("tl.swap.deadlift2.name"), slug: "glute-bridge", reason: t("tl.swap.deadlift2.reason") },
    ],
  };

  const alternatives = SWAP_DATABASE[currentExercise] || [
    { name: t("tl.swap.default1.name"), slug: "dumbbell-press", reason: t("tl.swap.default1.reason") },
    { name: t("tl.swap.default2.name"), slug: "push-up", reason: t("tl.swap.default2.reason") },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-indigo-400">
          <ArrowLeftRight className="w-3.5 h-3.5 mr-1" /> {t("tl.swap.button")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-surface border-border text-foreground p-6 rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" /> {t("tl.swap.dialogTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          {alternatives.map((alt) => (
            <div
              key={alt.slug}
              onClick={() => {
                onSwap(alt);
                setOpen(false);
              }}
              className="p-3.5 rounded-2xl bg-surface border border-border hover:border-indigo-500/50 hover:bg-surface-2 cursor-pointer transition-all space-y-1"
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm text-foreground">{alt.name}</span>
                <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-mono">{t("tl.swap.match")}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{alt.reason}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};
