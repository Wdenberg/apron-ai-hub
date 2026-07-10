import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type PaymentStatus = Database["public"]["Enums"]["payment_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export type OrderRow = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_whatsapp: string | null;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  created_at: string;
  notes: string | null;
};

export type OrderItemRow = {
  order_id: string;
  quantity: number;
  products: { name: string } | null;
};

export type QuickSale = {
  id: string;
  order_number: number | null;
  customer_name: string;
  customer_whatsapp: string | null;
  total: number;
  payment: PaymentMethod;
  created_at: string;
  notes: string | null;
  order_items: {
    quantity: number;
    unit_price: number;
    products: { name: string } | null;
  }[];
};

export async function listActiveOrders(storeId: string): Promise<OrderRow[]> {
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_whatsapp, total, status, payment_status, created_at, notes",
    )
    .eq("store_id", storeId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []) as OrderRow[];
}

export async function updateOrder(
  id: string,
  patch: Partial<{
    status: OrderStatus;
    payment_status: PaymentStatus;
    notes: string | null;
  }>,
) {
  const { error } = await supabase.from("orders").update(patch).eq("id", id);
  if (error) throw error;
}

export async function listOrderItemsByOrderIds(
  ids: string[],
): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, quantity, products(name)")
    .in("order_id", ids);
  if (error) throw error;
  return (data ?? []) as OrderItemRow[];
}

export async function listQuickSales(
  storeId: string,
  days: number,
): Promise<QuickSale[]> {
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_number, customer_name, customer_whatsapp, total, payment, created_at, notes, order_items(quantity, unit_price, products(name))",
    )
    .eq("store_id", storeId)
    .eq("type", "presencial")
    .gte("created_at", start.toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  return (data ?? []) as QuickSale[];
}

export async function createQuickSale(payload: {
  storeId: string;
  customerName: string;
  customerWhatsapp: string;
  productId: string;
  quantity: number;
  payment: PaymentMethod;
  notes?: string;
}): Promise<{ id: string; order_number: number; total: number } | undefined> {
  const { data, error } = await supabase.rpc("create_quick_sale", {
    _store_id: payload.storeId,
    _customer_name: payload.customerName,
    _customer_whatsapp: payload.customerWhatsapp,
    _product_id: payload.productId,
    _quantity: payload.quantity,
    _payment: payload.payment,
    _notes: payload.notes || undefined,
  });
  if (error) throw error;
  return data?.[0];
}

export function subscribeToStoreOrders(
  storeId: string,
  channelName: string,
  onChange: () => void,
) {
  const channel = supabase
    .channel(`${channelName}-${storeId}`)
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