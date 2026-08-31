import React, { useState, useRef } from "react";
import { Mic, MicOff, Loader2, Sparkles, CheckCircle2, Volume2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { useI18n } from "@/lib/i18n";
import { parseVoiceWorkoutLog } from "@/lib/voice-logger.functions";

interface VoiceSetLoggerProps {
  onSetLogged?: (data: {
    exerciseName: string;
    weightKg: number;
    reps: number;
    rpe: number;
    suggestedRestSeconds: number;
  }) => void;
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
      toast.info(lang === "lt" ? "Klausausi... Sakykite pratimą, svorį ir pakartojimus" : "Listening... Speak your set");
    } catch (err: any) {
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
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        const res = await parseFn({
          data: {
            audioBase64: base64String,
            mimeType: "audio/webm",
            lang: lang || "lt",
          },
        });

        if (res.ok && res.data) {
          setLastTranscript(res.transcription || "");
          toast.success(
            lang === "lt"
              ? `Užregistruota: ${res.data.exerciseName} ${res.data.weightKg}kg × ${res.data.reps} (RPE ${res.data.rpe})`
              : `Logged: ${res.data.exerciseName} ${res.data.weightKg}kg × ${res.data.reps}`
          );
          if (onSetLogged) {
            onSetLogged(res.data);
          }
        } else {
          toast.error(res.reason || (lang === "lt" ? "Nepavyko atpažinti" : "Voice log failed"));
        }
        setIsProcessing(false);
      };
    } catch (err: any) {
      toast.error(err?.message || "Apdorojimo klaida");
      setIsProcessing(false);
    }
  };

  return (
    <div className="rounded-2xl bg-neutral-900/90 border border-white/10 p-4 backdrop-blur-xl shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
            <Volume2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              {lang === "lt" ? "Balso serijų registratorius" : "Voice Set Logger"}
            </h4>
            <p className="text-[11px] font-mono text-neutral-400">
              {lang === "lt" ? "Groq Whisper Turbo (<200ms)" : "Instant speech-to-set"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 border border-red-500/30">
          <Sparkles className="w-3 h-3 text-red-400" />
          <span className="text-[9px] font-mono text-red-300 font-bold">VOICE AI</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {!isRecording ? (
          <Button
            type="button"
            onClick={startRecording}
            disabled={isProcessing}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold gap-2 py-3"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{lang === "lt" ? "Apdorojama..." : "Processing..."}</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>{lang === "lt" ? "Ištarti seriją balsu" : "Hold to Voice Log"}</span>
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={stopRecording}
            className="flex-1 bg-neutral-800 hover:bg-neutral-700 text-red-400 border border-red-500/50 font-bold gap-2 py-3 animate-pulse"
          >
            <MicOff className="w-4 h-4 text-red-400" />
            <span>{lang === "lt" ? "Baigti kalbėti (Spauskite)" : "Stop Recording"}</span>
          </Button>
        )}
      </div>

      {lastTranscript && (
        <div className="p-2 rounded-lg bg-black/50 border border-white/5 flex items-center gap-2 text-xs text-neutral-300 font-mono">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="truncate">„{lastTranscript}“</span>
        </div>
      )}
    </div>
  );
};

export default VoiceSetLogger;
