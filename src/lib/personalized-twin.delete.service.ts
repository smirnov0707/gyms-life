export type PersonalizedTwinOwnedCapture = {
  captureSetId: string;
  userId: string;
  inputObjectPaths: readonly string[];
  modelObjectPath: string | null;
};

export interface PersonalizedTwinDeletePersistence {
  loadOwnedCapture(input: {
    captureSetId: string;
    userId: string;
  }): Promise<PersonalizedTwinOwnedCapture | null>;
  deleteCaptureSet(input: { captureSetId: string; userId: string }): Promise<void>;
}

export interface PersonalizedTwinDeleteStorage {
  removeInputs(paths: readonly string[]): Promise<void>;
  removeModels(paths: readonly string[]): Promise<void>;
}
export async function deletePersonalizedTwin(input: {
  captureSetId: string;
  userId: string;
  persistence: PersonalizedTwinDeletePersistence;
  storage: PersonalizedTwinDeleteStorage;
}): Promise<{ deleted: boolean }> {
  const capture = await input.persistence.loadOwnedCapture({
    captureSetId: input.captureSetId,
    userId: input.userId,
  });
  if (!capture) return { deleted: false };

  const inputPaths = [...new Set(capture.inputObjectPaths.filter(Boolean))];
  if (inputPaths.length) await input.storage.removeInputs(inputPaths);
  if (capture.modelObjectPath) await input.storage.removeModels([capture.modelObjectPath]);

  await input.persistence.deleteCaptureSet({
    captureSetId: capture.captureSetId,
    userId: capture.userId,
  });
  return { deleted: true };
}
