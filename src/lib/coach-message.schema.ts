import type { Tables } from "@/integrations/supabase/types";
import { z } from "zod";

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
