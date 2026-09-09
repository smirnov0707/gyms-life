/** Deployment-owned origin only. A scheduler receipt is not proof that analysis finished. */
export async function dispatchNightLab(
  env: Record<string, string | undefined> = process.env,
  transport: typeof fetch = fetch,
): Promise<{ status: "queued" } | { status: "unavailable" }> {
  const secret = env["GYMSLIFE_CRON_SECRET"],
    base = env["URL"];
  if (!secret?.trim() || !base) return { status: "unavailable" };
  try {
    const url = new URL("/.netlify/functions/night-lab-worker-background", base);
    if (url.protocol !== "https:" || url.username || url.password) return { status: "unavailable" };
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
