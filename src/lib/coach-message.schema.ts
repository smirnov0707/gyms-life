import type { Tables } from "@/integrations/supabase/types";
import { z } from "zod";

/**
 * How many turns of the conversation go to the provider with each question.
 *
 * Exported so that the privacy card on the Coach screen states this number
 * rather than a number somebody wrote down once. The card used to say chat
 * history was never sent while `askCoach` sent ten turns of it, and a copy
 * that quotes the constant cannot drift away from the code the way a
 * hand-written sentence did.
 */
export const COACH_HISTORY_TURNS = 10;

export const CoachMessageRoleSchema = z.enum(["user", "coach"]);

export const CoachHistoryMessageSchema = z.object({
  id: z.string().uuid(),
  role: CoachMessageRoleSchema,
  content: z.string().trim().min(1),
  createdAt: z.string().datetime({ offset: true }),
});

export type CoachHistoryMessage = z.infer<typeof CoachHistoryMessageSchema>;

type CoachMessageRow = Pick<Tables<"coach_messages">, "id" | "role" | "content" | "created_at">;

/**
 * Database rows remain untrusted at the domain boundary. A malformed legacy
 * message is omitted rather than becoming a client-visible chat entry.
 */
export function parseCoachMessageHistory(rows: readonly CoachMessageRow[]): CoachHistoryMessage[] {
  return rows.flatMap((row) => {
    const parsed = CoachHistoryMessageSchema.safeParse({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    });
    return parsed.success ? [parsed.data] : [];
  });
}
