import { z } from "zod";
export const MAX_AI_TEXT_CHARS = 200_000;
/** Provider output must finish, not just happen to include an earlier closed object. */
export function requireCompleteAiText(text: unknown, finishReason: unknown): string {
  if (finishReason === "length") throw new Error("AI_RESPONSE_TRUNCATED");
  if (finishReason === "content-filter") throw new Error("AI_RESPONSE_REFUSED");
  if (finishReason !== "stop") throw new Error("AI_INVALID_RESPONSE");
  if (typeof text !== "string" || !text.trim() || text.length > MAX_AI_TEXT_CHARS)
    throw new Error("AI_INVALID_RESPONSE");
  return text.trim();
}
export function aiSchemaInstruction<T>(schema: z.ZodType<T, unknown>): string {
  let shape: string;
  try {
    shape = JSON.stringify(z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }));
  } catch {
    throw new Error("AI_SCHEMA_UNAVAILABLE");
  }
  if (shape.length > 80_000) throw new Error("AI_SCHEMA_UNAVAILABLE");
  return `OUTPUT CONTRACT (JSON Schema; validated again by GYMS.LIFE):\n${shape}\nReturn one complete JSON value matching this contract. Do not omit required fields. Never invent measurements to satisfy a schema; use permitted nulls or an explicit failure variant.`;
}
