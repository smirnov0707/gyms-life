import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { observeServerAction } from "./observability.server";
import { CorrectUserMemoryInputSchema } from "./user-memory.schema";

const MemoryIdInputSchema = z.object({ memoryId: z.string().uuid() }).strict();

/** Returns validated, user-visible long-term memory through the authenticated server boundary. */
export const getUserMemoryTransparency = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadUserMemoryTransparency } = await import("./user-memory.service");
    return loadUserMemoryTransparency(context.supabase, context.userId);
  });

/** Lets a user reject a memory while retaining an app-owned correction audit trail. */
export const markMemoryIncorrect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => MemoryIdInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "user_memory.mark_incorrect",
        userId: context.userId,
        failureCode: "USER_MEMORY_MARK_INCORRECT_FAILED",
        metadata: {},
      },
      async () => {
        const { markUserMemoryIncorrect } = await import("./user-memory.service");
        await markUserMemoryIncorrect(context.supabase, context.userId, data.memoryId);
        return { ok: true };
      },
    ),
  );

/** Replaces one active memory with an explicit correction and retained audit trail. */
export const correctMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CorrectUserMemoryInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "user_memory.correct",
        userId: context.userId,
        failureCode: "USER_MEMORY_CORRECT_FAILED",
        metadata: {},
      },
      async () => {
        const { correctUserMemory } = await import("./user-memory.service");
        return correctUserMemory(context.supabase, context.userId, data);
      },
    ),
  );

/** Lets a user permanently remove one of their own active memory entries. */
export const forgetMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => MemoryIdInputSchema.parse(input))
  .handler(async ({ data, context }) =>
    observeServerAction(
      {
        eventName: "user_memory.forget",
        userId: context.userId,
        failureCode: "USER_MEMORY_FORGET_FAILED",
        metadata: {},
      },
      async () => {
        const { forgetUserMemory } = await import("./user-memory.service");
        await forgetUserMemory(context.supabase, context.userId, data.memoryId);
        return { ok: true };
      },
    ),
  );
