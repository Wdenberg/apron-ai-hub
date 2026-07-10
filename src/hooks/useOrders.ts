import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk, invalidate } from "@/lib/queryKeys";
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
    queryKey: qk.orders.byStore(storeId),
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
    onSuccess: () => invalidate.orders(qc),
  });
}

export function fetchOrderItems(ids: string[]) {
  return listOrderItemsByOrderIds(ids);
}

export function useQuickSales(storeId: string | null | undefined, days: number) {
  return useQuery({
    queryKey: qk.orders.quickSales(storeId, days),
    enabled: !!storeId,
    queryFn: () => listQuickSales(storeId!, days),
  });
}

export function useCreateQuickSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createQuickSale,
    onSuccess: () => {
      invalidate.quickSales(qc);
      invalidate.productsActive(qc);
      invalidate.products(qc);
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