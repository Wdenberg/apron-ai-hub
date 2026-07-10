import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";
import { useAssetUrl } from "@/hooks/useAssets";
import { resolveAssetUrl } from "@/services/assetsService";

// Re-export for legacy callers; delegates to the assets service.
export const resolveStoreAssetUrl = resolveAssetUrl;

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
  const url = useAssetUrl(path);
  if (!url) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", fallbackClassName ?? className)}>
        <ImageIcon className="h-6 w-6 opacity-50" />
      </div>
    );
  }
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}