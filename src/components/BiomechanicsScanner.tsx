import React, { useState, useRef } from "react";
import { ScanLine, Camera, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n, baseLang } from "../lib/i18n";
import { analyzeExerciseForm, type ExerciseFormAnalysis } from "../lib/biomechanics.functions";
import { errorMessage } from "../lib/error-message";

export const BiomechanicsScanner: React.FC = () => {
  const { lang } = useI18n();
  const base = baseLang(lang);
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
          toast.success(base === "lt" ? "Formos analizė baigta!" : "Form analysis complete!");
        } else {
          toast.error(
            errorMessage(
              res.reason,
              base === "lt" ? "Nepavyko išanalizuoti formos" : "Could not analyze form",
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
    <div className="fl-workspace-panel fl-position-review p-5 space-y-4">
      <div className="fl-position-heading">
        <span className="fl-position-icon">
          <ScanLine aria-hidden="true" />
        </span>
        <div>
          <h2>
            {base === "lt" ? "Atidesnis žvilgsnis į judesį." : "A closer look at your movement."}
          </h2>
          <p>
            {base === "lt"
              ? "Pasirink aiškią nuotrauką, kurioje matoma pratimo pozicija."
              : "Choose a clear photo showing your exercise position."}
          </p>
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
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="fl-position-upload"
        >
          <Camera aria-hidden="true" />
          <span className="text-sm font-semibold text-foreground">
            {base === "lt"
              ? "Nufotografuokite pratimo atlikimo poziciją"
              : "Snap a photo of your exercise form"}
          </span>
          <span className="text-xs text-muted-foreground">
            {base === "lt"
              ? "Pritūpimai, štangos spaudimas, trauka"
              : "Squats, bench press, deadlifts"}
          </span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-video max-h-64 rounded-xl overflow-hidden border border-white/15 bg-black">
            <img src={imagePreview} alt="Exercise Form" className="w-full h-full object-cover" />
            {isScanning && (
              <div className="absolute inset-0 bg-cyan-950/40 backdrop-blur-[2px] flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {base === "lt" ? "ANALIZUOJAMI SĄNARIŲ KAMPAI..." : "ANALYZING KINEMATICS..."}
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
                    {base === "lt" ? "Technikos įvertinimas" : "Form Score"}
                  </h4>
                </div>
                <span className="text-lg font-mono font-black text-cyan-300 light:text-cyan-700 px-2.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30">
                  {result.score}/100
                </span>
              </div>

              {result.coachCue && (
                <div className="p-3 rounded-lg bg-surface-2 border border-border text-xs text-accent">
                  💡 <strong>Cue:</strong> {result.coachCue}
                </div>
              )}

              {result.corrections && result.corrections.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-amber-400 light:text-amber-700 uppercase">
                    {base === "lt" ? "Korektūros:" : "Corrections:"}
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
                className="w-full border-border bg-foreground/[0.06] hover:bg-foreground/10 text-foreground gap-2 text-xs py-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {base === "lt" ? "Perfotografuoti kitą kadrą" : "Retake form frame"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BiomechanicsScanner;
