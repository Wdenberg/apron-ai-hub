import { supabase } from "@/integrations/supabase/client";

export type Recipient = {
  store_id: string;
  name: string;
  whatsapp: string;
  trial_days_left: number;
};

export type Campaign = {
  id: string;
  segment: string;
  message_template: string;
  recipient_count: number;
  opened_count: number;
  created_at: string;
};

export type CampaignRecipientRow = {
  id: string;
  store_id: string;
  rendered_message: string;
};

export async function listSegmentStores(segment: string): Promise<Recipient[]> {
  const { data, error } = await supabase.rpc("admin_segment_stores", {
    _segment: segment,
  });
  if (error) throw error;
  return (data ?? []) as Recipient[];
}

export async function listCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase.rpc("admin_list_campaigns");
  if (error) throw error;
  return (data ?? []) as Campaign[];
}

export async function createCampaign(payload: {
  segment: string;
  messageTemplate: string;
  recipients: { store_id: string; message: string }[];
}): Promise<string> {
  const { data, error } = await supabase.rpc("admin_create_campaign", {
    _segment: payload.segment,
    _message_template: payload.messageTemplate,
    _recipients: payload.recipients,
  });
  if (error) throw error;
  return data as unknown as string;
}

export async function listCampaignRecipients(
  campaignId: string,
): Promise<CampaignRecipientRow[]> {
  const { data } = await supabase
    .from("communications_recipients")
    .select("id, store_id, rendered_message")
    .eq("communication_id", campaignId);
  return (data ?? []) as CampaignRecipientRow[];
}

export async function markRecipientOpened(recipientId: string) {
  await supabase.rpc("admin_mark_recipient_opened", { _recipient_id: recipientId });
}