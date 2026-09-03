import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, ScanLine, SwitchCamera, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { analyzeSupplementPhoto } from "@/lib/supplement-vision.functions";
import { addSupplements } from "@/lib/supplements.functions";
import { useAuth } from "@/lib/auth";
import { useI18n, type TKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { tactileClick } from "@/lib/tactile";
import { aiErrorMessage } from "@/lib/ai-error";
import { errorMessage } from "@/lib/error-message";

const CATEGORIES = [
  "protein",
  "creatine",
  "vitamin",
  "mineral",
  "iron",
  "calcium",
  "omega",
  "preworkout",
  "electrolyte",
  "probiotic",
  "general",
] as const;

const PREF_TIMES = ["any", "morning", "pre_workout", "post_workout", "evening", "bedtime"] as const;

type Draft = {
  name: string;
  dose: string;
  category: string;
  timesPerDay: number;
  withFood: boolean;
  preferredTime: string;
  notes: string;
  confidence: number;
  readable: string;
};

/** Camera-first supplement entry: photograph a label, AI fills an editable plan. */
export function SupplementPhotoScanner() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const analyze = useServerFn(analyzeSupplementPhoto);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  useEffect(
    () => () => {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((tr) => tr.stop());
    },
    [],
  );

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((tr) => tr.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setLive(false);
  };

  const startCamera = async (mode: "environment" | "user" = facing) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      const prev = videoRef.current?.srcObject as MediaStream | null;
      prev?.getTracks().forEach((tr) => tr.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setFacing(mode);
      setLive(true);
    } catch {
      toast.error(t("supp.scan.cameraError"));
    }
  };

  const run = async (image: string) => {
    setBusy(true);
    try {
      const res = await analyze({ data: { image, lang } });
      if (!res.ok) {
        toast.error(errorMessage(res.reason, t("ai.err.unavailable")));
        return;
      }
      setDrafts(
        res.products.map((p) => ({
          name: p.name,
          dose: p.dose,
          category: p.category,
          timesPerDay: p.timesPerDay,
          withFood: p.withFood,
          preferredTime: p.preferredTime,
          notes: p.notes,
          confidence: p.confidence,
          readable: p.readable,
        })),
      );
      stopCamera();
    } catch (error) {
      toast.error(aiErrorMessage(error, t));
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    await run(canvas.toDataURL("image/jpeg", 0.85));
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => void run(String(reader.result));
    reader.readAsDataURL(file);
  };

  const patch = (i: number, next: Partial<Draft>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...next } : row)));

  const save = useMutation({
    mutationFn: async () => {
      const supplements = drafts
        .filter((d) => d.name.trim())
        .map((d) => ({
          name: d.name.trim(),
          dose: d.dose.trim(),
          category: d.category,
          times_per_day: d.timesPerDay,
          with_food: d.withFood,
          preferred_time: d.preferredTime,
          notes: d.notes.trim(),
          is_active: true,
        }));
      if (!supplements.length) return;
      await addSupplements({ data: { supplements, skipExistingNames: false } });
    },
    onSuccess: async () => {
      setDrafts([]);
      toast.success(t("supp.scan.saved"));
      await qc.invalidateQueries({ queryKey: ["supplements", user?.id] });
    },
    onError: (error) => toast.error(errorMessage(error, t("common.error"))),
  });

  return (
    <section className="panel grid gap-4 p-5">
      <header className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <ScanLine className="size-4" />
        </span>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest">{t("supp.scan.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("supp.scan.sub")}</p>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-56 w-full object-cover sm:h-64 ${live ? "" : "opacity-30"} ${
            facing === "user" ? "-scale-x-100" : ""
          }`}
        />
        {!live && (
          <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-widest text-white/70">
            <Camera className="size-8" />
          </div>
        )}
        {busy && (
          <div className="absolute inset-0 grid place-items-center gap-2 bg-black/60 text-xs uppercase tracking-widest text-white">
            <Loader2 className="size-6 animate-spin" />
            {t("supp.scan.analyzing")}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {live ? (
          <>
            <Button
              onClick={() => {
                tactileClick();
                void capture();
              }}
              disabled={busy}
              className="press"
            >
              <Camera className="size-4" />
              {t("supp.scan.shoot")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void startCamera(facing === "environment" ? "user" : "environment")}
            >
              <SwitchCamera className="size-4" />
              {t("supp.scan.switch")}
            </Button>
            <Button variant="ghost" onClick={stopCamera}>
              <X className="size-4" />
              {t("supp.scan.stop")}
            </Button>
          </>
        ) : (
          <Button
            onClick={() => {
              tactileClick();
              void startCamera();
            }}
            disabled={busy}
            className="press"
          >
            <Camera className="size-4" />
            {t("supp.scan.start")}
          </Button>
        )}
        <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy}>
          <Upload className="size-4" />
          {t("supp.scan.upload")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>

      {drafts.length > 0 && (
        <div className="grid gap-3 border-t border-border pt-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {t("supp.scan.edit")}
          </p>

          {drafts.map((d, i) => (
            <div key={i} className="grid gap-3 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <Input value={d.name} onChange={(e) => patch(i, { name: e.target.value })} />
                <button
                  type="button"
                  onClick={() => setDrafts((rows) => rows.filter((_, idx) => idx !== i))}
                  className="mt-2 text-muted-foreground hover:text-foreground"
                  aria-label={t("supp.scan.discard")}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                  {t("supp.scan.confidence")} {d.confidence}%
                </span>
                {d.readable ? <span className="truncate">{d.readable}</span> : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  {t("supp.dose")}
                  <Input value={d.dose} onChange={(e) => patch(i, { dose: e.target.value })} />
                </label>
                <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  {t("supp.category")}
                  <select
                    value={d.category}
                    onChange={(e) => patch(i, { category: e.target.value })}
                    className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`supp.cat.${c}` as TKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  {t("supp.timesPerDay")}
                  <div className="flex h-10 items-center gap-1 rounded-lg border border-border bg-surface p-1">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={d.timesPerDay === n}
                        onClick={() => {
                          tactileClick();
                          patch(i, { timesPerDay: n });
                        }}
                        className={`flex-1 rounded-md text-sm font-bold transition-colors ${
                          d.timesPerDay === n
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-surface-2"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                  {t("supp.prefTime")}
                  <select
                    value={d.preferredTime}
                    onChange={(e) => patch(i, { preferredTime: e.target.value })}
                    className="h-10 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground"
                  >
                    {PREF_TIMES.map((p) => (
                      <option key={p} value={p}>
                        {t(`supp.pref.${p}` as TKey)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={d.withFood}
                  onChange={(e) => patch(i, { withFood: e.target.checked })}
                  className="size-4 accent-[var(--primary)]"
                />
                {t("supp.withFood")}
              </label>

              <label className="grid gap-1.5 text-xs uppercase tracking-widest text-muted-foreground">
                {t("supp.notes")}
                <Input value={d.notes} onChange={(e) => patch(i, { notes: e.target.value })} />
              </label>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                tactileClick();
                save.mutate();
              }}
              disabled={save.isPending}
              className="press"
            >
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("supp.scan.save")}
            </Button>
            <Button variant="ghost" onClick={() => setDrafts([])}>
              {t("supp.scan.discard")}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
