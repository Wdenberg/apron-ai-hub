import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/services/admin/adminOverviewService";

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin", "overview"],
    queryFn: getAdminOverview,
  });
}