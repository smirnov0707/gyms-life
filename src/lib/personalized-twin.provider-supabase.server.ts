import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { PersonalizedTwinProviderSubmissionPersistence } from "./personalized-twin.provider-submit.service";
import type { PersonalizedTwinProviderJobPersistence } from "./personalized-twin.provider-job.service";
import type { PersonalizedTwinProviderResultPersistence } from "./personalized-twin.provider-result.service";

function assertNoRpcError(error: { message: string } | null, code: string): void {
  if (error) throw new Error(`${code}:${error.message}`);
}

function parseSubmissionClaim(data: Json): "claimed" | "busy" | { providerJobId: string } {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new Error("PERSONALIZED_TWIN_INVALID_SUBMISSION_CLAIM_RESPONSE");
  if (data["state"] === "claimed") return "claimed";
  if (data["state"] === "busy") return "busy";
  if (data["state"] === "existing" && typeof data["providerJobId"] === "string")
    return { providerJobId: data["providerJobId"] };
  throw new Error("PERSONALIZED_TWIN_INVALID_SUBMISSION_CLAIM_RESPONSE");
}

async function markTerminal(input: {
  userId: string;
  captureSetId: string;
  status: "ready" | "failed";
  inputDeletedAt: string;
  modelObjectPath?: string;
  errorCode?: string;
}): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("personalized_twin_capture_sets")
    .update({
      status: input.status,
      input_deleted_at: input.inputDeletedAt,
      model_object_path: input.modelObjectPath ?? null,
      error_code: input.errorCode ?? null,
      provider_terminal_lease_until: null,
    })
    .eq("id", input.captureSetId)
    .eq("user_id", input.userId)
    .eq("status", "processing")
    .select("id")
    .maybeSingle();
  assertNoRpcError(error, "PERSONALIZED_TWIN_TERMINAL_PERSIST_FAILED");
  if (!data) throw new Error("PERSONALIZED_TWIN_TERMINAL_STATE_LOST");
}

export const personalizedTwinSupabaseSubmissionPersistence: PersonalizedTwinProviderSubmissionPersistence =
  {
    async claimSubmission(input) {
      const { data, error } = await supabaseAdmin.rpc(
        "claim_personalized_twin_provider_submission",
        {
          p_user_id: input.userId,
          p_capture_set_id: input.captureSetId,
          p_provider_key: input.providerKey,
          p_claim_token: input.claimToken,
          p_claim_until: input.claimUntil,
        },
      );
      assertNoRpcError(error, "PERSONALIZED_TWIN_SUBMISSION_CLAIM_FAILED");
      return parseSubmissionClaim(data);
    },
    async releaseSubmissionClaim(input) {
      const { error } = await supabaseAdmin.rpc("release_personalized_twin_provider_submission", {
        p_user_id: input.userId,
        p_capture_set_id: input.captureSetId,
        p_claim_token: input.claimToken,
      });
      assertNoRpcError(error, "PERSONALIZED_TWIN_SUBMISSION_RELEASE_FAILED");
    },
    async markProcessing(input) {
      const { error } = await supabaseAdmin.rpc("complete_personalized_twin_provider_submission", {
        p_user_id: input.userId,
        p_capture_set_id: input.captureSetId,
        p_provider_key: input.providerKey,
        p_provider_job_id: input.providerJobId,
        p_claim_token: input.claimToken,
      });
      assertNoRpcError(error, "PERSONALIZED_TWIN_SUBMISSION_COMPLETE_FAILED");
    },
  };

export const personalizedTwinSupabaseJobPersistence: PersonalizedTwinProviderJobPersistence = {
  async markReady(input) {
    await markTerminal({ ...input, status: "ready" });
  },
  async markFailed(input) {
    await markTerminal({ ...input, status: "failed" });
  },
  async scheduleNextPoll(input) {
    const { error } = await supabaseAdmin.rpc("schedule_personalized_twin_provider_poll", {
      p_capture_set_id: input.captureSetId,
      p_provider_job_id: input.providerJobId,
      p_poll_attempt: input.pollAttempt,
      p_next_poll_at: input.nextPollAt,
    });
    assertNoRpcError(error, "PERSONALIZED_TWIN_POLL_SCHEDULE_FAILED");
  },
  async acquireTerminalLease(input) {
    const { data, error } = await supabaseAdmin.rpc(
      "acquire_personalized_twin_provider_terminal_lease",
      {
        p_capture_set_id: input.captureSetId,
        p_provider_job_id: input.providerJobId,
        p_lease_until: input.leaseUntil,
      },
    );
    assertNoRpcError(error, "PERSONALIZED_TWIN_TERMINAL_LEASE_FAILED");
    if (data === "acquired" || data === "already_terminal" || data === "busy") return data;
    throw new Error("PERSONALIZED_TWIN_INVALID_TERMINAL_LEASE_RESPONSE");
  },
  async releaseTerminalLease(input) {
    const { error } = await supabaseAdmin.rpc("release_personalized_twin_provider_terminal_lease", {
      p_capture_set_id: input.captureSetId,
      p_provider_job_id: input.providerJobId,
    });
    assertNoRpcError(error, "PERSONALIZED_TWIN_TERMINAL_LEASE_RELEASE_FAILED");
  },
};

export const personalizedTwinSupabaseResultPersistence: PersonalizedTwinProviderResultPersistence =
  {
    markReady: personalizedTwinSupabaseJobPersistence.markReady,
    markFailed: personalizedTwinSupabaseJobPersistence.markFailed,
    async claimProviderEvent(input) {
      const { data, error } = await supabaseAdmin.rpc("claim_personalized_twin_provider_event", {
        p_provider_key: input.providerKey,
        p_provider_job_id: input.providerJobId,
        p_event_key: input.eventKey,
      });
      assertNoRpcError(error, "PERSONALIZED_TWIN_PROVIDER_EVENT_CLAIM_FAILED");
      if (data === "claimed" || data === "duplicate") return data;
      throw new Error("PERSONALIZED_TWIN_INVALID_PROVIDER_EVENT_RESPONSE");
    },
    acquireTerminalLease: personalizedTwinSupabaseJobPersistence.acquireTerminalLease,
    releaseTerminalLease: personalizedTwinSupabaseJobPersistence.releaseTerminalLease,
  };
