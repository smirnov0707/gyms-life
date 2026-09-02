import React, { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Flame, Loader2, Play, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ExerciseVideo } from "./ExerciseVideo";
import { getSmartWarmup } from "@/lib/coach-session.functions";
import type { SmartWarmup } from "@/lib/coach-session.functions";
import { useI18n } from "@/lib/i18n";
import { aiErrorMessage } from "@/lib/ai-error";

export interface DynamicWarmupGeneratorProps {
  focus?: string;
  exercises?: string[];
}

/** Session-specific warm-up: the coach builds it from today's lifts, then shows each drill on video. */
export const DynamicWarmupGenerator: React.FC<DynamicWarmupGeneratorProps> = ({
  focus = "",
  exercises = [],
}) => {
  const { t, lang } = useI18n();
  const build = useServerFn(getSmartWarmup);
  const [data, setData] = useState<SmartWarmup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [videoSlug, setVideoSlug] = useState<string | null>(null);

  const key = `${lang}|${focus}|${exercises.join(",")}`;

  const run = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await build({ data: { focus, exercises, lang } });
      setData(res);
      setDone([]);
    } catch (err) {
      setError(aiErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    void run();
  }, [run]);

  const toggle = (slug: string) =>
    setDone((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const progress = data?.drills.length ? Math.round((done.length / data.drills.length) * 100) : 0;

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-accent/25 bg-accent/10 p-2.5 text-accent">
            <Flame className="size-5" />
          </div>
          <div>
            <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider">
              {t("wu.title")} <Sparkles className="size-4 text-accent" />
            </h3>
            <p className="text-xs text-muted-foreground">
              {data ? data.headline : t("wu.building")}
              {data ? ` · ${data.minutes} min` : ""}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={() => void run()} aria-label={t("wu.regen")}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        </Button>
      </div>

      {data?.readiness != null && (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-bold uppercase tracking-wide">{t("wu.why")}: </span>
          {t("wu.readiness")} {data.readiness}/100
        </p>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {loading && !data && (
        <div className="grid gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>

          <div className="grid gap-2.5">
            {data.drills.map((d) => {
              const isDone = done.includes(d.slug);
              return (
                <div
                  key={d.slug}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 transition-colors ${
                    isDone
                      ? "border-primary/40 bg-primary/5 opacity-80"
                      : "border-border bg-surface-2"
                  }`}
                >
                  <button
                    onClick={() => toggle(d.slug)}
                    aria-label={d.name}
                    className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border transition-colors ${
                      isDone
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-transparent"
                    }`}
                  >
                    <Check className="size-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-bold ${isDone ? "line-through text-muted-foreground" : ""}`}
                    >
                      {d.name}
                    </p>
                    <p className="font-mono text-xs text-accent">
                      {d.dose} · <span className="text-muted-foreground">{d.focus}</span>
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                      <span className="font-bold uppercase tracking-wide">{t("wu.why")}: </span>
                      {d.why}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setVideoSlug(d.slug)}>
                    <Play className="mr-1 size-3" /> {t("w.watch")}
                  </Button>
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={!!videoSlug} onOpenChange={(o) => !o && setVideoSlug(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {data?.drills.find((d) => d.slug === videoSlug)?.name ?? t("w.watch")}
            </DialogTitle>
          </DialogHeader>
          {videoSlug && (
            <ExerciseVideo
              slug={videoSlug}
              title={data?.drills.find((d) => d.slug === videoSlug)?.name ?? ""}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
