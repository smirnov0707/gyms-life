import type { PersonalizedTwinReconstructionProvider } from "./personalized-twin.provider";
import { finalizePersonalizedTwinProviderResult } from "./personalized-twin.terminalize.service";
import type {
  PersonalizedTwinTerminalPersistence,
  PersonalizedTwinTerminalStorage,
} from "./personalized-twin.terminalize.service";

export type PersonalizedTwinProviderTerminalResult = Exclude<
  Awaited<ReturnType<PersonalizedTwinReconstructionProvider["poll"]>>,
  { status: "processing" }
>;

export interface PersonalizedTwinProviderResultPersistence extends PersonalizedTwinTerminalPersistence {
  claimProviderEvent(input: {
    providerKey: string;
    providerJobId: string;
    eventKey: string;
  }): Promise<"claimed" | "duplicate">;
  acquireTerminalLease(input: {
    captureSetId: string;
    providerJobId: string;
    leaseUntil: string;
  }): Promise<"acquired" | "already_terminal" | "busy">;
  releaseTerminalLease(input: { captureSetId: string; providerJobId: string }): Promise<void>;
}
export async function acceptPersonalizedTwinProviderResult(input: {
  userId: string;
  captureSetId: string;
  providerKey: string;
  providerJobId: string;
  eventKey: string;
  rawInputPaths: readonly string[];
  result: PersonalizedTwinProviderTerminalResult;
  persistence: PersonalizedTwinProviderResultPersistence;
  storage: PersonalizedTwinTerminalStorage;
  now?: () => Date;
}): Promise<"duplicate" | "busy" | "terminalized"> {
  const eventClaim = await input.persistence.claimProviderEvent({
    providerKey: input.providerKey,
    providerJobId: input.providerJobId,
    eventKey: input.eventKey,
  });
  if (eventClaim === "duplicate") return "duplicate";

  const now = (input.now ?? (() => new Date()))();
  const lease = await input.persistence.acquireTerminalLease({
    captureSetId: input.captureSetId,
    providerJobId: input.providerJobId,
    leaseUntil: new Date(now.getTime() + 60_000).toISOString(),
  });
  if (lease !== "acquired") return "busy";

  try {
    await finalizePersonalizedTwinProviderResult({
      userId: input.userId,
      captureSetId: input.captureSetId,
      rawInputPaths: input.rawInputPaths,
      result:
        input.result.status === "ready"
          ? { status: "ready", modelBytes: input.result.modelBytes }
          : { status: "failed", errorCode: input.result.errorCode },
      persistence: input.persistence,
      storage: input.storage,
      now: () => now,
    });
    return "terminalized";
  } catch (error) {
    await input.persistence
      .releaseTerminalLease({
        captureSetId: input.captureSetId,
        providerJobId: input.providerJobId,
      })
      .catch(() => undefined);
    throw error;
  }
}
