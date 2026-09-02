import React, { useState, useRef } from "react";
import { Mic, MicOff, Loader2, Sparkles, CheckCircle2, Volume2, Radio } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { parseVoiceWorkoutLog } from "@/lib/voice-logger.functions";
import { errorMessage } from "@/lib/error-message";

interface VoiceSetLoggerProps {
  onSetLogged?: (data: {
    exerciseName: string;
    weightKg: number;
    reps: number;
    rpe: number;
    suggestedRestSeconds: number;
  }) => void;
}

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Nepavyko perskaityti garso įrašo."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Nepavyko perskaityti garso įrašo."));
    reader.onabort = () => reject(new Error("Garso įrašo nuskaitymas buvo nutrauktas."));
    reader.readAsDataURL(blob);
  });
}

export const VoiceSetLogger: React.FC<VoiceSetLoggerProps> = ({ onSetLogged }) => {
  const { lang } = useI18n();
  const parseFn = useServerFn(parseVoiceWorkoutLog);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info(
        lang === "lt"
          ? "Klausausi... Ištarkite pratimą, svorį ir pakartojimus"
          : "Listening... Speak your set",
      );
    } catch {
      toast.error(lang === "lt" ? "Nepavyko pasiekti mikrofono" : "Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const base64String = await readBlobAsDataUrl(blob);
      const res = await parseFn({
        data: {
          audioBase64: base64String,
          mimeType: "audio/webm",
          lang: lang || "lt",
        },
      });

      if (res.ok) {
        setLastTranscript(res.transcription);
        toast.success(
          lang === "lt"
            ? `Užregistruota: ${res.data.exerciseName} ${res.data.weightKg}kg × ${res.data.reps} (RPE ${res.data.rpe})`
            : `Logged: ${res.data.exerciseName} ${res.data.weightKg}kg × ${res.data.reps}`,
        );
        onSetLogged?.(res.data);
      } else {
        toast.error(res.reason);
      }
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Apdorojimo klaida"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="glass-panel rounded-3xl p-5 space-y-4 relative overflow-hidden">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-tight text-white">
              {lang === "lt" ? "Balso serijų registratorius" : "Voice Set Logger"}
            </h4>
            <p className="text-[11px] font-mono text-neutral-400">
              {lang === "lt" ? "Groq Whisper Turbo (<200ms)" : "Instant speech-to-set"}
            </p>
          </div>
        </div>

        <span className="badge-tech text-red-400 border-red-500/20 bg-red-500/5">
          VOICE TELEMETRY
        </span>
      </div>

      <div>
        {!isRecording ? (
          <Button
            type="button"
            onClick={startRecording}
            disabled={isProcessing}
            className="w-full bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black uppercase tracking-wider gap-2.5 py-6 rounded-2xl shadow-lg shadow-red-950/40 border border-red-400/20 transition-all hover:scale-[1.01]"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-mono">
                  {lang === "lt" ? "Apdorojama..." : "Processing..."}
                </span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span className="text-xs">
                  {lang === "lt" ? "Ištarti seriją balsu" : "Hold to Voice Log"}
                </span>
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={stopRecording}
            className="w-full bg-neutral-900 text-red-400 border border-red-500/40 font-black uppercase tracking-wider gap-2.5 py-6 rounded-2xl animate-pulse shadow-lg shadow-red-950/40"
          >
            <MicOff className="w-4 h-4 text-red-400" />
            <span className="text-xs">
              {lang === "lt" ? "Baigti kalbėti (Spauskite)" : "Stop Recording"}
            </span>
          </Button>
        )}
      </div>

      {lastTranscript && (
        <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] flex items-center gap-2.5 text-xs text-neutral-300 font-mono">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">„{lastTranscript}“</span>
        </div>
      )}
    </div>
  );
};

export default VoiceSetLogger;
