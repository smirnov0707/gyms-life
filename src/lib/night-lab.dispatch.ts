/** A validated explicit target, not a build/environment URL. Queued is not completed. */
export async function dispatchNightLab(
  input: { origin?: string; secret?: string | undefined },
  transport: typeof fetch = fetch,
): Promise<{ status: "queued" } | { status: "unavailable" }> {
  const { origin, secret } = input;
  if (!secret || /[\s,]/.test(secret) || !origin) return { status: "unavailable" };
  try {
    const base = new URL(origin);
    if (
      base.protocol !== "https:" ||
      base.username ||
      base.password ||
      base.port ||
      base.pathname !== "/" ||
      base.search ||
      base.hash
    )
      return { status: "unavailable" };
    const url = new URL("/.netlify/functions/night-lab-worker-background", base);
    const response = await transport(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    await response.body?.cancel();
    return { status: response.status === 202 ? "queued" : "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
