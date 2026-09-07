import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";
import { isBillingEnabled } from "@/lib/billing";

export const TRIAL_DAYS = 7;

type AccessState = {
  loading: boolean;
  hasAccess: boolean;
  /**
   * True when one of the three reads behind this gate failed.
   *
   * The gate then grants access and claims nothing else: not owner, not
   * subscribed, not in trial. Locking a paying athlete out of their own
   * training history because a subscriptions query blipped is a worse
   * failure than a few minutes of unpaid access, and the previous code did
   * exactly that silently — a failed read left `subRes.data` null, which is
   * indistinguishable from having no subscription. A failed profile read was
   * worse still: `created_at` fell back to now, handing whoever hit the
   * outage a fresh seven-day trial.
   */
  readFailed: boolean;
  isOwner: boolean;
  inTrial: boolean;
  trialEndsAt: Date | null;
  subscribed: boolean;
  cancelAtPeriodEnd: boolean;
  periodEnd: Date | null;
};

// Access = owner (admin role) OR active/trialing subscription OR within 7-day beta trial.
export function useAccess(userId: string | undefined): AccessState {
  const billingEnabled = isBillingEnabled();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["access", userId],
    enabled: billingEnabled && !!userId,
    queryFn: async () => {
      const env = getPaddleEnvironment();
      const [roleRes, profileRes, subRes] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId!)
          .eq("role", "admin")
          .maybeSingle(),
        supabase.from("profiles").select("created_at").eq("id", userId!).maybeSingle(),
        supabase
          .from("subscriptions")
          .select("status, current_period_end, cancel_at_period_end")
          .eq("user_id", userId!)
          .eq("environment", env)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Nothing below may be treated as a fact about the person unless all
      // three sources answered.
      const readFailed =
        roleRes.error !== null || profileRes.error !== null || subRes.error !== null;
      if (readFailed) {
        return {
          readFailed: true,
          isOwner: false,
          subscribed: false,
          inTrial: false,
          trialEndsAt: null,
          periodEnd: null,
          cancelAtPeriodEnd: false,
        };
      }

      const isOwner = !!roleRes.data;

      const sub = subRes.data;
      const now = new Date();
      const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
      const subscribed =
        !!sub &&
        ((["active", "trialing", "past_due"].includes(sub.status) &&
          (!periodEnd || periodEnd > now)) ||
          (sub.status === "canceled" && !!periodEnd && periodEnd > now));

      const createdAt = profileRes.data?.created_at
        ? new Date(profileRes.data.created_at)
        : new Date();
      const trialEndsAt = new Date(createdAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const inTrial = now < trialEndsAt;

      return {
        readFailed: false,
        isOwner,
        subscribed,
        inTrial,
        trialEndsAt,
        periodEnd,
        cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
      };
    },
  });

  const isOwner = !!data?.isOwner;
  const subscribed = !!data?.subscribed;
  const inTrial = !!data?.inTrial;
  // `isError` covers the query throwing; `readFailed` covers it resolving
  // with a Supabase error inside. Both mean the same thing to the gate.
  const readFailed = isError || !!data?.readFailed;

  return {
    loading: billingEnabled && (!userId || isLoading),
    hasAccess: !billingEnabled || isOwner || subscribed || inTrial || readFailed,
    readFailed,
    isOwner,
    inTrial: inTrial && !isOwner && !subscribed,
    trialEndsAt: data?.trialEndsAt ?? null,
    subscribed,
    cancelAtPeriodEnd: !!data?.cancelAtPeriodEnd,
    periodEnd: data?.periodEnd ?? null,
  };
}
