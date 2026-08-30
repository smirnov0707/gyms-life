import React, { useState, useRef } from "react";
import { Camera, Upload, Sparkles, Loader2, AlertTriangle, Plus } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { analyzeMealPhoto, savePhotoMeal } from "@/lib/food-vision.functions";
import { aiErrorMessage } from "@/lib/ai-error";

type Result = {
  dishName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  items: string[];
  confidence: number;
  note: string;
};

/** Downscale so the upload stays small and the model sees a clean frame. */
async function toCompactDataUrl(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode failed"));
      el.src = dataUrl;
    });
    const max = 1024;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return dataUrl;
  }
}

export const VisionMealScanner: React.FC = () => {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const analyze = useServerFn(analyzeMealPhoto);
  const save = useServerFn(savePhotoMeal);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const image = await toCompactDataUrl(file);
    setPreview(image);
    setResult(null);
    setRejected(null);
    setAnalyzing(true);
    try {
      const res = await analyze({ data: { image, lang } });
      if (!res.ok) setRejected(res.reason);
      else setResult(res);
    } catch (err) {
      toast.error(aiErrorMessage(err, t));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await save({
        data: {
          dishName: result.dishName,
          calories: result.calories,
          protein: result.protein,
          carbs: result.carbs,
          fat: result.fat,
          note: result.note,
        },
      });
      qc.invalidateQueries({ queryKey: ["nutrition", user?.id] });
      toast.success(t("sc.vision.saved"));
    } catch (err) {
      toast.error(aiErrorMessage(err, t));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 rounded-3xl border border-border bg-surface backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-foreground shadow-lg shadow-indigo-500/20">
          <Camera className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
            {t("sc.vision.title")} <Sparkles className="w-4 h-4 text-accent" />
          </h3>
          <p className="text-xs text-muted-foreground">{t("sc.vision.subtitle")}</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageUpload}
        className="hidden"
      />

      {!preview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border hover:border-indigo-500/50 rounded-2xl p-8 text-center cursor-pointer transition-all bg-surface"
        >
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-semibold text-foreground">{t("sc.vision.uploadTitle")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("sc.vision.uploadFormats")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative h-44 w-full rounded-2xl overflow-hidden border border-border">
            <img src={preview} alt="Meal preview" className="w-full h-full object-cover" />
            {analyzing && (
              <div className="absolute inset-0 bg-surface/80 backdrop-blur-sm flex flex-col items-center justify-center text-foreground gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs font-mono">{t("sc.vision.analyzing")}</span>
              </div>
            )}
          </div>

          {rejected && (
            <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 space-y-3">
              <div className="flex items-start gap-2 text-xs text-foreground">
                <AlertTriangle className="w-4 h-4 shrink-0 text-accent" />
                <span>{rejected}</span>
              </div>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
              >
                {t("sc.vision.newPhoto")}
              </Button>
            </div>
          )}

          {result && (
            <div className="p-4 rounded-2xl bg-surface border border-border space-y-3 animate-in fade-in">
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h4 className="font-bold text-foreground text-sm">{result.dishName}</h4>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {result.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-surface-2 text-foreground font-mono"
                      >
                        {it}
                      </span>
                    ))}
                  </div>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs border-border text-foreground"
                >
                  {t("sc.vision.newPhoto")}
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center pt-2">
                <div className="p-2 rounded-xl bg-surface border border-border">
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.vision.kcal")}</span>
                  <span className="font-bold text-sm text-foreground">{result.calories}</span>
                </div>
                <div className="p-2 rounded-xl bg-surface border border-border">
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.vision.protein")}</span>
                  <span className="font-bold text-sm text-primary">{result.protein}g</span>
                </div>
                <div className="p-2 rounded-xl bg-surface border border-border">
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.vision.carbs")}</span>
                  <span className="font-bold text-sm text-accent">{result.carbs}g</span>
                </div>
                <div className="p-2 rounded-xl bg-surface border border-border">
                  <span className="block text-[10px] text-muted-foreground uppercase font-mono">{t("sc.vision.fat")}</span>
                  <span className="font-bold text-sm text-rose-400">{result.fat}g</span>
                </div>
              </div>

              {result.note && <p className="text-xs text-primary/80">{result.note}</p>}

              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  {t("sc.vision.confidence").replace("{n}", String(result.confidence))}
                </span>
                <Button size="sm" className="h-8 rounded-full text-xs" disabled={saving} onClick={handleSave}>
                  {saving ? <Loader2 className="mr-1.5 w-3.5 h-3.5 animate-spin" /> : <Plus className="mr-1.5 w-3.5 h-3.5" />}
                  {t("sc.vision.saveToDiary")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
