import { supabase } from "@/integrations/supabase/client";

export type AdminOverview = {
  total: number;
  active: number;
  trial: number;
  trial_expired: number;
  past_due: number;
  blocked: number;
  canceled: number;
  new_today: number;
  new_week: number;
  new_month: number;
  mrr_estimated_cents: number;
  revenue_today_cents: number;
  revenue_week_cents: number;
  revenue_month_cents: number;
  revenue_year_cents: number;
  past_due_amount_cents: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const { data, error } = await supabase.rpc("admin_overview");
  if (error) throw error;
  return data as unknown as AdminOverview;
}