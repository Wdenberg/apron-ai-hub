import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk, invalidate } from "@/lib/queryKeys";
import {
  getMyStoreShell,
  getMyStoreFull,
  getMyStoreSubscription,
  getMyStoreExists,
  getProductsCount,
  updateStore,
  createStore,
  uploadStoreAsset,
} from "@/services/storeService";

export function useMyStoreShell() {
  return useQuery({ queryKey: qk.store.mine, queryFn: getMyStoreShell });
}

export function useMyStoreFull() {
  return useQuery({ queryKey: qk.store.full, queryFn: getMyStoreFull });
}

export function useMyStoreSubscription() {
  return useQuery({
    queryKey: qk.store.subscription,
    queryFn: getMyStoreSubscription,
  });
}

export function useMyStoreExists() {
  return useQuery({ queryKey: qk.store.exists, queryFn: getMyStoreExists });
}

export function useProductsCount(storeId: string | null | undefined) {
  return useQuery({
    queryKey: qk.store.productsCount(storeId),
    enabled: !!storeId,
    queryFn: () => getProductsCount(storeId!),
  });
}

export function useUpdateStore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: string;
      patch: Parameters<typeof updateStore>[1];
    }) => updateStore(payload.id, payload.patch),
    onSuccess: () => invalidate.storeFull(qc),
  });
}

export function useToggleStoreOpen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; isOpen: boolean }) =>
      updateStore(payload.id, { is_open: payload.isOpen }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.store.full }),
  });
}

export function useUploadStoreAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { storeId: string; file: File; kind: "logo" | "cover" }) =>
      uploadStoreAsset(payload.storeId, payload.file, payload.kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.store.full }),
  });
}

export function useCreateStore() {
  return useMutation({
    mutationFn: (payload: Parameters<typeof createStore>[0]) =>
      createStore(payload),
  });
}