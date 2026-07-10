import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { getAdminOverview } from "@/services/admin/adminOverviewService";

export function useAdminOverview() {
  return useQuery({
    queryKey: qk.admin.overview,
    queryFn: getAdminOverview,
  });
}