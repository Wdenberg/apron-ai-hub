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

/**
 * Remove one or more objects from the store-assets bucket.
 * Silently ignores paths that no longer exist (already removed).
 * Throws for any other storage error so callers can abort transactionally.
 */
export async function deleteAssets(paths: string[]): Promise<void> {
  const valid = paths.filter(
    (p): p is string => !!p && !p.startsWith("http"),
  );
  if (!valid.length) return;
  const { error } = await supabase.storage.from("store-assets").remove(valid);
  if (error) {
    // "Object not found" / 404 → already gone; treat as success.
    const msg = (error as { message?: string }).message ?? "";
    if (/not.?found/i.test(msg) || /does not exist/i.test(msg)) {
      // fall through
    } else {
      throw error;
    }
  }
  for (const p of valid) cache.delete(p);
}