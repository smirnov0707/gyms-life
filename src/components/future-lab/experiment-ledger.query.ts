import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  listPersonalExperimentHistory,
  transitionPersonalExperiment,
} from "@/lib/personal-experiment.functions";
import type { PersonalExperimentLifecycleEvent } from "@/lib/personal-experiment-lifecycle";

export function usePersonalExperimentHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["personal-experiment-history", user?.id],
    queryFn: () => listPersonalExperimentHistory(),
    enabled: !!user,
    staleTime: 30_000,
  });
}
export function usePersonalExperimentTransition() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { experimentId: string; event: PersonalExperimentLifecycleEvent }) =>
      transitionPersonalExperiment({ data: input }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["personal-experiment-history", user?.id] });
    },
  });
}
