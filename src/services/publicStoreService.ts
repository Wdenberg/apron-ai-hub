import { supabase } from "@/integrations/supabase/client";

export type PublicStore = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  whatsapp: string;
  address: string | null;
  city: string | null;
  state: string | null;
  is_open: boolean;
  logo_url: string | null;
  cover_url: string | null;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  photo_url: string | null;
  store_id: string;
};

export async function getPublicStore(slug: string): Promise<PublicStore | null> {
  const { data } = await supabase.rpc("get_public_store" as never, {
    _slug: slug,
  } as never);
  const arr = data as PublicStore[] | null;
  return arr?.[0] ?? null;
}

export async function listPublicProducts(slug: string): Promise<PublicProduct[]> {
  const { data } = await supabase.rpc("list_public_products" as never, {
    _slug: slug,
  } as never);
  return (data ?? []) as PublicProduct[];
}

export async function createPublicOrder(payload: {
  storeId: string;
  customerName: string;
  customerWhatsapp: string;
  notes: string | null;
  items: { product_id: string; quantity: number }[];
  customerUserId: string | null;
}): Promise<{ id: string; order_number: number }> {
  const { data, error } = await supabase.rpc("create_public_order" as never, {
    _store_id: payload.storeId,
    _customer_name: payload.customerName,
    _customer_whatsapp: payload.customerWhatsapp,
    _notes: payload.notes,
    _items: payload.items,
    _customer_user_id: payload.customerUserId,
  } as never);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { id: string; order_number: number };
}