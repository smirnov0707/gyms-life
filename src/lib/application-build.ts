import { readApplicationBuild, type ApplicationBuild } from "./application-environment";
/** Empty metadata is tolerated only by local fixtures, never inferred as a deployed target. */
export function currentApplicationBuild(): ApplicationBuild | null {
  const raw: unknown = import.meta.env["VITE_GYMSLIFE_BUILD"];
  if (raw === undefined) return { provider: "local", target: "local" };
  return readApplicationBuild(raw);
}
