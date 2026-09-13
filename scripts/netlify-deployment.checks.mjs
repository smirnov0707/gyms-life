const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const deployIdPattern = /^[a-f0-9]{24}$/;
const result = (errors) => ({
  ok: errors.length === 0,
  metadataVerified: errors.length === 0,
  executionVerified: false,
  codeIdentityVerified: false,
  errors,
});

/** Offline validation of paired Netlify getSite/getDeploy metadata; no credentials or writes. */
export function inspectProductionDeployMetadata(snapshot, expected) {
  if (
    !record(expected) ||
    typeof expected.siteId !== "string" ||
    !uuid.test(expected.siteId) ||
    typeof expected.deployId !== "string" ||
    !deployIdPattern.test(expected.deployId)
  )
    return result(["EXPECTED_IDS_INVALID"]);
  if (!record(snapshot) || !record(snapshot.site) || !record(snapshot.deploy))
    return result(["METADATA_INPUT_INVALID"]);
  const { site, deploy } = snapshot;
  const errors = [];
  const check = (ok, code) => {
    if (!ok) errors.push(code);
  };
  check(site.id === expected.siteId, "SITE_ID_MISMATCH");
  check(deploy.site_id === expected.siteId, "DEPLOY_SITE_MISMATCH");
  check(deploy.id === expected.deployId, "DEPLOY_ID_MISMATCH");
  check(
    record(site.published_deploy) && site.published_deploy.id === expected.deployId,
    "NOT_CURRENT_PUBLISHED_DEPLOY",
  );
  check(
    deploy.context === "production" &&
      deploy.state === "ready" &&
      (deploy.error_message === null || deploy.error_message === undefined),
    "DEPLOY_NOT_READY_PRODUCTION",
  );
  check(
    typeof deploy.published_at === "string" &&
      /^\d{4}-\d{2}-\d{2}T/.test(deploy.published_at) &&
      Number.isFinite(Date.parse(deploy.published_at)),
    "PUBLICATION_TIME_MISSING",
  );
  const functions = Array.isArray(deploy.available_functions) ? deploy.available_functions : [];
  const find = (name, code) => {
    const matches = functions.filter((item) => record(item) && item.n === name);
    check(matches.length === 1, code);
    return matches.length === 1 ? matches[0] : null;
  };
  const server = find("server", "SSR_FUNCTION_MISSING_OR_DUPLICATED");
  const worker = find("night-lab-worker-background", "WORKER_MISSING_OR_DUPLICATED");
  const scheduler = find("night-lab", "SCHEDULER_MISSING_OR_DUPLICATED");
  if (server) {
    check(server.im === "stream", "SSR_STREAM_MODE_MISSING");
    check(record(server.bd) && server.bd.runtimeAPIVersion === 2, "SSR_RUNTIME_API_V2_MISSING");
    check(
      Array.isArray(server.ro) &&
        server.ro.some(
          (route) =>
            record(route) &&
            route.p === "/*" &&
            route.ps === true &&
            (route.m == null || (Array.isArray(route.m) && route.m.length === 0)),
        ),
      "SSR_CATCH_ALL_ROUTE_MISSING",
    );
  }
  if (worker) {
    check(worker.im === "background", "WORKER_BACKGROUND_MODE_MISSING");
    check(record(worker.bd) && worker.bd.runtimeAPIVersion === 2, "WORKER_RUNTIME_API_V2_MISSING");
  }
  if (scheduler) {
    check(scheduler.im === "stream", "SCHEDULER_INVOCATION_MODE_MISSING");
    check(
      record(scheduler.bd) && scheduler.bd.runtimeAPIVersion === 2,
      "SCHEDULER_RUNTIME_API_V2_MISSING",
    );
  }
  const schedules = Array.isArray(deploy.function_schedules) ? deploy.function_schedules : [];
  const nights = schedules.filter((item) => record(item) && item.name === "night-lab");
  check(nights.length === 1 && nights[0].cron === "10 3 * * *", "NIGHT_LAB_SCHEDULE_INVALID");
  check(
    !schedules.some((item) => record(item) && item.name === "night-lab-worker-background"),
    "BACKGROUND_WORKER_MUST_NOT_BE_SCHEDULED",
  );
  return result(errors);
}
