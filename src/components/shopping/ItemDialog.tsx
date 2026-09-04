import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchProductMeta } from "@/lib/scrape.functions";
import { cleanUrl, mapsUrl, PLANS, DEFAULT_SHOPPING_LISTS, parseFlexibleNumber, type PlanKey, type ShoppingItem } from "@/lib/shopping";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  editing: ShoppingItem | null;
  defaultPlan?: PlanKey;
  onSave: (item: Omit<ShoppingItem, "id" | "bought">, id?: string) => void;
  onCreateCategory: (name: string) => void;
};

const NEW_CATEGORY = "__new__";
const MAX_NAME = 140;
const MAX_URL = 2000;

type AutoField = "name" | "price" | "photo" | "category";

function isValidUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function storeFromUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "druni.es": "Druni", "primor.eu": "Primor", "mediamarkt.es": "MediaMarkt",
      "farmaciasdirect.es": "Farmaciasdirect", "farmainstant.com": "FarmaInstant",
      "kelujo.com": "Kelujo", "ugreen.com": "UGREEN",
    };
    const match = Object.entries(known).find(([domain]) => host.endsWith(domain));
    return match?.[1] ?? host.split(".")[0]!.replace(/^./, (letter) => letter.toUpperCase());
  } catch { return ""; }
}

/** Realce sutil nos campos preenchidos automaticamente. */
const autoClass = "border-primary/60 bg-primary/5";

