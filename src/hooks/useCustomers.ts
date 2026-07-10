import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listStoreCustomers,
  listCustomerOrders,
  updateCustomer,
  deleteCustomer,
} from "@/services/customersService";

export function useCustomers(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["customers", storeId],
    enabled: !!storeId,
    queryFn: () => listStoreCustomers(storeId!),
  });
}

export function useCustomerOrders(customerId: string | null | undefined) {
  return useQuery({
    queryKey: ["customer-orders", customerId],
    enabled: !!customerId,
    queryFn: () => listCustomerOrders(customerId!),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; name: string; whatsapp: string }) =>
      updateCustomer(payload.id, { name: payload.name, whatsapp: payload.whatsapp }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}