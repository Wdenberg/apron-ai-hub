import { supabase } from "@/integrations/supabase/client";

export type Customer = {
  id: string;
  name: string;
  whatsapp: string;
  total_orders: number;
  last_order_at: string | null;
  created_at: string;
  total_spent: number;
};

export type CustomerOrder = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  notes: string | null;
};

export async function listStoreCustomers(storeId: string): Promise<Customer[]> {
  const { data, error } = await supabase.rpc("list_store_customers" as never, {
    _store_id: storeId,
  } as never);
  if (error) throw error;
  return (data ?? []) as Customer[];
}

export async function listCustomerOrders(
  customerId: string,
): Promise<CustomerOrder[]> {
  const { data, error } = await supabase.rpc("list_customer_orders" as never, {
    _customer_id: customerId,
  } as never);
  if (error) throw error;
  return (data ?? []) as CustomerOrder[];
}

export async function updateCustomer(
  id: string,
  patch: { name: string; whatsapp: string },
) {
  const { error } = await supabase.from("customers").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteCustomer(id: string) {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
}