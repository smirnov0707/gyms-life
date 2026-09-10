import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { forecastProgress } from "@/lib/forecast.functions";

export function useStrengthForecast() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["future-me-forecast", user?.id],
    queryFn: () => forecastProgress({ data: {} }),
    enabled: !!user,
    staleTime: 60_000,
  });
}
