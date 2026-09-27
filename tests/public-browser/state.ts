import { useQuery } from "@tanstack/react-query";
export const params = new URLSearchParams(location.search);
export const state = {
  navigations: [] as string[],
  calls: [] as { action: string; input?: unknown }[],
  reads: 0,
  release: null as (() => void) | null,
  opened: [] as { url: string; features: string | undefined }[],
};
Object.assign(window, { __publicTest: state });
window.open = (url, _target, features) => {
  state.opened.push({ url: String(url), features });
  return null;
};
const user =
  params.get("user") === "yes"
    ? { id: "synthetic-user", email: "synthetic@example.invalid" }
    : null;
export const useAuth = () => ({ user });
export const isBillingEnabled = () => params.get("billing") === "yes";
export const getPaddleEnvironment = () => "sandbox";
export function useAccess(id: string | undefined) {
  const result = useQuery({
    queryKey: ["access", id],
    enabled: !!id && isBillingEnabled(),
    queryFn: async () => {
      state.reads++;
      await new Promise((resolve) =>
        setTimeout(resolve, params.get("access") === "loading" ? 60000 : 40),
      );
      return { readFailed: params.get("access") === "failed" && state.reads === 1 };
    },
  });
  return {
    loading: isBillingEnabled() && (!id || result.isLoading),
    readFailed: !!result.data?.readFailed,
    subscribed: ["subscriber", "cancelled"].includes(params.get("access") ?? ""),
    isOwner: params.get("access") === "owner",
    cancelAtPeriodEnd: params.get("access") === "cancelled",
    periodEnd: new Date("2027-01-15T12:00:00Z"),
  };
}
async function call(action: string, input?: unknown) {
  state.calls.push({ action, input });
  if (params.get("hold") === "yes")
    await new Promise<void>((resolve) => {
      state.release = resolve;
    });
  else await new Promise((resolve) => setTimeout(resolve, 250));
  if (params.get("fail") === action) throw new Error("Synthetic rejected action");
}
export const useServerFn = <T>(fn: T): T => fn;
export const usePaddleCheckout = () => ({
  loading: false,
  openCheckout: (input: unknown) => call("checkout", input),
});
export const changePlan = (input: unknown) => call("switch", input);
export const cancelSubscription = async () => {
  await call("cancel");
  return { synced: params.get("synced") !== "no" };
};
export const resumeSubscription = async () => {
  await call("resume");
  return { synced: params.get("synced") !== "no" };
};
export const getPortalUrl = async () => {
  await call("portal");
  return { url: "https://synthetic.invalid/portal" };
};
