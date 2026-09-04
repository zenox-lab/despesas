import { ExternalLink, MapPin, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  formatEUR,
  itemTotal,
  mapsUrl,
  planLabel,
  type ShoppingItem,
} from "@/lib/shopping";
import { cn } from "@/lib/utils";


type Props = {
  item: ShoppingItem;
  marketMode: boolean;
  onToggle: (id: string) => void;
  onEdit: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
  onOpen?: (item: ShoppingItem) => void;
  selectMode?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
};

export function ItemRow({
  item,
  marketMode,
  onToggle,
  onEdit,
  onDelete,
  onOpen,
  selectMode = false,
  selected = false,
  onSelect,
}: Props) {
  return (
    <li
      className={cn(
        "card-soft group animate-rise flex items-center gap-3 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[var(--shadow-float)] sm:p-4",
        item.bought && "opacity-60",
        selectMode && selected && "border-primary ring-2 ring-primary/30",
      )}
      onClick={selectMode ? () => onSelect?.(item.id) : () => onOpen?.(item)}
    >
      {selectMode ? (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect?.(item.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Selecionar ${item.name}`}
          className="size-5 shrink-0"
        />
      ) : (
        <Checkbox
          checked={item.bought}
          onCheckedChange={() => onToggle(item.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Marcar ${item.name} como comprado`}
          className="size-5 shrink-0"
        />
      )}

      {!marketMode && item.photo && (
        <img
          src={item.photo}
          alt={item.name}
          loading="lazy"
          className="size-14 shrink-0 rounded-xl border border-border/70 object-cover shadow-sm"
        />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-bold transition-all sm:text-[15px]",
            item.bought && "text-muted-foreground line-through",
          )}
        >
          {item.name}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="font-extrabold text-primary">{formatEUR(itemTotal(item))}</span>
          {(item.quantity ?? 1) > 1 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold">
              {item.quantity}x {formatEUR(item.price)}
            </span>
          )}
          {!marketMode && item.plan && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {planLabel(item.plan)}
            </span>
          )}
          {!marketMode && item.link && (
            <a
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ExternalLink className="size-3" /> link
            </a>
          )}
          {!marketMode && (item.address || item.store) && (
            <a
              href={mapsUrl(item.address || item.store || "", item.address ? item.store : undefined)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label="Abrir no Google Maps"
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary hover:bg-primary/20"
            >
              <MapPin className="size-3" /> {item.store?.trim() || "Maps"}
            </a>
          )}
        </div>
        {!marketMode && item.notes && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground italic">
            {item.notes}
          </p>
        )}
      </div>


      {!marketMode && !selectMode && (
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            onClick={(event) => { event.stopPropagation(); onEdit(item); }}
            aria-label="Editar"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-destructive"
            onClick={(event) => { event.stopPropagation(); onDelete(item.id); }}
            aria-label="Excluir"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      )}
    </li>
  );
}
