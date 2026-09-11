import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type {
  PersonalizedTwinProviderInput,
  PersonalizedTwinReconstructionProvider,
} from "./personalized-twin.provider";

export const ThreeDLookVerifiedContractSchema = z.object({
  apiBaseUrl: z.string().url(),
  apiToken: z.string().min(1),
  apiKeyHeader: z.string().min(1),
  submitPath: z.string().startsWith("/"),
  statusPathTemplate: z.string().includes("{jobId}"),
  modelPathTemplate: z.string().includes("{jobId}"),
  webhookSignatureHeader: z.string().min(1),
  webhookSecret: z.string().min(1),
  webhookAlgorithm: z.literal("sha256"),
});
export type ThreeDLookVerifiedContract = z.infer<typeof ThreeDLookVerifiedContractSchema>;

export function readThreeDLookVerifiedContract(): ThreeDLookVerifiedContract | null {
  const candidate = {
    apiBaseUrl: process.env["THREEDLOOK_API_BASE_URL"],
    apiToken: process.env["THREEDLOOK_API_TOKEN"],
    apiKeyHeader: process.env["THREEDLOOK_API_KEY_HEADER"],
    submitPath: process.env["THREEDLOOK_SUBMIT_PATH"],
    statusPathTemplate: process.env["THREEDLOOK_STATUS_PATH_TEMPLATE"],
    modelPathTemplate: process.env["THREEDLOOK_MODEL_PATH_TEMPLATE"],
    webhookSignatureHeader: process.env["THREEDLOOK_WEBHOOK_SIGNATURE_HEADER"],
    webhookSecret: process.env["THREEDLOOK_WEBHOOK_SECRET"],
    webhookAlgorithm: process.env["THREEDLOOK_WEBHOOK_ALGORITHM"],
  };
  const parsed = ThreeDLookVerifiedContractSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export function verifyThreeDLookWebhook(input: {
  body: Uint8Array;
  signature: string;
  contract: ThreeDLookVerifiedContract;
}): boolean {
  const expected = createHmac(input.contract.webhookAlgorithm, input.contract.webhookSecret)
    .update(input.body)
    .digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(input.signature.trim());
  return left.length === right.length && timingSafeEqual(left, right);
}

export class ThreeDLookPersonalizedTwinProvider implements PersonalizedTwinReconstructionProvider {
  readonly key = "3dlook";

  constructor(
    private readonly contract: ThreeDLookVerifiedContract | null = readThreeDLookVerifiedContract(),
  ) {}

  async submit(_input: {
    captureReference: string;
    inputs: readonly PersonalizedTwinProviderInput[];
  }): Promise<{ providerJobId: string }> {
    if (!this.contract) throw new Error("PERSONALIZED_TWIN_3DLOOK_CONTRACT_UNVERIFIED");
    throw new Error("PERSONALIZED_TWIN_3DLOOK_NETWORK_DISABLED_PENDING_DPA");
  }

  async poll(
    _providerJobId: string,
  ): Promise<
    | { status: "processing" }
    | { status: "ready"; modelBytes: Uint8Array; contentType: "model/gltf-binary" }
    | { status: "failed"; errorCode: string }
  > {
    if (!this.contract) throw new Error("PERSONALIZED_TWIN_3DLOOK_CONTRACT_UNVERIFIED");
    throw new Error("PERSONALIZED_TWIN_3DLOOK_NETWORK_DISABLED_PENDING_DPA");
  }
}
