import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { recordObservabilityEvent } from "./observability.server";

/**
 * Erasure, which the privacy policy promised and the app could not perform.
 *
 * Section 6 states the right to erase and a one-month response. There was no
 * mechanism anywhere — no screen, no server function, nothing. The policy was
 * making a commitment on behalf of code that did not exist.
 *
 * The deletion is the database's decision, not a list kept here. 33 tables
 * carry `user_id references auth.users(id) on delete cascade`, so removing the
 * auth user removes what it owns, and a table added tomorrow is covered the
 * moment it declares that reference —
 * `account-erasure-coverage.test.ts` is what keeps that true.
 * A hand-written list of 33 deletes would have been one forgotten table away
 * from an erasure that was not one.
 */

/**
 * What the athlete types to confirm. Not a yes/no: this cannot be undone, and a
 * misplaced tap on a phone should not be able to do it.
 */
export const DELETE_ACCOUNT_CONFIRMATION = "DELETE";

const DeleteAccountInput = z.object({
  confirmation: z.literal(DELETE_ACCOUNT_CONFIRMATION),
});

export type DeleteAccountResult =
  { status: "deleted" } | { status: "refused"; reason: "DELETE_ACCOUNT_PROVIDER_REFUSED" };

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(DeleteAccountInput)
  .handler(async ({ context }): Promise<DeleteAccountResult> => {
    const userId = context.userId;

    // Written before the delete, not after: `app_observability_events.user_id`
    // is `on delete set null`, so this row survives the account and stops
    // naming the person — which is the point. Recorded first because after the
    // cascade there is no user id left to attribute it to.
    await recordObservabilityEvent({
      eventName: "account.erasure",
      outcome: "success",
      userId,
      metadata: { requested_by: "athlete" },
    });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      await recordObservabilityEvent({
        eventName: "account.erasure",
        outcome: "failure",
        userId,
        errorCode: "DELETE_ACCOUNT_PROVIDER_REFUSED",
        metadata: { requested_by: "athlete" },
      });
      return { status: "refused", reason: "DELETE_ACCOUNT_PROVIDER_REFUSED" };
    }
    return { status: "deleted" };
  });
