import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, string>();

export async function resolveAssetUrl(
  pathOrUrl: string | null | undefined,
): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (cache.has(pathOrUrl)) return cache.get(pathOrUrl)!;
  const { data } = await supabase.storage
    .from("store-assets")
    .createSignedUrl(pathOrUrl, 60 * 60 * 24 * 7);
  if (data?.signedUrl) {
    cache.set(pathOrUrl, data.signedUrl);
    return data.signedUrl;
  }
  return null;
}

export async function uploadAsset(
  path: string,
  file: File,
  opts: { upsert?: boolean } = {},
): Promise<void> {
  const { error } = await supabase.storage
    .from("store-assets")
    .upload(path, file, {
      upsert: opts.upsert ?? false,
      contentType: file.type,
    });
  if (error) throw error;
}