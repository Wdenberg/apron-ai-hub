import { supabase } from "@/integrations/supabase/client";

export type TrialMetrics = {
  converted: number;
  expired: number;
  still_trialing: number;
  canceled: number;
  reasons: Record<string, number>;
};

export type RecoveryRow = {
  store_id: string;
  name: string;
  whatsapp: string;
  days_since_trial: number;
  owner_email: string | null;
  reason: string | null;
};

export async function getTrialMetrics(windowDays: number): Promise<TrialMetrics> {
  const { data, error } = await supabase.rpc("admin_trial_metrics", {
    _window_days: windowDays,
  });
  if (error) throw error;
  return data as unknown as TrialMetrics;
}

export async function getRecoveryList(): Promise<RecoveryRow[]> {
  const { data, error } = await supabase.rpc("admin_recovery_list");
  if (error) throw error;
  return (data ?? []) as RecoveryRow[];
}