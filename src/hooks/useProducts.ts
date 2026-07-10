import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    queryKey: ["products", storeId],
    enabled: !!storeId,
    queryFn: () => listProducts(storeId!),
  });
}

export function useAvailableProducts(storeId: string | null | undefined) {
  return useQuery({
    queryKey: ["products-active", storeId],
    enabled: !!storeId,
    queryFn: () => listAvailableProducts(storeId!),
  });
}

export function useUpsertProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { row: ProductWriteRow; id?: string }) =>
      upsertProduct(payload.row, payload.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useToggleProductActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id: string; active: boolean }) =>
      setProductActive(payload.id, payload.active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
}

export function useUploadProductPhoto() {
  return useMutation({
    mutationFn: (payload: { storeId: string; file: File }) =>
      uploadProductPhoto(payload.storeId, payload.file),
  });
}