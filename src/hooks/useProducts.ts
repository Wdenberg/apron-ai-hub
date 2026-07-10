import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk, invalidate } from "@/lib/queryKeys";
import {
  listProducts,
  listAvailableProducts,
  upsertProduct,
  setProductActive,
  uploadProductPhoto,
  type ProductWriteRow,
} from "@/services/productsService";

export function useProducts(storeId: string | null | undefined) {
  return useQuery({
    queryKey: qk.products.byStore(storeId),
    enabled: !!storeId,
    queryFn: () => listProducts(storeId!),
  });
}

export function useAvailableProducts(storeId: string | null | undefined) {
  return useQuery({
    queryKey: qk.products.activeByStore(storeId),
    enabled: !!storeId,
    queryFn: () => listAvailableProducts(storeId!),
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { row: ProductWriteRow; id?: string }) =>
      upsertProduct(payload.row, payload.id),
    onSuccess: () => invalidate.products(qc),
  });
}

export function useToggleProductActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; active: boolean }) =>
      setProductActive(payload.id, payload.active),
    onSuccess: () => invalidate.products(qc),
  });
}

export function useUploadProductPhoto() {
  return useMutation({
    mutationFn: (payload: { storeId: string; file: File }) =>
      uploadProductPhoto(payload.storeId, payload.file),
  });
}