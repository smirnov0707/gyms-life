import React, { useState, useRef } from "react";
import { ShieldCheck, Camera, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n } from "../lib/i18n";
import { analyzeExerciseForm, type ExerciseFormAnalysis } from "../lib/biomechanics.functions";
import { errorMessage } from "../lib/error-message";

export const BiomechanicsScanner: React.FC = () => {
  const { lang } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const analyzeFn = useServerFn(analyzeExerciseForm);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [result, setResult] = useState<ExerciseFormAnalysis | null>(null);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setImagePreview(base64);
      setResult(null);
      setIsScanning(true);

      try {
        const res = await analyzeFn({
          data: { image: base64, exerciseName: "Squat / Press", lang: lang || "lt" },
        });
        setResult(res);
        if (res.ok) {
          toast.success(lang === "lt" ? "Formos analizė baigta!" : "Form analysis complete!");
        } else {
          toast.error(
            errorMessage(
              res.reason,
              lang === "lt" ? "Nepavyko išanalizuoti formos" : "Could not analyze form",
            ),
          );
        }
      } catch (error: unknown) {
        toast.error(errorMessage(error, "Klaida analizuojant formą"));
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="rounded-2xl bg-surface-2 border border-border p-5 backdrop-blur-xl shadow-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 light:text-cyan-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-foreground">
              {lang === "lt"
                ? "AI Biomechanikos & Formos Skeneris"
                : "AI Form & Biomechanics Scanner"}
            </h3>
            <p className="text-xs font-mono text-muted-foreground">
              {lang === "lt"
                ? "Sąnarių kampų, stuburo ir saugumo įvertinimas"
                : "Joint angle & spine safety check"}
            </p>
          </div>
        </div>

        <div className="px-2 py-0.5 rounded-full bg-surface border border-cyan-500/30 text-[10px] font-mono text-cyan-300 light:text-cyan-700 font-bold">
          VISION KINEMATICS
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleSelect}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      {!imagePreview ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-border hover:border-cyan-500/40 p-8 rounded-xl text-center space-y-2 group transition-all"
        >
          <Camera className="w-8 h-8 text-muted-foreground mx-auto group-hover:text-cyan-400 light:text-cyan-700 group-hover:scale-110 transition-transform" />
          <div className="text-sm font-semibold text-neutral-200">
            {lang === "lt"
              ? "Nufotografuokite pratimo atlikimo poziciją"
              : "Snap a photo of your exercise form"}
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            {lang === "lt"
              ? "Pritūpimai, štangos spaudimas, trauka"
              : "Squats, bench press, deadlifts"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-video max-h-64 rounded-xl overflow-hidden border border-white/15 bg-black">
            <img src={imagePreview} alt="Exercise Form" className="w-full h-full object-cover" />
            {isScanning && (
              <div className="absolute inset-0 bg-cyan-950/40 backdrop-blur-[2px] flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {lang === "lt" ? "ANALIZUOJAMI SĄNARIŲ KAMPAI..." : "ANALYZING KINEMATICS..."}
                </span>
              </div>
            )}
          </div>

          {result && result.ok && (
            <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 light:text-cyan-700 uppercase">
                    {result.exerciseDetected}
                  </span>
                  <h4 className="text-base font-bold text-foreground">
                    {lang === "lt" ? "Technikos įvertinimas" : "Form Score"}
                  </h4>
                </div>
                <span className="text-lg font-mono font-black text-cyan-300 light:text-cyan-700 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                  {result.score}/100
                </span>
              </div>

              {result.coachCue && (
                <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-xs text-cyan-200">
                  💡 <strong>Cue:</strong> {result.coachCue}
                </div>
              )}

              {result.corrections && result.corrections.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-amber-400 light:text-amber-700 uppercase">
                    {lang === "lt" ? "Korektūros:" : "Corrections:"}
                  </span>
                  {result.corrections.map((c: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-foreground">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 light:text-amber-700 shrink-0" />
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="w-full border-border bg-foreground/[0.06] hover:bg-foreground/10 text-neutral-200 gap-2 text-xs py-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {lang === "lt" ? "Perfotografuoti kitą kadrą" : "Retake form frame"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BiomechanicsScanner;
