import {
  readThreeDLookVerifiedContract,
  verifyThreeDLookWebhook,
  type ThreeDLookVerifiedContract,
} from "./personalized-twin.provider-3dlook.server";
import { parseVerifiedPersonalizedTwinWebhook } from "./personalized-twin.provider-webhook.server";
import { dispatchPersonalizedTwinProviderWebhook } from "./personalized-twin.provider-dispatch.server";
import {
  fetchPersonalizedTwinModel,
  readPersonalizedTwinNetworkGate,
} from "./personalized-twin.provider-transport.server";

export async function handleThreeDLookPersonalizedTwinWebhook(
  request: Request,
  contract: ThreeDLookVerifiedContract | null = readThreeDLookVerifiedContract(),
): Promise<Response> {
  if (!contract) return new Response("provider contract unavailable", { status: 503 });
  const rawBody = new Uint8Array(await request.arrayBuffer());
  const signature = request.headers.get(contract.webhookSignatureHeader);
  let event;
  try {
    event = parseVerifiedPersonalizedTwinWebhook({
      rawBody,
      signature,
      verify: ({ rawBody: body, signature: value }) =>
        verifyThreeDLookWebhook({ body, signature: value, contract }),
    });
  } catch {
    return new Response("invalid webhook", { status: 401 });
  }

  try {
    const outcome = await dispatchPersonalizedTwinProviderWebhook({
      providerKey: "3dlook",
      providerJobId: event.providerJobId,
      eventId: event.eventId,
      response: event.result,
      fetchModel: (url) =>
        fetchPersonalizedTwinModel({
          url,
          gate: readPersonalizedTwinNetworkGate(),
        }),
    });
    return Response.json({ accepted: true, outcome }, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "PERSONALIZED_TWIN_WEBHOOK_FAILED";
    console.error(code);
    return new Response("webhook processing unavailable", { status: 503 });
  }
}
