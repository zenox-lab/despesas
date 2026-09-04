import { Heart, MoreHorizontal, ExternalLink, Pencil, Trash2, ShoppingCart, Check, Tag } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { formatEUR, type ShoppingItem } from "@/lib/shopping";
import { cn } from "@/lib/utils";

const WISH_STATUS_LABELS: Record<string, string> = {
  quero: "Quero muito",
  talvez: "Talvez",
  em_breve: "Em breve",
};

const WISH_STATUS_COLORS: Record<string, string> = {
  quero: "text-primary bg-primary/10 border-primary/20",
  talvez: "text-muted-foreground bg-muted border-border",
  em_breve: "text-success bg-success/10 border-success/20",
};

type ProductCardProps = {
  item: ShoppingItem;
  onSelectDetails?: (item: ShoppingItem) => void;
  isHighlighted?: boolean;
  onEdit?: (item: ShoppingItem) => void;
  onDelete?: (id: string) => void;
  onMoveToCart?: (id: string) => void;
  onMarkBought?: (item: ShoppingItem) => void;
  onChangeWishStatus?: (id: string, status: "quero" | "talvez" | "em_breve") => void;
};

export function ProductCard({
  item,
  onSelectDetails,
  isHighlighted = false,
  onEdit,
  onDelete,
  onMoveToCart,
  onMarkBought,
  onChangeWishStatus,
}: ProductCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [statusSubmenu, setStatusSubmenu] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setStatusSubmenu(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const wishLabel = item.wishStatus ? WISH_STATUS_LABELS[item.wishStatus] : null;
  const wishColor = item.wishStatus ? WISH_STATUS_COLORS[item.wishStatus] : "";

  return (
    <article
      onClick={() => onSelectDetails?.(item)}
      className={cn(
        "group relative flex flex-col justify-between h-full rounded-2xl border border-border bg-surface shadow-sm overflow-hidden cursor-pointer transition-all duration-200 hover:border-primary/50 hover:shadow-md",
        item.bought && "opacity-60",
        isHighlighted && "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md",
      )}
    >
      {/* Imagem compacta e padronizada */}
      <div className="relative h-44 w-full bg-muted/50 overflow-hidden border-b border-border/50 shrink-0">
        {item.photo && !imgFailed ? (
          <img
            src={item.photo}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 bg-muted/30 text-muted-foreground/30">
            <Heart className="size-8 stroke-[1.5]" />
            <span className="text-[10px] font-semibold text-muted-foreground/50">Sem imagem</span>
          </div>
        )}

        {/* Status badge overlay */}
        {wishLabel && (
          <span
            className={cn(
              "absolute top-2.5 left-2.5 rounded-lg border px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide shadow-sm backdrop-blur-md",
              wishColor,
            )}
          >
            {wishLabel}
          </span>
        )}

        {/* Context menu button */}
        <div className="absolute top-2.5 right-2.5" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
              setStatusSubmenu(false);
            }}
            className={cn(
              "grid size-7 place-items-center rounded-lg bg-background/90 backdrop-blur shadow-sm text-foreground transition",
              "opacity-0 group-hover:opacity-100",
              menuOpen && "opacity-100",
            )}
            aria-label="Opções"
          >
            <MoreHorizontal className="size-3.5" />
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
              {onEdit && (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
                  onClick={() => { setMenuOpen(false); onEdit(item); }}
                >
                  <Pencil className="size-3.5 text-muted-foreground" />
                  Editar
                </button>
              )}
              {onMoveToCart && (
                <button
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
                  onClick={() => { setMenuOpen(false); onMoveToCart(item.id); }}
                >
                  <ShoppingCart className="size-3.5 text-muted-foreground" />
                  Mover para Comprar
                </button>
              )}
              {onChangeWishStatus && (
                <div className="relative">
                  <button
                    className="flex w-full items-center justify-between px-3 py-2 text-[12px] font-medium hover:bg-muted"
                    onClick={() => setStatusSubmenu((v) => !v)}
                  >
                    <span className="flex items-center gap-2.5">
                      <Tag className="size-3.5 text-muted-foreground" />
                      Alterar status
                    </span>
                    <span className="text-[10px] text-muted-foreground">›</span>
                  </button>

                  {statusSubmenu && (
                    <div className="bg-muted/40 py-1 border-y border-border">
                      {(["quero", "talvez", "em_breve"] as const).map((st) => (
                        <button
                          key={st}
                          className={cn(
                            "flex w-full items-center justify-between px-5 py-1.5 text-[11px] font-medium hover:bg-muted",
                            item.wishStatus === st && "font-bold text-primary",
                          )}
                          onClick={() => {
                            setMenuOpen(false);
                            setStatusSubmenu(false);
                            onChangeWishStatus(item.id, st);
                          }}
                        >
                          {WISH_STATUS_LABELS[st]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
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
      </div>

      {/* Conteúdo compacto e proporcional abaixo */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div>
          <h3 className="text-[13.5px] font-extrabold leading-snug line-clamp-2 text-foreground group-hover:text-primary transition-colors">
            {item.name}
          </h3>
          {item.store && (
            <p className="text-[11.5px] font-semibold text-muted-foreground mt-1 truncate">
              {item.store}
            </p>
          )}
        </div>

        <div className="pt-2 flex items-baseline justify-between gap-1 border-t border-border/50">
          {item.price > 0 ? (
            <span className="text-[14px] font-extrabold text-primary tabular-nums">
              {formatEUR(item.price)}
            </span>
          ) : (
            <span className="text-[11.5px] font-semibold text-muted-foreground italic">
              Preço não informado
            </span>
          )}
          {item.desiredPrice && item.desiredPrice > 0 && (
            <span className="text-[10.5px] font-bold text-muted-foreground truncate">
              Meta: {formatEUR(item.desiredPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
