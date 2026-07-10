import { supabase } from "@/integrations/supabase/client";
import { uploadAsset } from "./assetsService";

export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  active: boolean;
  photo_url: string | null;
};

export type ProductPickerRow = {
  id: string;
  name: string;
  price: number;
  stock: number;
  active: boolean;
};

export async function listProducts(storeId: string): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Product[];
}

export async function listAvailableProducts(
  storeId: string,
): Promise<ProductPickerRow[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, price, stock, active")
    .eq("store_id", storeId)
    .eq("active", true)
    .gt("stock", 0)
    .order("name");
  return (data ?? []) as ProductPickerRow[];
}

export type ProductWriteRow = {
  store_id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  active: boolean;
  photo_url: string | null;
};

export async function upsertProduct(row: ProductWriteRow, id?: string) {
  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("products").insert(row);
    if (error) throw error;
  }
}

export async function setProductActive(id: string, active: boolean) {
  const { error } = await supabase.from("products").update({ active }).eq("id", id);
  if (error) throw error;
}

export async function updateProductStock(id: string, stock: number) {
  const { error } = await supabase
    .from("products")
    .update({ stock, active: stock > 0 })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProducts(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) throw error;
}

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadProductPhoto(
  storeId: string,
  file: File,
): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Imagem maior que 5MB");
  if (!ALLOWED_MIMES.includes(file.type))
    throw new Error("Somente imagens (JPEG, PNG, WEBP, GIF) são permitidas");
  const ext = MIME_TO_EXT[file.type];
  const path = `${storeId}/produtos/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  await uploadAsset(path, file);
  return path;
}