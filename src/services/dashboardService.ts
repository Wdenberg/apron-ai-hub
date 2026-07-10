import { supabase } from "@/integrations/supabase/client";

export type OrderRow = {
  total: number;
  type: "reserva" | "presencial";
  status: string;
  payment_status: string;
  created_at: string;
};

export type TopItemRow = {
  quantity: number;
  product: { name: string; store_id: string } | null;
};

export async function getMyStore(): Promise<{ id: string } | null> {
  const { data } = await supabase.from("stores").select("id").maybeSingle();
  return data;
}

export async function getOrdersSince(
  storeId: string,
  sinceIso: string,
): Promise<OrderRow[]> {
  const { data } = await supabase
    .from("orders")
    .select("total, type, status, payment_status, created_at")
    .eq("store_id", storeId)
    .gte("created_at", sinceIso);
  return (data ?? []) as OrderRow[];
}

export async function getTopItemsSince(
  sinceIso: string,
  limit = 500,
): Promise<TopItemRow[]> {
  const { data } = await supabase
    .from("order_items")
    .select("quantity, product:products(name, store_id)")
    .gte("created_at", sinceIso)
    .limit(limit);
  return (data ?? []) as TopItemRow[];
}

export function subscribeToStoreOrders(
  storeId: string,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`orders-dashboard-${storeId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `store_id=eq.${storeId}`,
      },
      () => onChange(),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}