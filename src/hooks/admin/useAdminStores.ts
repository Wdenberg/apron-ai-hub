import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listAdminStores,
  getAdminStoreDetail,
  setSubscriptionStatus,
  activateWithPlan,
  extendTrial,
  addAdminNote,
  registerChurn,
  type SubscriptionPlan,
} from "@/services/admin/adminStoresService";

export function useAdminStores(filters: {
  status?: string;
  health?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["admin", "stores", filters.status ?? "", filters.health ?? "", filters.search ?? ""],
    queryFn: () => listAdminStores(filters),
  });
}

export function useAdminStoreDetail(id: string) {
  return useQuery({
    queryKey: ["admin", "store", id],
    queryFn: () => getAdminStoreDetail(id),
  });
}

export function useSetSubscriptionStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; status: string; reason?: string }) =>
      setSubscriptionStatus(payload.id, payload.status, payload.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "stores"] }),
  });
}

export function useActivateWithPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; plan: SubscriptionPlan }) =>
      activateWithPlan(payload.id, payload.plan),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "stores"] }),
  });
}

export function useExtendTrial(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days: number) => extendTrial(storeId, days),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "store", storeId] }),
  });
}

export function useAddAdminNote(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (note: string) => addAdminNote(storeId, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "store", storeId] }),
  });
}

export function useSetSubscriptionStatusDetail(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status: string; reason?: string }) =>
      setSubscriptionStatus(storeId, payload.status, payload.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "store", storeId] }),
  });
}

export function useRegisterChurn(storeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { reason: string; note?: string }) =>
      registerChurn(storeId, payload.reason, payload.note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "store", storeId] }),
  });
}