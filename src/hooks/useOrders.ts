import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listActiveOrders,
  updateOrder,
  listOrderItemsByOrderIds,
  listQuickSales,
  createQuickSale,
  subscribeToStoreOrders,
  type OrderStatus,
  type PaymentStatus,
} from "@/services/ordersService";

export function useActiveOrders(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["orders", storeId],
    enabled: !!storeId,
    refetchInterval: 15000,
    queryFn: () => listActiveOrders(storeId!),
  });
}

export function useUpdateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: string;
      status?: OrderStatus;
      payment_status?: PaymentStatus;
      notes?: string | null;
    }) => {
      const { id, ...changes } = payload;
      return updateOrder(id, changes);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });
}

export function fetchOrderItems(ids: string[]) {
  return listOrderItemsByOrderIds(ids);
}

export function useQuickSales(storeId: string | null | undefined, days: number) {
  return useQuery({
    queryKey: ["quick-sales", storeId, days],
    enabled: !!storeId,
    queryFn: () => listQuickSales(storeId!, days),
  });
}

export function useCreateQuickSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuickSale,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quick-sales"] });
      qc.invalidateQueries({ queryKey: ["products-active"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useStoreOrdersRealtime(
  storeId: string | null | undefined,
  channelName: string,
  queryKeyToInvalidate: string,
) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!storeId) return;
    return subscribeToStoreOrders(storeId, channelName, () => {
      qc.invalidateQueries({ queryKey: [queryKeyToInvalidate] });
    });
  }, [storeId, channelName, queryKeyToInvalidate, qc]);
}