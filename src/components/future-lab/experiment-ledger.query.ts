import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { listPersonalExperimentHistory } from "@/lib/personal-experiment.functions";

export function usePersonalExperimentHistory() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["personal-experiment-history", user?.id],
    queryFn: () => listPersonalExperimentHistory(),
    enabled: !!user,
    staleTime: 30_000,
  });
}
