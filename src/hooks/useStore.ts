import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  return useQuery({ queryKey: ["my-store"], queryFn: getMyStoreShell });
}

export function useMyStoreFull() {
  return useQuery({ queryKey: ["my-store-full"], queryFn: getMyStoreFull });
}

export function useMyStoreSubscription() {
  return useQuery({
    queryKey: ["my-store-subscription"],
    queryFn: getMyStoreSubscription,
  });
}

export function useMyStoreExists() {
  return useQuery({ queryKey: ["my-store-exists"], queryFn: getMyStoreExists });
}

export function useProductsCount(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["products-count", storeId],
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-store-full"] });
      qc.invalidateQueries({ queryKey: ["my-store"] });
    },
  });
}

export function useToggleStoreOpen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; isOpen: boolean }) =>
      updateStore(payload.id, { is_open: payload.isOpen }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store-full"] }),
  });
}

export function useUploadStoreAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { storeId: string; file: File; kind: "logo" | "cover" }) =>
      uploadStoreAsset(payload.storeId, payload.file, payload.kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-store-full"] }),
  });
}

export function useCreateStore() {
  return useMutation({
    mutationFn: (payload: Parameters<typeof createStore>[0]) =>
      createStore(payload),
  });
}