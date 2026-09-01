import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { askFastTextAi } from "./ai-gateway.server";

const VoiceLogInput = z.object({ audioBase64: z.string().min(10), mimeType: z.string().default("audio/webm"), lang: z.string().default("lt") });

export const parseVoiceWorkoutLog = createServerFn({ method: "POST" })
  .validator((data: unknown) => VoiceLogInput.parse(data))
  .handler(async ({ data }) => {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return { ok: false, reason: "Balso apdorojimo variklis nesukonfigūruotas." };
    try {
      const rawBase64 = data.audioBase64.includes(",") ? (data.audioBase64.split(",")[1] ?? "") : data.audioBase64;
      if (!rawBase64) return { ok: false, reason: "Tuščias balso įrašas." };
      const audioBuffer = Buffer.from(rawBase64, "base64");
      const audioBytes = new Uint8Array(audioBuffer.length);
      audioBytes.set(audioBuffer);
      const blob = new Blob([audioBytes.buffer], { type: data.mimeType });
      const formData = new FormData();
      formData.append("file", blob, "workout-audio.webm");
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("language", data.lang === "lt" ? "lt" : "en");
      formData.append("temperature", "0.0");

      const whisperRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${groqKey}` }, body: formData });
      if (!whisperRes.ok) {
        console.error("Groq Whisper error:", await whisperRes.text());
        return { ok: false, reason: "Nepavyko atpažinti balso įrašo." };
      }
      const whisperData = await whisperRes.json();
      const transcription = whisperData.text?.trim() || "";
      if (!transcription) return { ok: false, reason: "Balso įraše neaptikta kalba." };

      const prompt = `Sportininkas salėje ištarė šį sakinį apie atliktą seriją: "${transcription}".
Ištrauk šiuos duomenis ir grąžink TIK JSON formatu:
{"exerciseName":"Taisyklingas pratimo pavadinimas","weightKg":100,"reps":8,"rpe":8,"suggestedRestSeconds":90,"coachFeedback":"Trumpas 1 sakinio įvertinimas"}`;
      const aiParsed = await askFastTextAi({ messages: [{ role: "system", content: "Atsakyk TIK JSON formatu." }, { role: "user", content: prompt }], jsonMode: true, temperature: 0.1 });
      return { ok: true, transcription, data: JSON.parse(aiParsed.replace(/```json/g, "").replace(/```/g, "").trim()) };
    } catch (err: any) {
      console.error("Voice parse error:", err);
      return { ok: false, reason: err.message || "Balso apdorojimo klaida." };
    }
  });
