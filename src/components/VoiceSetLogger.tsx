import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { baseLang, useI18n } from "@/lib/i18n";
import { parseVoiceWorkoutLog } from "@/lib/voice-logger.functions";
import { chooseAudioRecordingType, type VoiceSetDraft } from "@/lib/voice-log.schema";
import { aiErrorMessage } from "@/lib/ai-error";
export interface VoiceSetLoggerProps {
  onSetLogged?: (data: VoiceSetDraft) => void;
}
const readAudio = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("AI_INVALID_MEDIA"));
    reader.onerror = () => reject(new Error("AI_INVALID_MEDIA"));
    reader.onabort = reader.onerror;
    reader.readAsDataURL(blob);
  });
/** Records a bounded audio clip and shows a reviewable draft; this component never saves a set. */
export function VoiceSetLogger({ onSetLogged }: VoiceSetLoggerProps) {
  const { lang, t } = useI18n(),
    lt = baseLang(lang) === "lt",
    parse = useServerFn(parseVoiceWorkoutLog);
  const [phase, setPhase] = useState<"idle" | "opening" | "recording" | "processing">("idle");
  const [draft, setDraft] = useState<{ transcription: string; data: VoiceSetDraft } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    active = useRef(true),
    lock = useRef(false),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state !== "inactive") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);
  const stop = () => {
    if (recorder.current?.state === "recording") {
      setPhase("processing");
      recorder.current.stop();
    }
  };
  const start = async () => {
    if (lock.current) return;
    lock.current = true;
    setPhase("opening");
    setDraft(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined")
        throw new Error("MEDIA_UNAVAILABLE");
      const mimeType = chooseAudioRecordingType((type) => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw new Error("MEDIA_UNAVAILABLE");
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current) {
        audioStream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = audioStream;
      const current = new MediaRecorder(audioStream, { mimeType });
      recorder.current = current;
      const chunks: Blob[] = [];
      let bytes = 0;
      current.ondataavailable = (event) => {
        if (event.data.size) {
          chunks.push(event.data);
          bytes += event.data.size;
          if (bytes > 12_000_000) stop();
        }
      };
      current.onerror = () => {
        current.onstop = null;
        audioStream.getTracks().forEach((track) => track.stop());
        if (timer.current) clearTimeout(timer.current);
        lock.current = false;
        if (active.current) {
          setPhase("idle");
          toast.error(lt ? "Įrašymas nepavyko." : "Recording failed.");
        }
      };
      current.onstop = () => {
        if (timer.current) clearTimeout(timer.current);
        audioStream.getTracks().forEach((track) => track.stop());
        if (!active.current) return;
        setPhase("processing");
        void (async () => {
          const blob = new Blob(chunks, { type: current.mimeType || mimeType });
          if (blob.size === 0 || blob.size > 12_000_000) throw new Error("AI_INVALID_MEDIA");
          const audioBase64 = await readAudio(blob);
          if (!active.current) return;
          const result = await parse({ data: { audioBase64, mimeType: blob.type, lang } });
          if (!active.current) return;
          if (!result.ok) throw new Error("AI_INVALID_RESPONSE");
          setDraft({ transcription: result.transcription, data: result.data });
        })()
          .catch((error) => {
            if (active.current) toast.error(aiErrorMessage(error, t));
          })
          .finally(() => {
            lock.current = false;
            if (active.current) setPhase("idle");
          });
      };
      current.start(250);
      setPhase("recording");
      timer.current = setTimeout(stop, 60_000);
    } catch {
      stream.current?.getTracks().forEach((track) => track.stop());
      lock.current = false;
      if (active.current) {
        setPhase("idle");
        toast.error(
          lt
            ? "Mikrofonas arba įrašymo formatas nepasiekiamas."
            : "Microphone or recording format is unavailable.",
        );
      }
    }
  };
  return (
    <section className="panel space-y-3 rounded-2xl p-4">
      <h3 className="font-semibold">{lt ? "Serijos juodraštis balsu" : "Voice set draft"}</h3>
      <p className="text-xs text-muted-foreground">
        {lt
          ? "Iki 60 sekundžių. AI gali suklysti. Peržiūrėk reikšmes — įrašas automatiškai neišsaugomas."
          : "Up to 60 seconds. AI can be wrong. Review the values; no set is saved automatically."}
      </p>
      <Button
        type="button"
        onClick={phase === "recording" ? stop : () => void start()}
        disabled={phase === "opening" || phase === "processing"}
        className="h-auto min-h-11 w-full whitespace-normal"
      >
        {phase === "recording" ? (
          <MicOff className="mr-2 size-4" />
        ) : phase === "idle" ? (
          <Mic className="mr-2 size-4" />
        ) : (
          <Loader2 className="mr-2 size-4 animate-spin" />
        )}
        {phase === "recording"
          ? lt
            ? "Baigti įrašą"
            : "Stop recording"
          : phase === "idle"
            ? lt
              ? "Įrašyti balsu"
              : "Record a set"
            : lt
              ? "Apdorojama…"
              : "Processing…"}
      </Button>
      {draft && (
        <div role="status" className="space-y-2 text-sm">
          <p className="break-words">{draft.transcription}</p>
          <p>
            {draft.data.exerciseName ?? "—"} · {draft.data.weightKg ?? "—"} kg ×{" "}
            {draft.data.reps ?? "—"} · RPE {draft.data.rpe ?? "—"}
          </p>
          {onSetLogged && (
            <Button
              type="button"
              variant="outline"
              className="h-auto min-h-11 w-full whitespace-normal"
              onClick={() => {
                onSetLogged(draft.data);
                setDraft(null);
              }}
            >
              {lt ? "Perkelti į formą ir patikrinti" : "Use draft in the form and review"}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
export default VoiceSetLogger;
