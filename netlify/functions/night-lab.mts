import type { Config } from "@netlify/functions";
import { dispatchNightLab } from "../../src/lib/night-lab.dispatch";
/** A <30s schedule dispatches work; its 202 response never claims analysis completed. */
export default async function nightLab(): Promise<Response> {
  const result = await dispatchNightLab();
  if (result.status !== "queued") throw new Error("NIGHT_LAB_DISPATCH_UNAVAILABLE");
  console.log("NIGHT_LAB_QUEUED");
  return Response.json(result, { status: 202 });
}
export const config: Config = { schedule: "10 3 * * *" };