export function ItemDialog({
  open,
  onOpenChange,
  categories,
  editing,
  defaultPlan,
  onSave,
  onCreateCategory,
}: Props) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [link, setLink] = useState("");
  const [photo, setPhoto] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Outros");
  const [store, setStore] = useState("");
  const [address, setAddress] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [plan, setPlan] = useState<PlanKey>(defaultPlan ?? "este_mes");
  const [listName, setListName] = useState<string>("Esta semana");
  const [newCategory, setNewCategory] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [auto, setAuto] = useState<AutoField[]>([]);
  const [partial, setPartial] = useState(false);
  const lastFetched = useRef<string | null>(null);
  const fetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getMeta = useServerFn(fetchProductMeta);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setPrice(editing ? String(editing.price) : "");
    setLink(editing?.link ?? "");
    setPhoto(editing?.photo ?? "");
    setCategory(editing?.category ?? categories[0] ?? "Outros");
    setStore(editing?.store ?? "");
    setAddress(editing?.address ?? "");
    setQuantity(String(editing?.quantity ?? 1));
    setNotes(editing?.notes ?? "");
    setPlan(editing?.plan ?? defaultPlan ?? "este_mes");
    setListName(editing?.listName ?? "Esta semana");
    setNewCategory("");
    setLoadingMeta(false);
    setAuto([]);
    setPartial(false);
    lastFetched.current = editing?.link ?? null;
  }, [open, editing, categories, defaultPlan]);

  const extract = useCallback(
    async (url: string, silent: boolean) => {
      const clean = cleanUrl(url);
      if (!isValidUrl(clean) || clean.length > MAX_URL) {
        if (!silent) toast.error("Informe um link válido (http ou https).");
        return;
      }
      lastFetched.current = clean;
      setLink(clean);
      setStore((current) => current.trim() || storeFromUrl(clean));
      setLoadingMeta(true);
      setPartial(false);
      try {
        const result = await getMeta({ data: { url: clean } });
        const meta = result.data;
        const filled: AutoField[] = [];
        if (meta.name) {
          setName((prev) => (prev.trim() ? prev : (filled.push("name"), meta.name!)));
        }
        if (meta.price) {
          setPrice((prev) =>
            prev.trim() ? prev : (filled.push("price"), String(meta.price)),
          );
        }
        if (meta.image) {
          setPhoto((prev) => (prev.trim() ? prev : (filled.push("photo"), meta.image!)));
        }
        if (meta.category) {
          const match = categories.find(
            (c) => c.toLowerCase() === meta.category!.toLowerCase(),
          );
          if (match) {
            setCategory((prev) =>
              prev && prev !== categories[0] ? prev : (filled.push("category"), match),
            );
          }
        }
        setAuto(filled);
        const complete =
          filled.includes("name") && filled.includes("price") && filled.includes("photo");
        if (filled.length === 0) {
          setPartial(true);
          if (!silent) {
            toast.info("Não foi possível extrair os dados. Preencha manualmente.");
          }
        } else {
          if (!complete) setPartial(true);
          toast.success("Dados do link preenchidos automaticamente.");
        }
        if (!meta.price && meta.outOfStock) {
          toast.info("A loja não mostra preço (produto esgotado). Informe o valor.");
        }
      } catch {
        setPartial(true);
        if (!silent) toast.error("Falha ao ler a página. Preencha manualmente.");
      } finally {
        setLoadingMeta(false);
      }
    },
    [getMeta, categories],
  );

  const handleLinkChange = (value: string) => {
    const clean = cleanUrl(value);
    setLink(clean);
    if (fetchTimer.current) clearTimeout(fetchTimer.current);
    if (isValidUrl(clean) && clean !== lastFetched.current) {
      fetchTimer.current = setTimeout(() => void extract(clean, false), 650);
    }
  };

  const clearAuto = (field: AutoField) =>
    setAuto((prev) => prev.filter((f) => f !== field));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim().slice(0, MAX_NAME);
    if (!trimmedName) {
      toast.error("Informe o nome do item.");
      return;
    }
    const parsedPrice = parseFlexibleNumber(price);
    if (price.trim() && (isNaN(parsedPrice) || parsedPrice < 0)) {
      toast.error("Preço inválido.");
      return;
    }
    if (link.trim() && !isValidUrl(link)) {
      toast.error("Link inválido.");
      return;
    }
    if (photo.trim() && !isValidUrl(photo)) {
      toast.error("URL da imagem inválida.");
      return;
    }

    let finalCategory = category;
    if (category === NEW_CATEGORY) {
      const created = newCategory.trim().slice(0, 40);
      if (!created) {
        toast.error("Dê um nome à nova categoria.");
        return;
      }
      finalCategory = created;
      onCreateCategory(created);
    }

    const parsedQty = Math.min(Math.max(parseInt(quantity, 10) || 1, 1), 999);

    onSave(
      {
        name: trimmedName,
        price: Number.isFinite(parsedPrice) ? Math.max(parsedPrice, 0) : 0,
        link: link.trim() || undefined,
        photo: photo.trim() || undefined,
        category: finalCategory,
        store: store.trim().slice(0, 120) || undefined,
        address: address.trim().slice(0, 300) || undefined,
        quantity: parsedQty,
        notes: notes.trim().slice(0, 500) || undefined,
        listName: plan === "este_mes" ? listName : undefined,
        plan,
      },
      editing?.id,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar compra" : "Anotar uma compra"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {/* Link + extração automática */}
          <div className="space-y-1.5">
            <Label htmlFor="link">Cole o link do produto</Label>
            <div className="flex gap-2">
              <Input
                id="link"
                value={link}
                maxLength={MAX_URL}
                onChange={(e) => handleLinkChange(e.target.value)}
                placeholder="Foto, nome, preço e categoria vêm automaticamente"
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                disabled={loadingMeta || !isValidUrl(link)}
                onClick={() => void extract(link, false)}
                aria-label="Extrair dados do link"
              >
                {loadingMeta ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Wand2 className="size-4" />
                )}
              </Button>
            </div>
            {loadingMeta ? (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <Loader2 className="size-3 animate-spin" /> Buscando nome, preço e
                imagem...
              </p>
            ) : partial ? (
              <p className="text-xs text-muted-foreground">
                Alguns dados não foram encontrados automaticamente. Complete ou corrija
                manualmente.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Ao colar, buscamos os dados essenciais e identificamos a loja.
              </p>
            )}
          </div>

          {/* Dados do item */}
          <div className="space-y-4 rounded-xl border border-border bg-surface/60 p-3">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                maxLength={MAX_NAME}
                className={cn(auto.includes("name") && autoClass)}
                onChange={(e) => {
                  setName(e.target.value);
                  clearAuto("name");
                }}
                placeholder="Digite o nome do item"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan">Adicionar à lista</Label>
              <Select value={plan} onValueChange={(value) => setPlan(value as PlanKey)}>
                <SelectTrigger id="plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLANS.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Escolha onde este item ficará organizado.</p>
            </div>

            {plan === "este_mes" && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <Label htmlFor="listName">Lista de Compras (Período / Destino)</Label>
                <Select value={listName} onValueChange={setListName}>
                  <SelectTrigger id="listName"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DEFAULT_SHOPPING_LISTS.map((ln) => (
                      <SelectItem key={ln} value={ln}>{ln}</SelectItem>
                    ))}
                    {!DEFAULT_SHOPPING_LISTS.includes(listName as any) && listName && (
                      <SelectItem value={listName}>{listName}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="price">Preço (€)</Label>
                <Input
                  id="price"
                  inputMode="decimal"
                  value={price}
                  maxLength={12}
                  className={cn(auto.includes("price") && autoClass)}
                  onChange={(e) => {
                    setPrice(e.target.value);
                    clearAuto("price");
                  }}
                  placeholder="0,00"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantidade</Label>
                <Input
                  id="quantity"
                  inputMode="numeric"
                  value={quantity}
                  maxLength={3}
                  onChange={(e) => setQuantity(e.target.value.replace(/\D/g, ""))}
                  placeholder="1"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="category">Categoria</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v);
                  clearAuto("category");
                }}
              >
                <SelectTrigger
                  id="category"
                  className={cn(auto.includes("category") && autoClass)}
                >
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={NEW_CATEGORY}>+ Nova categoria</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {category === NEW_CATEGORY && (
              <div className="animate-rise space-y-1.5">
                <Label htmlFor="newCategory">Nome da nova categoria</Label>
                <Input
                  id="newCategory"
                  value={newCategory}
                  maxLength={40}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Ex: Pet"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="photo">URL da imagem (opcional)</Label>
              <Input
                id="photo"
                value={photo}
                maxLength={MAX_URL}
                className={cn(auto.includes("photo") && autoClass)}
                onChange={(e) => {
                  setPhoto(e.target.value);
                  clearAuto("photo");
                }}
                placeholder="https://..."
              />
              {isValidUrl(photo) && (
                <img
                  src={photo}
                  alt="Pré-visualização do item"
                  className="mt-2 size-20 rounded-lg border border-border object-cover"
                />
              )}
            </div>
          </div>

          {/* Onde comprar */}
          <div className="space-y-4 rounded-xl border border-border bg-surface/60 p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Onde comprar
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="store">Loja (opcional)</Label>
              <Input
                id="store"
                value={store}
                maxLength={120}
                onChange={(e) => setStore(e.target.value)}
                placeholder="Ex: Farmácia Liceo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Endereço / Local (opcional)</Label>
              <Input
                id="address"
                value={address}
                maxLength={300}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rua, número, cidade"
              />
              {address.trim() && (
                <a
                  href={mapsUrl(address, store)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <MapPin className="size-3" /> Tocar para abrir no Google Maps
                </a>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              maxLength={500}
              rows={3}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Cor, tamanho, marca preferida..."
            />
          </div>

          <DialogFooter>
            <Button type="submit" className="w-full sm:w-auto">
              {editing ? "Salvar alterações" : "Adicionar item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
