import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  counts: Record<string, number>;
  onCreate: (name: string) => void;
  onRename: (from: string, to: string) => void;
  onDelete: (name: string) => void;
};

export function CategoryDialog({
  open,
  onOpenChange,
  categories,
  counts,
  onCreate,
  onRename,
  onDelete,
}: Props) {
  const [created, setCreated] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!open) return;
    setCreated("");
    setEditing(null);
    setDraft("");
  }, [open]);

  const commit = () => {
    const value = draft.trim().slice(0, 40);
    if (editing && value && value !== editing) onRename(editing, value);
    setEditing(null);
    setDraft("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Categorias</DialogTitle>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = created.trim().slice(0, 40);
            if (!value) return;
            onCreate(value);
            setCreated("");
          }}
        >
          <Input
            value={created}
            maxLength={40}
            onChange={(e) => setCreated(e.target.value)}
            placeholder="Nova categoria (ex: Eletrônicos)"
          />
          <Button type="submit" size="icon" aria-label="Criar categoria">
            <Plus className="size-4" />
          </Button>
        </form>

        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-2.5"
            >
              {editing === c ? (
                <>
                  <Input
                    autoFocus
                    value={draft}
                    maxLength={40}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commit();
                      }
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Salvar nome"
                    onClick={commit}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    aria-label="Cancelar"
                    onClick={() => setEditing(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c}</p>
                    <p className="text-xs text-muted-foreground">
                      {counts[c] ?? 0} {(counts[c] ?? 0) === 1 ? "item" : "itens"}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-foreground"
                    aria-label={`Renomear ${c}`}
                    onClick={() => {
                      setEditing(c);
                      setDraft(c);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground hover:text-destructive"
                    aria-label={`Excluir ${c}`}
                    disabled={c === "Outros"}
                    onClick={() => onDelete(c)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Ao excluir uma categoria, os itens dela vão para “Outros”.
        </p>
      </DialogContent>
    </Dialog>
  );
}
