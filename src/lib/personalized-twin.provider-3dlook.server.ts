import type {
  PersonalizedTwinProviderInput,
  PersonalizedTwinReconstructionProvider,
} from "./personalized-twin.provider";

export type ThreeDLookProviderConfig = {
  apiBaseUrl: string;
  apiToken: string;
};

export function readThreeDLookProviderConfig(): ThreeDLookProviderConfig | null {
  const apiBaseUrl = process.env["THREEDLOOK_API_BASE_URL"]?.trim();
  const apiToken = process.env["THREEDLOOK_API_TOKEN"]?.trim();
  if (!apiBaseUrl || !apiToken) return null;
  return { apiBaseUrl, apiToken };
}

export class ThreeDLookPersonalizedTwinProvider implements PersonalizedTwinReconstructionProvider {
  readonly key = "3dlook";

  constructor(
    private readonly config: ThreeDLookProviderConfig | null = readThreeDLookProviderConfig(),
  ) {}

  async submit(_input: {
    captureReference: string;
    inputs: readonly PersonalizedTwinProviderInput[];
  }): Promise<{ providerJobId: string }> {
    if (!this.config) throw new Error("PERSONALIZED_TWIN_3DLOOK_NOT_CONFIGURED");
    throw new Error("PERSONALIZED_TWIN_3DLOOK_ADAPTER_REVIEW_REQUIRED");
  }

  async poll(
    _providerJobId: string,
  ): Promise<
    | { status: "processing" }
    | { status: "ready"; modelBytes: Uint8Array; contentType: "model/gltf-binary" }
    | { status: "failed"; errorCode: string }
  > {
    if (!this.config) throw new Error("PERSONALIZED_TWIN_3DLOOK_NOT_CONFIGURED");
    throw new Error("PERSONALIZED_TWIN_3DLOOK_ADAPTER_REVIEW_REQUIRED");
  }
}
