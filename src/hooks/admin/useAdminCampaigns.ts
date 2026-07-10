import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSegmentStores,
  listCampaigns,
  createCampaign,
  listCampaignRecipients,
  markRecipientOpened,
  type Recipient,
  type CampaignRecipientRow,
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

export type CampaignSendResult = {
  id: string;
  recipients: CampaignRecipientRow[];
};

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      segment: string;
      messageTemplate: string;
      audience: Recipient[];
    }): Promise<CampaignSendResult> => {
      const recs = payload.audience.map((r) => ({
        store_id: r.store_id,
        message: payload.messageTemplate
          .replace(/\{\{nome_loja\}\}/g, r.name)
          .replace(/\{\{dias_restantes\}\}/g, String(r.trial_days_left)),
      }));
      const id = await createCampaign({
        segment: payload.segment,
        messageTemplate: payload.messageTemplate,
        recipients: recs,
      });
      const recipients = await listCampaignRecipients(id);
      return { id, recipients };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "campaigns"] }),
  });
}