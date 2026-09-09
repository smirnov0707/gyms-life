import { Environment, Paddle, EventName } from "@paddle/paddle-node-sdk";

const getEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export { EventName };
export type PaddleEnv = "sandbox" | "live";

function getBaseUrl(env: PaddleEnv): string {
  return env === "sandbox" ? "https://sandbox-api.paddle.com" : "https://api.paddle.com";
}

export function getConnectionApiKey(env: PaddleEnv): string {
  return env === "sandbox" ? getEnv("PADDLE_SANDBOX_API_KEY") : getEnv("PADDLE_LIVE_API_KEY");
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  return new Paddle(getConnectionApiKey(env), {
    environment: env === "sandbox" ? Environment.sandbox : Environment.production,
  });
}

/** Direct Paddle REST API access for endpoints not exposed by the SDK. */
export async function gatewayFetch(
  env: PaddleEnv,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const apiKey = getConnectionApiKey(env);
  const response = await fetch(`${getBaseUrl(env)}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(15000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...init?.headers,
    },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error("PADDLE_API_UNAVAILABLE");
  }
  return response;
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === "sandbox"
    ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET")
    : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");
}

export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get("paddle-signature");
  const body = await readWebhookBody(req);
  const secret = getWebhookSecret(env);
  if (!signature || !body) throw new Error("Missing signature or body");
  const paddle = getPaddleClient(env);
  return await paddle.webhooks.unmarshal(body, secret, signature);
}

const WEBHOOK_BYTE_LIMIT = 1_048_576;
async function readWebhookBody(request: Request): Promise<string> {
  if (!request.body) throw new Error("PADDLE_EMPTY_BODY");
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > WEBHOOK_BYTE_LIMIT) {
        await reader.cancel();
        throw new Error("PADDLE_BODY_LIMIT");
      }
      chunks.push(item.value);
    }
  } finally {
    reader.releaseLock();
  }
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(joined);
}
