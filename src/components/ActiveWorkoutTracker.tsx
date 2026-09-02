import React, { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Volume2, Check, Plus, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { VoiceSetLogger } from "./VoiceSetLogger";
import { useI18n } from "@/lib/i18n";

interface WorkoutSet {
  id: string;
  exercise: string;
  weightKg: number;
  reps: number;
  rpe: number;
}

export const ActiveWorkoutTracker: React.FC = () => {
  const { lang } = useI18n();

  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [restSecondsLeft, setRestSecondsLeft] = useState<number | null>(null);
  const [isResting, setIsResting] = useState(false);

  // Web Audio API sintetinis signalas
  const playRestCompleteBeep = () => {
    try {
      const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextConstructor) return;
      const audioCtx = new AudioContextConstructor();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz (A5)
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.warn("AudioContext error:", e);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof window.setInterval> | undefined;
    if (isResting && restSecondsLeft !== null && restSecondsLeft > 0) {
      timer = setInterval(() => {
        setRestSecondsLeft((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else if (restSecondsLeft === 0 && isResting) {
      setIsResting(false);
      playRestCompleteBeep();
      toast.success(
        lang === "lt"
          ? "Poilsio laikas baigėsi! Pirmyn į kitą seriją 💪"
          : "Rest over! Ready for next set 💪",
      );
    }
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [isResting, restSecondsLeft, lang]);

  const handleVoiceSet = (data: {
    exerciseName: string;
    weightKg: number;
    reps: number;
    rpe: number;
    suggestedRestSeconds: number;
  }) => {
    const newSet: WorkoutSet = {
      id: Date.now().toString(),
      exercise: data.exerciseName,
      weightKg: data.weightKg,
      reps: data.reps,
      rpe: data.rpe,
    };

    setSets((prev) => [newSet, ...prev]);

    // Paleidžiame poilsio laikmatį
    const rest = data.suggestedRestSeconds || 90;
    setRestSecondsLeft(rest);
    setIsResting(true);
  };

  const startCustomRest = (sec: number) => {
    setRestSecondsLeft(sec);
    setIsResting(true);
  };

  return (
    <div className="space-y-4">
      {/* Balso modulis */}
      <VoiceSetLogger onSetLogged={handleVoiceSet} />

      {/* Poilsio laikmatis */}
      {restSecondsLeft !== null && (
        <div className="rounded-2xl bg-black/80 border border-white/10 p-4 flex items-center justify-between backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${isResting ? "bg-emerald-500/20 text-emerald-400 animate-pulse" : "bg-white/5 text-neutral-400"}`}
            >
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase text-neutral-400 block">
                {lang === "lt" ? "POILSIO LAIKMATIS" : "REST TIMER"}
              </span>
              <span className="text-2xl font-mono font-black text-white">
                {Math.floor(restSecondsLeft / 60)}:
                {(restSecondsLeft % 60).toString().padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsResting(!isResting)}
              className="border-white/10 bg-white/5 text-white"
            >
              {isResting ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setRestSecondsLeft(null);
                setIsResting(false);
              }}
              className="text-neutral-400 hover:text-white"
            >
              {lang === "lt" ? "Praleisti" : "Skip"}
            </Button>
          </div>
        </div>
      )}

      {/* Užregistruotų serijų sąrašas */}
      <div className="rounded-2xl bg-neutral-900/80 border border-white/10 p-4 backdrop-blur-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-emerald-400" />
            {lang === "lt" ? "Šios treniruotės serijos" : "Session Sets"}
          </h4>
          <span className="text-xs font-mono text-neutral-400">
            {sets.length} {lang === "lt" ? "serijos" : "sets"}
          </span>
        </div>

        {sets.length === 0 ? (
          <p className="text-xs text-neutral-500 italic py-2">
            {lang === "lt"
              ? "Serijų dar nėra. Paspauskite mikrofono mygtuką ir ištarkite seriją."
              : "No sets recorded yet. Use voice button above."}
          </p>
        ) : (
          <div className="space-y-2">
            {sets.map((s, idx) => (
              <div
                key={s.id}
                className="p-2.5 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] text-neutral-400">
                    #{sets.length - idx}
                  </span>
                  <span className="font-bold text-white">{s.exercise}</span>
                </div>
                <div className="flex items-center gap-3 text-neutral-300">
                  <span>{s.weightKg} kg</span>
                  <span>×</span>
                  <span className="text-emerald-400 font-bold">{s.reps} reps</span>
                  <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-amber-400 border border-amber-500/20">
                    RPE {s.rpe}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveWorkoutTracker;
