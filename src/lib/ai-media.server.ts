import type { ModelMessage } from "ai";
import { z } from "zod";
import { SupportedLanguageSchema } from "./language.schema";
export const MAX_INLINE_IMAGE_BYTES = 4_000_000;
export const MAX_INLINE_AUDIO_BYTES = 12_000_000;
function decodeBase64(raw: string, limit: number): Uint8Array {
  if (
    raw.length === 0 ||
    raw.length > Math.ceil(limit / 3) * 4 ||
    raw.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)
  )
    throw new Error("AI_INVALID_MEDIA");
  const bytes = Buffer.from(raw, "base64");
  if (bytes.length === 0 || bytes.length > limit || bytes.toString("base64") !== raw)
    throw new Error("AI_INVALID_MEDIA");
  return new Uint8Array(bytes);
}
export function validateImageData(value: unknown): number {
  if (typeof value !== "string" || value.length > Math.ceil(MAX_INLINE_IMAGE_BYTES / 3) * 4 + 100)
    throw new Error("AI_INVALID_MEDIA");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new Error("AI_INVALID_MEDIA");
  const bytes = decodeBase64(match[2]!, MAX_INLINE_IMAGE_BYTES);
  const kind = match[1],
    png = [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp =
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!(kind === "image/png" ? png : kind === "image/jpeg" ? jpeg : webp))
    throw new Error("AI_INVALID_MEDIA");
  return bytes.length;
}
export function validateAiInput(
  input: { prompt?: string; system?: string; messages?: ModelMessage[]; maxOutputTokens?: number },
  vision: boolean,
): void {
  let chars = (input.prompt?.length ?? 0) + (input.system?.length ?? 0),
    images = 0,
    bytes = 0;
  if (input.prompt !== undefined && input.messages !== undefined)
    throw new Error("AI_INVALID_REQUEST");
  if (
    input.maxOutputTokens !== undefined &&
    (!Number.isInteger(input.maxOutputTokens) ||
      input.maxOutputTokens < 1 ||
      input.maxOutputTokens > 20_000)
  )
    throw new Error("AI_INVALID_REQUEST");
  if (input.messages && (input.messages.length === 0 || input.messages.length > 24))
    throw new Error("AI_INVALID_REQUEST");
  for (const message of input.messages ?? []) {
    if (message.role !== "user" && message.role !== "assistant")
      throw new Error("AI_INVALID_REQUEST");
    if (typeof message.content === "string") {
      chars += message.content.length;
      continue;
    }
    for (const part of message.content) {
      if (part.type === "text") chars += part.text.length;
      else if (part.type === "image") {
        if (!vision) throw new Error("AI_UNSUPPORTED_MODALITY");
        images++;
        bytes += validateImageData(part.image);
      } else throw new Error("AI_UNSUPPORTED_MODALITY");
    }
  }
  if (
    chars > 500_000 ||
    images > 6 ||
    bytes > 12_000_000 ||
    (!input.prompt?.trim() && !input.messages?.length)
  )
    throw new Error("AI_INVALID_REQUEST");
  if (vision && images === 0) throw new Error("AI_INVALID_MEDIA");
}
const AUDIO_EXTENSIONS = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
} as const;
export function parseAudioUpload(input: {
  audioBase64: string;
  mimeType: string;
  language: string;
}) {
  const language = SupportedLanguageSchema.parse(input.language);
  const type = input.mimeType.toLowerCase().split(";")[0]!;
  const mime = z
    .enum(["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav", "audio/ogg"])
    .parse(type);
  let raw = input.audioBase64;
  if (raw.startsWith("data:")) {
    const delimiter = raw.indexOf(","),
      header = raw.slice(5, delimiter);
    if (delimiter < 0 || !header.endsWith(";base64") || header.split(";")[0] !== mime)
      throw new Error("AI_INVALID_MEDIA");
    raw = raw.slice(delimiter + 1);
  }
  return {
    bytes: decodeBase64(raw, MAX_INLINE_AUDIO_BYTES),
    mimeType: mime,
    fileName: `workout-audio.${AUDIO_EXTENSIONS[mime]}`,
    language,
  };
}
