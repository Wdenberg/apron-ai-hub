import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/queryKeys";
import { listMyOrders } from "@/services/myOrdersService";

export function useMyOrders(enabled: boolean, userId: string | null | undefined) {
  return useQuery({
    queryKey: qk.myOrders(userId),
    enabled,
    queryFn: listMyOrders,
  });
}