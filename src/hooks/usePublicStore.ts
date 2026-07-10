import { useMutation } from "@tanstack/react-query";
import { createPublicOrder } from "@/services/publicStoreService";

export function useCreatePublicOrder() {
  return useMutation({ mutationFn: createPublicOrder });
}