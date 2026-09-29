import type { Config, Context } from "@netlify/functions";
import { runNightLabDispatch } from "../../src/lib/night-lab.dispatch-run.server";
/** A <30s schedule dispatches work; its 202 response never claims analysis completed. */
export default async function nightLab(_request: Request, context: Context): Promise<Response> {
  // The dispatch records itself before it tries anything, so a night that
  // dispatches nothing leaves a row saying which gate refused — rather than the
  // three weeks of silence this replaced.
  const report = await runNightLabDispatch(() => context);
  if (report.status === "skipped") return Response.json(report, { status: 200 });
  if (report.status !== "ran" || report.outcome.status !== "succeeded")
    throw new Error("NIGHT_LAB_DISPATCH_UNAVAILABLE");
  console.log("NIGHT_LAB_QUEUED");
  return Response.json({ status: "queued" }, { status: 202 });
}
export const config: Config = { schedule: "10 3 * * *" };
