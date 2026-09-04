import { useState } from "react";
import { DEFAULT_SHOPPING_LISTS } from "@/lib/shopping";
import { Calendar, Plus, ShoppingBag, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type DestinationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (listName: string) => void;
};

export function DestinationDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: DestinationDialogProps) {
  const [selectedList, setSelectedList] = useState<string>("Esta semana");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [customName, setCustomName] = useState("");

  if (!open) return null;

  const handleConfirm = () => {
    const target = isCreatingNew ? customName.trim() : selectedList;
    if (!target) return;
    onConfirm(target);
    onOpenChange(false);
    setIsCreatingNew(false);
    setCustomName("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border/60 pb-4">
          <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Escolha a lista de destino</h2>
            <p className="text-xs text-muted-foreground">
              {selectedCount} {selectedCount === 1 ? "item selecionado" : "itens selecionados"}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
            Listas planejadas
          </p>

          <div className="grid grid-cols-2 gap-2">
            {DEFAULT_SHOPPING_LISTS.map((name) => {
              const active = !isCreatingNew && selectedList === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setSelectedList(name);
                    setIsCreatingNew(false);
                  }}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 text-[13px] font-bold transition text-left",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/80 bg-background hover:border-primary/40 text-foreground"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Calendar className="size-3.5 opacity-70" />
                    {name}
                  </span>
                  {active && <Check className="size-4 shrink-0" />}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className={cn(
                "flex items-center justify-between rounded-xl border p-3 text-[13px] font-bold transition text-left col-span-2",
                isCreatingNew
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-dashed border-border bg-background hover:border-primary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Plus className="size-4" />
                Criar nova lista...
              </span>
              {isCreatingNew && <Check className="size-4 shrink-0" />}
            </button>
          </div>

          {isCreatingNew && (
            <div className="pt-2 animate-in fade-in duration-200">
              <input
                type="text"
                autoFocus
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Nome da nova lista (ex: Churrasco, Viagem...)"
                className="w-full h-10 px-3.5 rounded-xl border border-primary bg-background text-sm outline-none transition focus:ring-4 focus:ring-primary/10"
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-border/60 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-border px-4 py-2.5 text-[13px] font-bold text-muted-foreground hover:bg-muted transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isCreatingNew && !customName.trim()}
            onClick={handleConfirm}
            className="rounded-xl bg-primary px-5 py-2.5 text-[13px] font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
          >
            Confirmar e Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

