import { assertPersonalizedTwinTransition } from "./personalized-twin.lifecycle";

export interface PersonalizedTwinTerminalPersistence {
  markReady(input: {
    userId: string;
    captureSetId: string;
    inputDeletedAt: string;
    modelObjectPath: string;
  }): Promise<void>;
  markFailed(input: {
    userId: string;
    captureSetId: string;
    inputDeletedAt: string;
    errorCode: string;
  }): Promise<void>;
}

export interface PersonalizedTwinTerminalStorage {
  putModel(input: { path: string; bytes: Uint8Array }): Promise<void>;
  removeInputs(paths: readonly string[]): Promise<void>;
  removeModels(paths: readonly string[]): Promise<void>;
}
export async function finalizePersonalizedTwinProviderResult(input: {
  userId: string;
  captureSetId: string;
  rawInputPaths: readonly string[];
  result: { status: "ready"; modelBytes: Uint8Array } | { status: "failed"; errorCode: string };
  persistence: PersonalizedTwinTerminalPersistence;
  storage: PersonalizedTwinTerminalStorage;
  now?: () => Date;
}): Promise<void> {
  const inputDeletedAt = (input.now ?? (() => new Date()))().toISOString();

  if (input.result.status === "failed") {
    await input.storage.removeInputs(input.rawInputPaths);
    assertPersonalizedTwinTransition({
      from: "processing",
      to: "failed",
      inputDeletedAt,
      errorCode: input.result.errorCode,
    });
    await input.persistence.markFailed({
      userId: input.userId,
      captureSetId: input.captureSetId,
      inputDeletedAt,
      errorCode: input.result.errorCode,
    });
    return;
  }
  const modelObjectPath = `${input.userId}/${input.captureSetId}/avatar.glb`;
  await input.storage.putModel({ path: modelObjectPath, bytes: input.result.modelBytes });

  try {
    await input.storage.removeInputs(input.rawInputPaths);
    assertPersonalizedTwinTransition({
      from: "processing",
      to: "ready",
      inputDeletedAt,
      modelObjectPath,
    });
    await input.persistence.markReady({
      userId: input.userId,
      captureSetId: input.captureSetId,
      inputDeletedAt,
      modelObjectPath,
    });
  } catch (error) {
    await input.storage.removeModels([modelObjectPath]).catch(() => undefined);
    throw error;
  }
}
