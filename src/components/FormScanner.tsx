import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Loader2,
  Maximize2,
  Minimize2,
  ScanLine,
  ShieldAlert,
  Sparkles,
  SwitchCamera,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { analyzeForm } from "@/lib/smart.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useCameraStream } from "@/hooks/use-camera-stream";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { aiErrorMessage } from "@/lib/ai-error";
import { errorMessage } from "@/lib/error-message";

type Result = {
  score: number;
  verdict: string;
  good: string[];
  fixes: string[];
  drills: string[];
  risk: string;
};

/** Technique scanner: records a few frames and returns an AI form score. */
export function FormScanner() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const run = useServerFn(analyzeForm);
  const videoRef = useRef<HTMLVideoElement>(null);
  const {
    start: openCamera,
    stop: stopCamera,
    active: ready,
    busy: cameraBusy,
  } = useCameraStream(videoRef);
  const reviewRequest = useRef(0);
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("squat");
  const [result, setResult] = useState<Result | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [fullscreen]);

  useEffect(
    () => () => {
      reviewRequest.current++;
    },
    [],
  );

  const { data: exercises } = useQuery({
    queryKey: ["exercises"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exercises").select("slug, name_lt, name_en");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  // An empty list here reads as "you have never had your form analysed".
  const {
    data: history,
    refetch,
    isError: historyReadFailed,
  } = useQuery({
    queryKey: ["form-analyses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_analyses")
        .select("id, exercise_name, score, verdict, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });

  const exercise = exercises?.find((e) => e.slug === slug);
  const exerciseName = exercise ? (lang === "lt" ? exercise.name_lt : exercise.name_en) : slug;

  const enable = async () => {
    try {
      await openCamera(facing);
    } catch {
      toast.error(t("fc.denied"));
    }
  };

  const switchCamera = async () => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (!ready) return;
    try {
      await openCamera(next);
    } catch (error) {
      toast.error(errorMessage(error, t("fc.denied")));
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = Math.round((video.videoHeight / video.videoWidth) * 512) || 384;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  };

  const record = async () => {
    const request = ++reviewRequest.current;
    setBusy(true);
    setResult(null);
    const frames: string[] = [];
    try {
      for (let i = 0; i < 5; i++) {
        const frame = capture();
        if (frame) frames.push(frame);
        await new Promise((r) => setTimeout(r, 1000));
        if (request !== reviewRequest.current) return;
      }
      const res = await run({ data: { exerciseSlug: slug, exerciseName, frames, lang } });
      if (request !== reviewRequest.current) return;
      setResult(res);
      refetch();
    } catch (err) {
      if (request === reviewRequest.current) toast.error(aiErrorMessage(err, t));
    } finally {
      if (request === reviewRequest.current) setBusy(false);
    }
  };

  return (
    <div className="fl-form-review grid gap-6">
      <div className={cn("grid gap-6", !fullscreen && "lg:grid-cols-[3fr_2fr]")}>
        <div
          className={cn(
            "panel fl-camera-panel overflow-hidden",
            fullscreen && "fixed inset-0 z-50 flex flex-col rounded-none border-0 bg-background",
          )}
        >
          <div
            className={cn(
              "fl-camera-stage relative w-full",
              fullscreen ? "min-h-0 flex-1" : "aspect-[4/3] sm:aspect-video",
            )}
          >
            <video
              aria-label={t("fc.title")}
              ref={videoRef}
              muted
              autoPlay
              playsInline
              className={cn(
                "absolute inset-0 size-full object-contain",
                facing === "user" && "-scale-x-100",
              )}
            />
            {!ready && (
              <div className="fl-camera-idle absolute inset-0 grid place-items-center p-6 text-center">
                <div>
                  <span className="fl-camera-idle-icon">
                    <ScanLine aria-hidden="true" />
                  </span>
                  <h2 className="fl-camera-idle-title">{t("fc.title")}</h2>
                  <p className="mt-2 text-sm">
                    {lang === "lt"
                      ? "Kamera išjungta. Pasiruošk, tada pradėk."
                      : "Camera is off. Get into position, then begin."}
                  </p>
                  <Button onClick={enable} disabled={cameraBusy} className="mt-5">
                    {cameraBusy ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 size-4" />
                    )}
                    {t("fc.enable")}
                  </Button>
                  {cameraBusy && (
                    <button type="button" className="fl-camera-cancel" onClick={stopCamera}>
                      {lang === "lt" ? "Atšaukti" : "Cancel"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {fullscreen && (
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                aria-label={t("nx.ar.exitFullscreen")}
                className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex items-center gap-2 rounded-full border border-border bg-background/95 px-4 py-2 text-xs font-bold uppercase tracking-widest text-foreground shadow-lg backdrop-blur"
              >
                <Minimize2 className="size-4" /> {t("nx.ar.exitFullscreen")}
              </button>
            )}
          </div>
          <div
            className={cn(
              "fl-camera-controls flex flex-wrap items-center gap-2 p-4",
              fullscreen &&
                "max-h-[45vh] shrink-0 overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]",
            )}
          >
            <select
              aria-label={lang === "lt" ? "Pratimas" : "Exercise"}
              disabled={busy}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="h-10 rounded-lg border border-border bg-surface-2 px-3 text-sm"
            >
              {(exercises ?? []).map((e) => (
                <option key={e.slug} value={e.slug}>
                  {lang === "lt" ? e.name_lt : e.name_en}
                </option>
              ))}
            </select>
            {ready && (
              <Button onClick={record} disabled={busy} className="font-bold glow-ring">
                {busy ? (
                  <Loader2 className="mr-1 size-4 animate-spin" />
                ) : (
                  <ScanLine className="mr-1 size-4" />
                )}
                {busy ? t("fc.analyzing") : t("fc.record")}
              </Button>
            )}
            {ready && (
              <Button variant="outline" disabled={busy} onClick={stopCamera}>
                <Square className="mr-2 size-4" />
                {lang === "lt" ? "Išjungti kamerą" : "Stop camera"}
              </Button>
            )}
            <Button variant="outline" onClick={switchCamera} disabled={busy || cameraBusy}>
              <SwitchCamera className="mr-1 size-4" />
              {facing === "environment" ? t("nx.ar.front") : t("nx.ar.rear")}
            </Button>
            <Button variant="outline" onClick={() => setFullscreen((f) => !f)}>
              {fullscreen ? (
                <Minimize2 className="mr-1 size-4" />
              ) : (
                <Maximize2 className="mr-1 size-4" />
              )}
              {fullscreen ? t("nx.ar.exitFullscreen") : t("nx.ar.fullscreen")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          {result ? (
            <>
              <div className="panel p-6 text-center">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  {t("fc.score")}
                </p>
                <div className="text-display text-7xl leading-none text-primary">
                  {result.score}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{result.verdict}</p>
              </div>
              {(
                [
                  ["fc.good", result.good, "text-primary"],
                  ["fc.fixes", result.fixes, "text-accent"],
                  ["fc.drills", result.drills, "text-foreground"],
                ] as const
              ).map(([key, items, color]) => (
                <div key={key} className="panel p-5">
                  <h2 className={`text-xl ${color}`}>{t(key)}</h2>
                  <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
                    {items.map((x, i) => (
                      <li key={i}>• {x}</li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="panel flex gap-3 p-5 text-sm">
                <ShieldAlert className="size-5 shrink-0 text-destructive" />
                <span>{result.risk}</span>
              </div>
            </>
          ) : (
            <div className="panel grid place-items-center gap-3 p-10 text-center text-sm text-muted-foreground">
              <Sparkles className="size-7 text-primary" />
              {t("fc.sub")}
            </div>
          )}
        </div>
      </div>

      {historyReadFailed ? (
        <div className="panel p-6">
          <h2 className="text-2xl">{t("fc.history")}</h2>
          {/* Hiding the section on failure says "you have no past analyses".
              Say instead that we could not look. */}
          <p className="mt-3 text-sm text-muted-foreground">{t("fc.historyReadFailed")}</p>
        </div>
      ) : null}

      {!!history?.length && (
        <div className="panel p-6">
          <h2 className="text-2xl">{t("fc.history")}</h2>
          <div className="mt-3 grid gap-2">
            {history.map((h) => (
              <div key={h.id} className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{h.exercise_name}</span>
                  <span className="text-display text-lg text-primary">{h.score}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{h.verdict}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
