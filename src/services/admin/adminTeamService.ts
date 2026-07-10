import { supabase } from "@/integrations/supabase/client";

export type TeamRow = {
  user_id: string | null;
  email: string;
  full_name: string | null;
  invited: boolean;
};

export async function listAdminTeam(): Promise<TeamRow[]> {
  const { data, error } = await supabase.rpc("admin_list_team");
  if (error) throw error;
  return (data ?? []) as TeamRow[];
}

export async function inviteAdmin(email: string): Promise<{ status: string }> {
  const { data, error } = await supabase.rpc("admin_invite", { _email: email });
  if (error) throw error;
  return data as unknown as { status: string };
}