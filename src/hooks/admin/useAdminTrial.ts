import { useQuery } from "@tanstack/react-query";
import { getTrialMetrics, getRecoveryList } from "@/services/admin/adminTrialService";

export function useTrialMetrics(windowDays: number) {
  return useQuery({
    queryKey: ["admin", "trial-metrics", windowDays],
    queryFn: () => getTrialMetrics(windowDays),
  });
}

export function useRecoveryList() {
  return useQuery({
    queryKey: ["admin", "recovery"],
    queryFn: getRecoveryList,
  });
}