import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, Pencil, Trash2, ShoppingBag, Heart, Repeat2, Check, ExternalLink, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatEUR, itemTotal, mapsUrl, type ShoppingItem } from "@/lib/shopping";
import { cn } from "@/lib/utils";
import { ProductThumbnail } from "./ProductThumbnail";
import { PriorityBadge } from "./PriorityBadge";

type ProductRowProps = {
  item: ShoppingItem;
  onToggle?: (id: string) => void;
  onEdit?: (item: ShoppingItem) => void;
  onDelete?: (id: string) => void;
  onMarkBought?: (item: ShoppingItem) => void;
  onMoveToWishlist?: (id: string) => void;
  onMakeRecurring?: (id: string) => void;
  onOpenDetails?: (item: ShoppingItem) => void;
  showIntent?: boolean;
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  isHighlighted?: boolean;
};

export function ProductRow({
  item,
  onToggle,
  onEdit,
  onDelete,
  onMarkBought,
  onMoveToWishlist,
  onMakeRecurring,
  onOpenDetails,
  showIntent = false,
  selectMode = false,
  selected = false,
  onSelect,
  isHighlighted = false,
}: ProductRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const total = itemTotal(item);

  return (
    <li
      className={cn(
        "item-row group animate-rise cursor-pointer",
        item.bought && "opacity-55",
        selectMode && selected && "border-primary ring-1 ring-primary/30",
        isHighlighted && "border-primary/40 ring-1 ring-primary/20 bg-primary/5",
      )}
      onClick={() => onOpenDetails?.(item)}
    >
      {/* Checkbox — stops propagation so it doesn't open details */}
      {selectMode ? (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect?.(item.id)}
          className="size-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Checkbox
          checked={item.bought}
          onCheckedChange={() => onToggle?.(item.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Marcar ${item.name} como comprado`}
          className="size-4 shrink-0"
        />
      )}

      {/* Thumbnail */}
      <ProductThumbnail src={item.photo} alt={item.name} />

      {/* Info & Price */}
      <div className="min-w-0 flex-1 flex flex-row items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[14px] font-bold leading-snug line-clamp-2",
              item.bought && "line-through text-muted-foreground",
            )}
          >
            {item.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.store && (
              <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[140px]">{item.store}</span>
            )}
            {item.priority && item.priority !== "media" && (
              <PriorityBadge priority={item.priority} />
            )}
            {(item.quantity ?? 1) > 1 && (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">{item.quantity}× {formatEUR(item.price)}</span>
            )}
          </div>
        </div>
        
        <div className="shrink-0 font-extrabold text-[14px] tabular-nums text-primary text-right pl-2">
          {formatEUR(total)}
        </div>
      </div>

      {/* Actions (hidden until hover, or always-visible menu) */}
      {!selectMode && (
        <div className="relative shrink-0" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
            className={cn(
              "grid size-8 place-items-center rounded-lg text-muted-foreground/50 transition hover:text-foreground hover:bg-muted",
              menuOpen && "text-foreground bg-muted",
            )}
            aria-label="Ações"
          >
            <MoreHorizontal className="size-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 w-48 rounded-xl border border-border bg-surface shadow-float py-1 animate-rise">
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                  Abrir produto
                </a>
              )}
              {(item.address || item.store) && (
                <a
                  href={mapsUrl(item.address || item.store || "", item.address ? item.store : undefined)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
                  onClick={() => setMenuOpen(false)}
                >
                  <MapPin className="size-3.5 text-muted-foreground" />
                  Ver no mapa
                </a>
              )}
              {onEdit && (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
                  onClick={() => { setMenuOpen(false); onEdit(item); }}
                >
                  <Pencil className="size-3.5 text-muted-foreground" />
                  Editar
                </button>
              )}
              {onMarkBought && !item.bought && (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-success hover:bg-success/5"
                  onClick={() => { setMenuOpen(false); onMarkBought(item); }}
                >
                  <Check className="size-3.5" />
                  Marcar como comprado
                </button>
              )}
              {onMoveToWishlist && (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
                  onClick={() => { setMenuOpen(false); onMoveToWishlist(item.id); }}
                >
                  <Heart className="size-3.5 text-muted-foreground" />
                  Mover para Desejos
                </button>
              )}
              {onMakeRecurring && (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
                  onClick={() => { setMenuOpen(false); onMakeRecurring(item.id); }}
                >
                  <Repeat2 className="size-3.5 text-muted-foreground" />
                  Tornar recorrente
                </button>
              )}
              {onDelete && (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-destructive hover:bg-destructive/5"
                    onClick={() => { setMenuOpen(false); onDelete(item.id); }}
                  >
                    <Trash2 className="size-3.5" />
                    Excluir
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
