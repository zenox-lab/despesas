import { useState } from "react";
import { cn } from "@/lib/utils";

type ProductThumbnailProps = {
  src?: string;
  alt: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizes = {
  sm: "size-9",
  md: "size-12",
  lg: "size-16",
};

function PlaceholderIcon({ sizeClass, className }: { sizeClass: string; className?: string }) {
  return (
    <div
      className={cn(
        "shrink-0 rounded-lg border border-border bg-muted flex items-center justify-center text-muted-foreground/40",
        sizeClass,
        className,
      )}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    </div>
  );
}

export function ProductThumbnail({ src, alt, size = "md", className }: ProductThumbnailProps) {
  const [failed, setFailed] = useState(false);
  const sizeClass = sizes[size];

  if (!src || failed) {
    return <PlaceholderIcon sizeClass={sizeClass} className={className} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={cn(
        "shrink-0 rounded-lg border border-border/60 object-cover bg-white",
        sizeClass,
        className,
      )}
      onError={() => setFailed(true)}
    />
  );
}
