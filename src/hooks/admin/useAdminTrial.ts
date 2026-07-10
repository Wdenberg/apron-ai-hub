import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { getTrialMetrics, getRecoveryList } from "@/services/admin/adminTrialService";

export function useTrialMetrics(windowDays: number) {
  return useQuery({
    queryKey: qk.admin.trialMetrics(windowDays),
    queryFn: () => getTrialMetrics(windowDays),
  });
}

export function useRecoveryList() {
  return useQuery({
    queryKey: qk.admin.recovery,
    queryFn: getRecoveryList,
  });
}