import { supabase } from "@/integrations/supabase/client";

export type MyOrderRow = {
  id: string;
  order_number: number;
  store_id: string;
  store_name: string;
  store_slug: string;
  status: string;
  total: number;
  created_at: string;
};

export async function listMyOrders(): Promise<MyOrderRow[]> {
  const { data, error } = await supabase.rpc("my_orders");
  if (error) throw error;
  return (data ?? []) as MyOrderRow[];
}