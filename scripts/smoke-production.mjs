const base = new URL(process.env.GYMSLIFE_SMOKE_BASE_URL ?? "https://gyms.life");

const routes = ["/", "/auth", "/app", "/twin", "/lab", "/progress", "/history"];
const timeoutMs = Number(process.env.GYMSLIFE_SMOKE_TIMEOUT_MS ?? 15000);

function failureReason(body) {
  try {
    const payload = JSON.parse(body);
    const error = typeof payload?.error === "string" ? payload.error : "";
    const message = typeof payload?.message === "string" ? payload.message : "";
    const reason = [error, message].filter(Boolean).join(": ").slice(0, 160);
    return reason ? ` reason=${JSON.stringify(reason)}` : "";
  } catch {
    return "";
  }
}

async function fetchWithTimeout(path, init = {}) {
  const url = new URL(path, base);
  const response = await fetch(url, {
    ...init,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "user-agent": "GYMS.LIFE-production-smoke/1.0", ...(init.headers ?? {}) },
  });
  return { url, response };
}

let failed = false;
for (const path of routes) {
  try {
    const { url, response } = await fetchWithTimeout(path);
    const body = await response.text();
    const ok = response.status === 200 && /<!doctype html>/i.test(body) && /GYMS\.LIFE/i.test(body);
    console.log(
      `${ok ? "PASS" : "FAIL"} ${url.pathname} status=${response.status} bytes=${body.length}${ok ? "" : failureReason(body)}`,
    );
    if (!ok) failed = true;
  } catch (error) {
    failed = true;
    console.error(`FAIL ${path} ${error instanceof Error ? error.message : String(error)}`);
  }
}

try {
  const { response } = await fetchWithTimeout("/.netlify/functions/night-lab");
  const body = await response.text();
  const ok = response.status === 403 || response.status === 401;
  console.log(
    `${ok ? "PASS" : "FAIL"} night-lab-public-guard status=${response.status}${ok ? "" : failureReason(body)}`,
  );
  if (!ok) failed = true;
} catch (error) {
  failed = true;
  console.error(
    `FAIL night-lab-public-guard ${error instanceof Error ? error.message : String(error)}`,
  );
}

if (failed) process.exitCode = 1;
