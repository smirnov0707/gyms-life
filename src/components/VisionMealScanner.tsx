import React, { useState, useRef } from "react";
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { analyzeMealPhoto, savePhotoMeal, type MealAnalysis } from "@/lib/food-vision.functions";
import { errorMessage } from "@/lib/error-message";
import { browserTimeZone } from "@/lib/local-day";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const VisionMealScanner: React.FC = () => {
  const { lang } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeFn = useServerFn(analyzeMealPhoto);
  const saveFn = useServerFn(savePhotoMeal);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scanResult, setScanResult] = useState<MealAnalysis | null>(null);

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const source = e.target?.result;
        if (typeof source !== "string") {
          reject(new Error("Could not read image data."));
          return;
        }
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 900;
          const MAX_HEIGHT = 900;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Could not prepare image."));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = () => reject(new Error("Could not decode image."));
        img.src = source;
      };
      reader.onerror = () => reject(new Error("Could not read image file."));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!SUPPORTED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
      e.currentTarget.value = "";
      toast.error(
        lang === "lt"
          ? "Įkelkite JPG, PNG arba WebP nuotrauką iki 10 MB."
          : "Upload a JPG, PNG, or WebP image up to 10 MB.",
      );
      return;
    }

    try {
      const base64 = await resizeImage(file);
      setImagePreview(base64);
      setScanResult(null);
      await runAnalysis(base64);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Klaida apdorojant nuotrauką"));
    }
  };

  const runAnalysis = async (base64: string) => {
    setIsScanning(true);
    try {
      const res = await analyzeFn({ data: { image: base64, lang: lang || "lt" } });
      setScanResult(res);
      if (res.ok) {
        toast.success(lang === "lt" ? "Patiekalas sėkmingai atpažintas!" : "Meal recognized!");
      } else {
        toast.error(
          res.reason || (lang === "lt" ? "Nepavyko atpažinti maisto" : "Failed to detect food"),
        );
      }
    } catch (error: unknown) {
      toast.error(
        errorMessage(error, lang === "lt" ? "Klaida analizuojant nuotrauką" : "Analysis error"),
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = async () => {
    if (!scanResult || !scanResult.ok || !scanResult.dishName) return;
    setIsSaving(true);
    try {
      await saveFn({
        data: {
          dishName: scanResult.dishName,
          calories: scanResult.calories || 0,
          protein: scanResult.protein || 0,
          carbs: scanResult.carbs || 0,
          fat: scanResult.fat || 0,
          note: scanResult.note || "",
          timeZone: browserTimeZone(),
        },
      });
      toast.success(
        lang === "lt" ? "Patiekalas išsaugotas į mitybos dienoraštį!" : "Meal saved to log!",
      );
      queryClient.invalidateQueries({ queryKey: ["nutrition", user?.id] });
      setImagePreview(null);
      setScanResult(null);
    } catch (error: unknown) {
      toast.error(errorMessage(error, lang === "lt" ? "Nepavyko išsaugoti" : "Failed to save"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-neutral-900/80 border border-white/10 p-4 sm:p-6 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide">
              {lang === "lt" ? "Food Vision AI Skeneris" : "Food Vision AI Scanner"}
            </h3>
            <p className="text-xs font-mono text-neutral-400">
              {lang === "lt" ? "Momentinė makroelementų analizė" : "Real-time macro breakdown"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-mono text-emerald-300 font-bold">NEURAL VISION</span>
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
      />

      {!imagePreview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer flex flex-col items-center justify-center p-8 sm:p-12 rounded-xl border-2 border-dashed border-white/15 hover:border-emerald-500/50 hover:bg-emerald-950/10 transition-all duration-300 text-center"
        >
          <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:border-emerald-500/40 transition-transform">
            <Upload className="w-6 h-6 text-neutral-300 group-hover:text-emerald-400 transition-colors" />
          </div>
          <span className="text-sm font-semibold text-neutral-200 mb-1">
            {lang === "lt"
              ? "Nufotografuok arba įkelk patiekalo nuotrauką"
              : "Snap or upload a meal photo"}
          </span>
          <span className="text-xs font-mono text-neutral-500">
            {lang === "lt"
              ? "JPG, PNG • Automatinis porcijos ir makro nustatymas"
              : "JPG, PNG • Auto weight & macro detection"}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-video max-h-72 w-full overflow-hidden rounded-xl bg-black border border-white/15">
            <img src={imagePreview} alt="Meal Preview" className="w-full h-full object-cover" />

            {isScanning && (
              <div className="absolute inset-0 bg-emerald-500/10 backdrop-blur-[1px] pointer-events-none flex flex-col items-center justify-center">
                <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10b981] animate-scan-laser absolute top-0" />
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-emerald-500/40">
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                  <span className="text-xs font-mono font-bold text-emerald-300">
                    {lang === "lt"
                      ? "SKENUOTAS PATIEKALAS • SKAIČIUOJAMI MAKROELEMENTAI..."
                      : "SCANNING MEAL • CALCULATING MACROS..."}
                  </span>
                </div>
              </div>
            )}
          </div>

          {scanResult && (
            <div className="p-4 rounded-xl bg-black/60 border border-white/10 space-y-3">
              {scanResult.ok ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                        {lang === "lt" ? "ATPAŽINTAS PATIEKALAS" : "IDENTIFIED DISH"}
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-white">
                        {scanResult.dishName}
                      </h4>
                    </div>
                    {scanResult.confidence && (
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {scanResult.confidence}% {lang === "lt" ? "TIKSLUMAS" : "CONFIDENCE"}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-white/10 text-center">
                    <div className="p-2 rounded-lg bg-neutral-900 border border-white/5">
                      <span className="block text-[10px] font-mono text-neutral-400">KCAL</span>
                      <span className="text-sm sm:text-base font-bold text-white">
                        {scanResult.calories}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-white/5">
                      <span className="block text-[10px] font-mono text-blue-400">
                        {lang === "lt" ? "BALTYMAI" : "PROT"}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-blue-300">
                        {scanResult.protein}g
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-white/5">
                      <span className="block text-[10px] font-mono text-amber-400">
                        {lang === "lt" ? "ANGLIAV." : "CARB"}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-amber-300">
                        {scanResult.carbs}g
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-neutral-900 border border-white/5">
                      <span className="block text-[10px] font-mono text-rose-400">
                        {lang === "lt" ? "RIEBALAI" : "FAT"}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-rose-300">
                        {scanResult.fat}g
                      </span>
                    </div>
                  </div>

                  {scanResult.items && scanResult.items.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {scanResult.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] font-mono bg-white/5 px-2 py-0.5 rounded text-neutral-300 border border-white/5"
                        >
                          {it}
                        </span>
                      ))}
                    </div>
                  )}

                  {scanResult.note && (
                    <p className="text-xs text-neutral-400 italic bg-neutral-950/50 p-2.5 rounded-lg border border-white/5">
                      💡 {scanResult.note}
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-2"
                    >
                      {isSaving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {lang === "lt" ? "Įrašyti į mitybos dienoraštį" : "Save to Nutrition Log"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="border-white/10 hover:bg-white/5"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-3 space-y-2">
                  <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto" />
                  <p className="text-xs font-mono text-neutral-300">{scanResult.reason}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="border-white/10 text-xs"
                  >
                    {lang === "lt" ? "Bandykite dar kartą" : "Try Again"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VisionMealScanner;
