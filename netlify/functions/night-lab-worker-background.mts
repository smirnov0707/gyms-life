import { currentNightLabTarget } from "../../src/lib/night-lab.dispatch.server";
import type { Config, Context } from "@netlify/functions";
import { authenticateCronRequest } from "../../src/integrations/supabase/cron-auth";
/** Same domain modules as the application, bundled once for a longer-lived worker. */
export default async function nightLabWorker(
  request: Request,
  context: Context,
): Promise<Response> {
  const rejection = await authenticateCronRequest(request);
  if (rejection) {
    console.error("NIGHT_LAB_WORKER_AUTH_REJECTED", rejection.status);
    if (rejection.status >= 500) throw new Error("NIGHT_LAB_WORKER_CONFIG_UNAVAILABLE");
    return rejection;
  }
  if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
  if (!currentNightLabTarget(() => context)) throw new Error("NIGHT_LAB_ENVIRONMENT_UNSAFE");
  const { runNightLab } = await import("../../src/lib/night-lab.server");
  const report = await runNightLab();
  if (
    report.status === "unavailable" ||
    (report.status === "ran" && (!report.recorded || report.outcome.status === "failed"))
  )
    throw new Error("NIGHT_LAB_WORK_NOT_CONFIRMED");
  console.log("NIGHT_LAB_FINISHED", report.status);
  return new Response(null, { status: 204 });
}
export const config: Config = { background: true };
