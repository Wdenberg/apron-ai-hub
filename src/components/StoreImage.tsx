import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

const cache = new Map<string, string>();

export async function resolveStoreAssetUrl(pathOrUrl: string | null | undefined): Promise<string | null> {
  if (!pathOrUrl) return null;
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  if (cache.has(pathOrUrl)) return cache.get(pathOrUrl)!;
  const { data } = await supabase.storage.from("store-assets").createSignedUrl(pathOrUrl, 60 * 60 * 24 * 7);
  if (data?.signedUrl) {
    cache.set(pathOrUrl, data.signedUrl);
    return data.signedUrl;
  }
  return null;
}

export function StoreImage({
  path,
  alt,
  className,
  fallbackClassName,
}: {
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    resolveStoreAssetUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", fallbackClassName ?? className)}>
        <ImageIcon className="h-6 w-6 opacity-50" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}