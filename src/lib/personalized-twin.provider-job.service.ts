import type { PersonalizedTwinReconstructionProvider } from "./personalized-twin.provider";
import {
  canPollPersonalizedTwinProvider,
  nextPersonalizedTwinPollAt,
  type PersonalizedTwinProviderJobSnapshot,
} from "./personalized-twin.provider-job";
import { finalizePersonalizedTwinProviderResult } from "./personalized-twin.terminalize.service";
import type {
  PersonalizedTwinTerminalPersistence,
  PersonalizedTwinTerminalStorage,
} from "./personalized-twin.terminalize.service";

export interface PersonalizedTwinProviderJobPersistence extends PersonalizedTwinTerminalPersistence {
  scheduleNextPoll(input: {
    captureSetId: string;
    providerJobId: string;
    pollAttempt: number;
    nextPollAt: string;
  }): Promise<void>;
  acquireTerminalLease(input: {
    captureSetId: string;
    providerJobId: string;
    leaseUntil: string;
  }): Promise<"acquired" | "already_terminal" | "busy">;
  releaseTerminalLease(input: { captureSetId: string; providerJobId: string }): Promise<void>;
}
export async function processPersonalizedTwinProviderJob(input: {
  userId: string;
  job: PersonalizedTwinProviderJobSnapshot;
  rawInputPaths: readonly string[];
  provider: PersonalizedTwinReconstructionProvider;
  persistence: PersonalizedTwinProviderJobPersistence;
  storage: PersonalizedTwinTerminalStorage;
  now?: () => Date;
}): Promise<"skipped" | "processing" | "terminalized"> {
  if (input.provider.key !== input.job.providerKey)
    throw new Error("PERSONALIZED_TWIN_PROVIDER_KEY_MISMATCH");

  const now = (input.now ?? (() => new Date()))();
  if (
    !canPollPersonalizedTwinProvider({
      status: input.job.status,
      nextPollAt: input.job.nextPollAt,
      now,
    })
  )
    return "skipped";

  const result = await input.provider.poll(input.job.providerJobId);
  if (result.status === "processing") {
    const pollAttempt = input.job.pollAttempt + 1;
    await input.persistence.scheduleNextPoll({
      captureSetId: input.job.captureSetId,
      providerJobId: input.job.providerJobId,
      pollAttempt,
      nextPollAt: nextPersonalizedTwinPollAt({ attempt: pollAttempt, now }),
    });
    return "processing";
  }

  const leaseUntil = new Date(now.getTime() + 60_000).toISOString();
  const lease = await input.persistence.acquireTerminalLease({
    captureSetId: input.job.captureSetId,
    providerJobId: input.job.providerJobId,
    leaseUntil,
  });
  if (lease === "already_terminal" || lease === "busy") return "skipped";

  try {
    await finalizePersonalizedTwinProviderResult({
      userId: input.userId,
      captureSetId: input.job.captureSetId,
      rawInputPaths: input.rawInputPaths,
      result:
        result.status === "ready"
          ? { status: "ready", modelBytes: result.modelBytes }
          : { status: "failed", errorCode: result.errorCode },
      persistence: input.persistence,
      storage: input.storage,
      now: () => now,
    });
    return "terminalized";
  } catch (error) {
    await input.persistence
      .releaseTerminalLease({
        captureSetId: input.job.captureSetId,
        providerJobId: input.job.providerJobId,
      })
      .catch(() => undefined);
    throw error;
  }
}
