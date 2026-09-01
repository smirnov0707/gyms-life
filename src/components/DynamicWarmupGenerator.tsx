import React, { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useI18n } from "@/lib/i18n";
import { generateDynamicWarmup } from "@/lib/warmup-fallback.server";
import { ExerciseVideo } from "@/components/ExerciseVideo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DynamicWarmupGenerator({
  muscleGroup,
  equipment,
  duration = 8,
}: {
  muscleGroup?: string;
  equipment?: string[];
  duration?: number;
}) {
  const { t } = useI18n();
  const generate = useServerFn(generateDynamicWarmup);
  const [data, setData] = useState<Awaited<ReturnType<typeof generate>> | null>(null);
  const [videoSlug, setVideoSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void generate({ data: { muscleGroup: muscleGroup ?? "full_body", equipment: equipment ?? [], duration } })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [duration, equipment, generate, muscleGroup]);

  return (
    <div className="grid gap-4">
      {data?.drills?.map((drill) => (
        <button key={drill.slug} type="button" onClick={() => setVideoSlug(drill.slug)} className="text-left">
          <span className="font-medium">{drill.name}</span>
        </button>
      ))}
      <Dialog open={!!videoSlug} onOpenChange={(o) => !o && setVideoSlug(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{data?.drills.find((d) => d.slug === videoSlug)?.name ?? t("w.watch")}</DialogTitle>
          </DialogHeader>
          <ExerciseVideo
            slug={videoSlug}
            muscleGroup="mobility"
            name={data?.drills.find((d) => d.slug === videoSlug)?.name ?? ""}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
