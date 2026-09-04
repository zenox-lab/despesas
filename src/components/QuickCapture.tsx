import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Link2, Plus, ShoppingCart, Heart, Repeat2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { fetchProductMeta } from "@/lib/scrape.functions";
import { cleanUrl, type ItemIntent, type ShoppingItem } from "@/lib/shopping";
import { cn } from "@/lib/utils";

type QuickCaptureProps = {
  /** Qual intenção é a padrão para a seção atual */
  defaultIntent?: ItemIntent;
  categories: string[];
  onAdd: (item: Partial<ShoppingItem> & { name: string }, intent: ItemIntent) => void;
  /** Placeholder simplificado para mobile */
  mobilePlaceholder?: string;
};

type DetectedProduct = {
  name: string;
  price?: number;
  image?: string;
  store?: string;
  url: string;
};

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
      "kelujo.com": "Kelujo", "ugreen.com": "UGREEN", "amazon.es": "Amazon",
      "amazon.com": "Amazon", "zara.com": "Zara", "hm.com": "H&M",
    };
    const match = Object.entries(known).find(([domain]) => host.endsWith(domain));
    return match?.[1] ?? host.split(".")[0]!.replace(/^./, (l) => l.toUpperCase());
  } catch { return ""; }
}

export function QuickCapture({ defaultIntent = "comprar", categories, onAdd, mobilePlaceholder }: QuickCaptureProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState<DetectedProduct | null>(null);
  const [intent, setIntent] = useState<ItemIntent>(defaultIntent);
  const [showPreview, setShowPreview] = useState(false);
  const getMeta = useServerFn(fetchProductMeta);
  const lastFetched = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // reset intent quando defaultIntent mudar
  useEffect(() => { setIntent(defaultIntent); }, [defaultIntent]);

  const fetchProduct = useCallback(async (url: string) => {
    const clean = cleanUrl(url);
    if (!isValidUrl(clean) || clean === lastFetched.current) return;
    lastFetched.current = clean;
    setLoading(true);
    setDetected(null);
    try {
      const result = await getMeta({ data: { url: clean } });
      const meta = result.data;
      if (meta.name || meta.price || meta.image) {
        setDetected({
          name: meta.name ?? "",
          price: meta.price ?? undefined,
          image: meta.image ?? undefined,
          store: storeFromUrl(clean),
          url: clean,
        });
        setShowPreview(true);
      } else {
        toast.info("Não foi possível extrair dados do link. Preencha manualmente.");
      }
    } catch {
      toast.error("Falha ao ler o produto. Tente colar manualmente.");
    } finally {
      setLoading(false);
    }
  }, [getMeta]);

  const handleChange = (raw: string) => {
    setValue(raw);
    const clean = cleanUrl(raw);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (isValidUrl(clean) && clean !== lastFetched.current) {
      timerRef.current = setTimeout(() => void fetchProduct(clean), 700);
    } else if (!isValidUrl(clean)) {
      setDetected(null);
      setShowPreview(false);
      lastFetched.current = null;
    }
  };

  const confirmAdd = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (detected) {
      onAdd({
        name: detected.name || trimmed,
        ...(detected.price !== undefined ? { price: detected.price } : {}),
        ...(detected.image ? { photo: detected.image } : {}),
        ...(detected.store ? { store: detected.store } : {}),
        link: detected.url,
      }, intent);
      setDetected(null);
      setShowPreview(false);
    } else {
      onAdd({ name: trimmed }, intent);
    }
    setValue("");
    lastFetched.current = null;
    inputRef.current?.focus();
    toast.success("Item adicionado.");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && value.trim() && !isValidUrl(cleanUrl(value))) {
      e.preventDefault();
      confirmAdd();
    }
  };

  const dismiss = () => {
    setDetected(null);
    setShowPreview(false);
    setValue("");
    lastFetched.current = null;
  };

  const INTENT_OPTIONS: { key: ItemIntent; label: string; icon: React.ElementType }[] = [
    { key: "comprar", label: "Comprar agora", icon: ShoppingCart },
    { key: "desejo", label: "Desejos", icon: Heart },
    { key: "recorrente", label: "Recorrente", icon: Repeat2 },
  ];

  return (
    <div className="space-y-2">
      {/* Input principal */}
      <div className={cn(
        "flex items-center gap-2 rounded-xl border bg-surface px-3 transition-shadow",
        loading
          ? "border-primary/50 shadow-[0_0_0_3px_oklch(0.58_0.155_155_/_0.12)]"
          : "border-border focus-within:border-primary/50 focus-within:shadow-[0_0_0_3px_oklch(0.58_0.155_155_/_0.10)]",
      )}>
        {loading ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
        ) : (
          <Link2 className="size-4 shrink-0 text-muted-foreground" />
        )}
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mobilePlaceholder ?? "Cole o link de um produto ou digite o que deseja comprar..."}
          className="flex-1 min-w-0 bg-transparent py-3 text-[15px] md:text-sm outline-none placeholder:text-muted-foreground/70"
        />
        {value && (
          <button
            onClick={dismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Limpar"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Estado: analisando URL */}
      {loading && (
        <p className="flex items-center gap-1.5 px-1 text-[11px] text-primary animate-fade">
          <Loader2 className="size-3 animate-spin" />
          Analisando produto...
        </p>
      )}

      {/* Preview do produto detectado */}
      {showPreview && detected && !loading && (
        <div className="animate-rise rounded-xl border border-primary/25 bg-primary/5 p-3">
          <div className="flex items-start gap-3">
            {detected.image && (
              <img
                src={detected.image}
                alt={detected.name}
                className="size-14 shrink-0 rounded-lg border border-border object-cover bg-white"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
                {detected.store ?? "Produto detectado"}
              </p>
              <p className="mt-0.5 text-sm font-bold leading-snug truncate">{detected.name}</p>
              {detected.price && (
                <p className="mt-1 text-sm font-extrabold text-primary">
                  €{detected.price.toFixed(2).replace(".", ",")}
                </p>
              )}
            </div>
            <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          {/* Seleção de intent */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {INTENT_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setIntent(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors border",
                  intent === key
                    ? "bg-foreground text-background border-foreground"
                    : "bg-surface text-muted-foreground border-border hover:border-foreground/30",
                )}
              >
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Botão confirmar */}
          <button
            onClick={confirmAdd}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-[12px] font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <Plus className="size-3.5" />
            Adicionar
          </button>
        </div>
      )}

      {/* Botão para texto simples (não-URL) */}
      {value.trim() && !isValidUrl(cleanUrl(value)) && !loading && (
        <div className="flex items-center gap-2 px-1 animate-fade">
          <div className="flex gap-1">
            {INTENT_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setIntent(key)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-colors border",
                  intent === key
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border hover:border-foreground/30",
                )}
              >
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={confirmAdd}
            className="ml-auto flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            <Plus className="size-3" />
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}
