import { X, ExternalLink, MapPin, Pencil, Heart, Repeat2, ShoppingBag, Check, ChevronDown, ShoppingCart, Tag, Trash2 } from "lucide-react";
import { useState } from "react";
import { formatEUR, itemTotal, mapsUrl, type ShoppingItem } from "@/lib/shopping";
import { cn } from "@/lib/utils";

const WISH_STATUS_LABELS: Record<string, string> = {
  quero: "Quero muito",
  talvez: "Talvez",
  em_breve: "Em breve",
};

type ProductDetailPanelProps = {
  item: ShoppingItem;
  onClose: () => void;
  onEdit: (item: ShoppingItem) => void;
  onMoveToWishlist?: (id: string) => void;
  onMoveToCart?: (id: string) => void;
  onMakeRecurring?: (id: string) => void;
  onMarkBought?: (item: ShoppingItem) => void;
  onChangeWishStatus?: (id: string, status: "quero" | "talvez" | "em_breve") => void;
  onDelete?: (id: string) => void;
  className?: string;
};

export function ProductDetailPanel({
  item,
  onClose,
  onEdit,
  onMoveToWishlist,
  onMoveToCart,
  onMakeRecurring,
  onMarkBought,
  onChangeWishStatus,
  onDelete,
  className,
}: ProductDetailPanelProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [statusSubmenu, setStatusSubmenu] = useState(false);
  const total = itemTotal(item);

  // Maps only shown when there is a physical address
  const mapsHref = item.address ? mapsUrl(item.address, item.store) : null;

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-surface shadow-sm overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Detalhes do produto</span>
        <button
          onClick={onClose}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Product image */}
        <div className="w-full h-52 bg-muted flex items-center justify-center overflow-hidden">
          {item.photo && !imgFailed ? (
            <img
              src={item.photo}
              alt={item.name}
              className="w-full h-full object-contain p-4"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <ShoppingBag className="size-16 text-muted-foreground/30" />
          )}
        </div>

        {/* Info */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <h2 className="text-[16px] font-extrabold leading-snug">{item.name}</h2>

          {/* Meta fields: Loja → Categoria → Preço → Status → Meta → Endereço → Notas */}
          <div className="space-y-2.5">
            {item.store && (
              <div className="flex items-start gap-2 text-[13px]">
                <span className="w-20 shrink-0 text-muted-foreground font-medium">Loja</span>
                <span className="font-bold">{item.store}</span>
              </div>
            )}
            <div className="flex items-start gap-2 text-[13px]">
              <span className="w-20 shrink-0 text-muted-foreground font-medium">Categoria</span>
              <span className="font-bold">{item.category}</span>
            </div>
            <div className="flex items-start gap-2 text-[13px]">
              <span className="w-20 shrink-0 text-muted-foreground font-medium">Preço</span>
              <span className="font-extrabold text-primary">
                {formatEUR(total)}
                {(item.quantity ?? 1) > 1 && (
                  <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">
                    ({item.quantity}× {formatEUR(item.price)})
                  </span>
                )}
              </span>
            </div>
            {item.wishStatus && (
              <div className="flex items-start gap-2 text-[13px]">
                <span className="w-20 shrink-0 text-muted-foreground font-medium">Status</span>
                <span className="font-bold">{WISH_STATUS_LABELS[item.wishStatus] ?? item.wishStatus}</span>
              </div>
            )}
            {item.desiredPrice && item.desiredPrice > 0 && (
              <div className="flex items-start gap-2 text-[13px]">
                <span className="w-20 shrink-0 text-muted-foreground font-medium">Meta</span>
                <span className="font-bold text-muted-foreground">{formatEUR(item.desiredPrice)}</span>
              </div>
            )}
            {item.address && (
              <div className="flex items-start gap-2 text-[13px]">
                <span className="w-20 shrink-0 text-muted-foreground font-medium">Endereço</span>
                <span className="font-medium break-words">{item.address}</span>
              </div>
            )}
            {item.notes && (
              <div className="flex items-start gap-2 text-[13px]">
                <span className="w-20 shrink-0 text-muted-foreground font-medium">Notas</span>
                <span className="text-muted-foreground break-words">{item.notes}</span>
              </div>
            )}
          </div>

          {/* Primary actions */}
          <div className="pt-1 space-y-2">
            {onMoveToCart && (
              <button
                onClick={() => onMoveToCart(item.id)}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-[13px] font-bold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <ShoppingCart className="size-4" /> Mover para Comprar
              </button>
            )}
            {onMarkBought && !item.bought && !onMoveToCart && (
              <button
                onClick={() => onMarkBought(item)}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-[13px] font-bold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Check className="size-4" /> Marcar como comprado
              </button>
            )}
            {item.link && (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-[13px] font-bold hover:bg-muted transition-colors"
              >
                <ExternalLink className="size-4 text-muted-foreground" /> Abrir produto
              </a>
            )}
            {mapsHref && (
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-[13px] font-bold hover:bg-muted transition-colors"
              >
                <MapPin className="size-4 text-muted-foreground" /> Abrir no Google Maps
              </a>
            )}
          </div>

          {/* Secondary actions — collapsible "Mais ações" */}
          <div className="border-t border-border/60 pt-3">
            <button
              onClick={() => setMoreOpen(v => !v)}
              className="flex w-full items-center justify-between text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors py-1"
            >
              <span>Mais ações</span>
              <ChevronDown className={cn("size-3.5 transition-transform duration-200", moreOpen && "rotate-180")} />
            </button>
            {moreOpen && (
              <div className="mt-2 space-y-1">
                <button
                  onClick={() => onEdit(item)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium hover:bg-muted transition-colors"
                >
                  <Pencil className="size-3.5 text-muted-foreground" /> Editar
                </button>
                {onChangeWishStatus && (
                  <div className="relative">
                    <button
                      onClick={() => setStatusSubmenu(v => !v)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium hover:bg-muted transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <Tag className="size-3.5 text-muted-foreground" /> Alterar status
                      </span>
                      <span className="text-[10px] text-muted-foreground">›</span>
                    </button>
                    {statusSubmenu && (
                      <div className="ml-6 my-1 space-y-0.5 border-l-2 border-primary/20 pl-2">
                        {(["quero", "talvez", "em_breve"] as const).map((st) => (
                          <button
                            key={st}
                            className={cn(
                              "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[12px] font-medium hover:bg-muted transition-colors",
                              item.wishStatus === st && "font-bold text-primary bg-primary/10",
                            )}
                            onClick={() => {
                              onChangeWishStatus(item.id, st);
                              setStatusSubmenu(false);
                            }}
                          >
                            {WISH_STATUS_LABELS[st]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {onMoveToWishlist && (
                  <button
                    onClick={() => onMoveToWishlist(item.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium hover:bg-muted transition-colors"
                  >
                    <Heart className="size-3.5 text-muted-foreground" /> Mover para Desejos
                  </button>
                )}
                {onMakeRecurring && (
                  <button
                    onClick={() => onMakeRecurring(item.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium hover:bg-muted transition-colors"
                  >
                    <Repeat2 className="size-3.5 text-muted-foreground" /> Tornar recorrente
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium text-destructive hover:bg-destructive/5 transition-colors"
                  >
                    <Trash2 className="size-3.5" /> Excluir
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile bottom sheet wrapper ──────────────────────────────────────────────
type ProductDetailSheetProps = ProductDetailPanelProps & {
  open: boolean;
};

export function ProductDetailSheet({ open, ...props }: ProductDetailSheetProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={props.onClose}
      />
      {/* Sheet */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 md:hidden",
          "rounded-t-2xl border-t border-border bg-background shadow-float",
          "max-h-[90dvh] overflow-y-auto",
          "animate-in slide-in-from-bottom duration-300",
        )}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>
        <ProductDetailPanel {...props} />
      </div>
    </>
  );
}

