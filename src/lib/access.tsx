import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export const TRIAL_DAYS = 7;

type AccessState = {
  loading: boolean;
  hasAccess: boolean;
  isOwner: boolean;
  inTrial: boolean;
  trialEndsAt: Date | null;
  subscribed: boolean;
  cancelAtPeriodEnd: boolean;
  periodEnd: Date | null;
};

// Access = owner (admin role) OR active/trialing subscription OR within 7-day beta trial.
export function useAccess(userId: string | undefined): AccessState {
  const { data, isLoading } = useQuery({
    queryKey: ["access", userId],
    enabled: !!userId,
    queryFn: async () => {
      const env = getPaddleEnvironment();
      const [roleRes, profileRes, subRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId!).eq("role", "admin").maybeSingle(),
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

      return { isOwner, subscribed, inTrial, trialEndsAt, periodEnd, cancelAtPeriodEnd: !!sub?.cancel_at_period_end };
    },
  });

  const isOwner = !!data?.isOwner;
  const subscribed = !!data?.subscribed;
  const inTrial = !!data?.inTrial;

  return {
    loading: !userId || isLoading,
    hasAccess: isOwner || subscribed || inTrial,
    isOwner,
    inTrial: inTrial && !isOwner && !subscribed,
    trialEndsAt: data?.trialEndsAt ?? null,
    subscribed,
    cancelAtPeriodEnd: !!data?.cancelAtPeriodEnd,
    periodEnd: data?.periodEnd ?? null,
  };
}
