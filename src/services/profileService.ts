import { supabase } from "@/integrations/supabase/client";
import { uploadAsset } from "./assetsService";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
};

export type ProfileNamePhone = {
  full_name: string | null;
  whatsapp: string | null;
};

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, whatsapp, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export async function getProfileBasic(userId: string): Promise<ProfileNamePhone | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, whatsapp")
    .eq("id", userId)
    .maybeSingle();
  return (data as ProfileNamePhone | null) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<{ full_name: string; whatsapp: string; avatar_url: string }>,
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

export async function isPhoneTakenByOther(
  whatsapp: string,
  currentUserId?: string,
): Promise<boolean> {
  let query = supabase.from("profiles").select("id").eq("whatsapp", whatsapp);
  if (currentUserId) query = query.neq("id", currentUserId);
  const { data } = await query.maybeSingle();
  return !!data;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Envie uma imagem");
  if (file.size > 5 * 1024 * 1024) throw new Error("Imagem acima de 5MB");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `avatars/${userId}/${Date.now()}.${ext}`;
  await uploadAsset(path, file, { upsert: true });
  await updateProfile(userId, { avatar_url: path });
  return path;
}