import { supabase } from "@/integrations/supabase/client";
import { uploadAsset } from "./assetsService";

export type StoreShellRow = {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
  subscription_status: string;
  trial_ends_at: string;
};

export type StoreFullRow = {
  id: string;
  name: string;
  slug: string;
  whatsapp: string;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  is_open: boolean;
  logo_url: string | null;
  cover_url: string | null;
};

export type StoreSubscriptionRow = {
  id: string;
  name: string;
  subscription_status: string;
  trial_ends_at: string;
  created_at: string;
  stripe_subscription_id: string | null;
};

export async function getMyStoreShell(): Promise<StoreShellRow | null> {
  const { data } = await supabase
    .from("stores")
    .select("id, name, slug, is_open, subscription_status, trial_ends_at")
    .maybeSingle();
  return (data as StoreShellRow | null) ?? null;
}

export async function getMyStoreFull(): Promise<StoreFullRow | null> {
  const { data } = await supabase
    .from("stores")
    .select(
      "id, name, slug, whatsapp, description, address, city, state, is_open, logo_url, cover_url",
    )
    .maybeSingle();
  return (data as StoreFullRow | null) ?? null;
}

export async function getMyStoreSubscription(): Promise<StoreSubscriptionRow | null> {
  const { data } = await supabase
    .from("stores")
    .select(
      "id, name, subscription_status, trial_ends_at, created_at, stripe_subscription_id",
    )
    .maybeSingle();
  return (data as StoreSubscriptionRow | null) ?? null;
}

export async function getMyStoreExists(): Promise<{ id: string } | null> {
  const { data } = await supabase.from("stores").select("id").maybeSingle();
  return data;
}

export async function getProductsCount(storeId: string): Promise<number> {
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId);
  return count ?? 0;
}

export async function updateStore(
  id: string,
  patch: Partial<{
    name: string;
    whatsapp: string;
    description: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    is_open: boolean;
    logo_url: string;
    cover_url: string;
  }>,
) {
  const { error } = await supabase.from("stores").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createStore(payload: {
  owner_id: string;
  name: string;
  slug: string;
  whatsapp: string;
  city: string | null;
  state: string | null;
  description: string | null;
}) {
  const { error } = await supabase.from("stores").insert(payload);
  if (error) throw error;
}

const ALLOWED_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function uploadStoreAsset(
  storeId: string,
  file: File,
  kind: "logo" | "cover",
): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error("Arquivo maior que 5MB");
  if (!ALLOWED_MIMES.includes(file.type))
    throw new Error("Somente imagens (JPEG, PNG, WEBP, GIF) são permitidas");
  const ext = MIME_TO_EXT[file.type];
  const path = `${storeId}/${kind}-${Date.now()}.${ext}`;
  await uploadAsset(path, file, { upsert: true });
  const patch = kind === "logo" ? { logo_url: path } : { cover_url: path };
  await updateStore(storeId, patch);
  return path;
}