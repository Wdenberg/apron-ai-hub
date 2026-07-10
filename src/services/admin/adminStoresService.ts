import { supabase } from "@/integrations/supabase/client";

export type AdminStoreRow = {
  id: string;
  name: string;
  slug: string;
  owner_email: string | null;
  subscription_status: string;
  trial_days_left: number;
  last_login_at: string | null;
  last_order_at: string | null;
  health: "green" | "yellow" | "red";
  created_at: string;
  whatsapp: string;
  plan: "mensal" | "trimestral" | "semestral" | "anual" | null;
  subscription_ends_at: string | null;
};

export type AdminStoreDetail = {
  store: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    whatsapp: string;
    city: string | null;
    state: string | null;
    address: string | null;
    subscription_status: string;
    trial_ends_at: string;
    last_login_at: string | null;
    is_open: boolean;
    created_at: string;
    health: "green" | "yellow" | "red";
    owner_email: string | null;
  };
  total_orders: number;
  total_revenue_cents: number;
  churn_reason: { reason: string; note: string | null; created_at: string } | null;
  actions: { action: string; payload: Record<string, unknown>; created_at: string }[];
  notes: { note: string; created_at: string }[];
};

export type SubscriptionPlan = "mensal" | "trimestral" | "semestral" | "anual";

export async function listAdminStores(filters: {
  status?: string;
  health?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminStoreRow[]> {
  const { data, error } = await supabase.rpc("admin_list_stores", {
    _status: filters.status || undefined,
    _health: filters.health || undefined,
    _search: filters.search || undefined,
    _limit: filters.limit ?? 100,
    _offset: filters.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as AdminStoreRow[];
}

export async function getAdminStoreDetail(id: string): Promise<AdminStoreDetail> {
  const { data, error } = await supabase.rpc("admin_store_detail", {
    _store_id: id,
  });
  if (error) throw error;
  return data as unknown as AdminStoreDetail;
}

export async function setSubscriptionStatus(
  id: string,
  status: string,
  reason?: string,
) {
  const { error } = await supabase.rpc("admin_set_subscription_status", {
    _store_id: id,
    _status: status as never,
    _reason: reason || undefined,
  });
  if (error) throw error;
}

export async function activateWithPlan(id: string, plan: SubscriptionPlan) {
  const { error } = await supabase.rpc("admin_activate_with_plan", {
    _store_id: id,
    _plan: plan,
  });
  if (error) throw error;
}

export async function extendTrial(id: string, days: number) {
  const { error } = await supabase.rpc("admin_extend_trial", {
    _store_id: id,
    _days: days,
  });
  if (error) throw error;
}

export async function addAdminNote(id: string, note: string) {
  const { error } = await supabase.rpc("admin_add_note", {
    _store_id: id,
    _note: note,
  });
  if (error) throw error;
}

export async function registerChurn(
  id: string,
  reason: string,
  note?: string,
) {
  const { error } = await supabase.rpc("admin_register_churn", {
    _store_id: id,
    _reason: reason as never,
    _note: note || undefined,
  });
  if (error) throw error;
}