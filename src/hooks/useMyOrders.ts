import { useQuery } from "@tanstack/react-query";
import { listMyOrders } from "@/services/myOrdersService";

export function useMyOrders(enabled: boolean, userId: string | null | undefined) {
  return useQuery({
    queryKey: ["my-orders", userId],
    enabled,
    queryFn: listMyOrders,
  });
}