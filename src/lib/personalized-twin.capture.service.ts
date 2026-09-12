import { createHash } from "node:crypto";
import {
  PERSONALIZED_TWIN_REQUIRED_ANGLES,
  type PersonalizedTwinAngle,
} from "./personalized-twin.schema";

export type PersonalizedTwinCaptureFile = {
  angle: PersonalizedTwinAngle;
  bytes: Uint8Array;
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

export interface PersonalizedTwinCapturePersistence {
  createCaptureSet(input: {
    userId: string;
    consentVersion: "personalized_twin_v1";
    consentedAt: string;
  }): Promise<{ id: string }>;
  addImageMetadata(input: {
    captureSetId: string;
    userId: string;
    angle: PersonalizedTwinAngle;
    objectPath: string;
    contentType: PersonalizedTwinCaptureFile["contentType"];
    byteSize: number;
    sha256: string;
  }): Promise<void>;
  markReadyForProvider(input: { captureSetId: string; userId: string }): Promise<void>;
  deleteCaptureSet(input: { captureSetId: string; userId: string }): Promise<void>;
}

export interface PersonalizedTwinCaptureStorage {
  put(input: {
    path: string;
    bytes: Uint8Array;
    contentType: PersonalizedTwinCaptureFile["contentType"];
  }): Promise<void>;
  remove(paths: readonly string[]): Promise<void>;
}

const extensionFor = (contentType: PersonalizedTwinCaptureFile["contentType"]) =>
  contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";

export async function persistPersonalizedTwinCaptureSet(input: {
  userId: string;
  consentGranted: boolean;
  providerAvailable: boolean;
  files: readonly PersonalizedTwinCaptureFile[];
  now?: () => Date;
  persistence: PersonalizedTwinCapturePersistence;
  storage: PersonalizedTwinCaptureStorage;
}): Promise<{ captureSetId: string; objectPaths: Record<PersonalizedTwinAngle, string> }> {
  if (!input.providerAvailable) throw new Error("PERSONALIZED_TWIN_PROVIDER_UNAVAILABLE");
  if (!input.consentGranted) throw new Error("PERSONALIZED_TWIN_CONSENT_REQUIRED");

  const byAngle = new Map(input.files.map((file) => [file.angle, file] as const));
  if (byAngle.size !== PERSONALIZED_TWIN_REQUIRED_ANGLES.length)
    throw new Error("PERSONALIZED_TWIN_THREE_VIEWS_REQUIRED");
  for (const angle of PERSONALIZED_TWIN_REQUIRED_ANGLES)
    if (!byAngle.has(angle)) throw new Error("PERSONALIZED_TWIN_THREE_VIEWS_REQUIRED");

  const captureSet = await input.persistence.createCaptureSet({
    userId: input.userId,
    consentVersion: "personalized_twin_v1",
    consentedAt: (input.now ?? (() => new Date()))().toISOString(),
  });
  const uploaded: string[] = [];
  const objectPaths = {} as Record<PersonalizedTwinAngle, string>;

  try {
    for (const angle of PERSONALIZED_TWIN_REQUIRED_ANGLES) {
      const file = byAngle.get(angle)!;
      const path = `${input.userId}/${captureSet.id}/${angle}.${extensionFor(file.contentType)}`;
      await input.storage.put({ path, bytes: file.bytes, contentType: file.contentType });
      uploaded.push(path);
      const sha256 = createHash("sha256").update(file.bytes).digest("hex");
      await input.persistence.addImageMetadata({
        captureSetId: captureSet.id,
        userId: input.userId,
        angle,
        objectPath: path,
        contentType: file.contentType,
        byteSize: file.bytes.byteLength,
        sha256,
      });
      objectPaths[angle] = path;
    }
    await input.persistence.markReadyForProvider({
      captureSetId: captureSet.id,
      userId: input.userId,
    });
    return { captureSetId: captureSet.id, objectPaths };
  } catch (error) {
    await input.storage.remove(uploaded).catch(() => undefined);
    await input.persistence
      .deleteCaptureSet({ captureSetId: captureSet.id, userId: input.userId })
      .catch(() => undefined);
    throw error;
  }
}
