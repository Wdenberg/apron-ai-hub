import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSegmentStores,
  listCampaigns,
  createCampaign,
  listCampaignRecipients,
  markRecipientOpened,
} from "@/services/admin/adminCampaignsService";

export function useSegmentStores(segment: string) {
  return useQuery({
    queryKey: ["admin", "segment", segment],
    queryFn: () => listSegmentStores(segment),
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: ["admin", "campaigns"],
    queryFn: listCampaigns,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCampaign,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }),
  });
}

export { listCampaignRecipients, markRecipientOpened };