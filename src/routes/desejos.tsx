import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Heart, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { ProductCard } from "@/components/ProductCard";
import { QuickCapture } from "@/components/QuickCapture";
import { EmptyState } from "@/components/EmptyState";
import { ItemDialog } from "@/components/shopping/ItemDialog";
import { PurchaseConfirmModal, type PurchaseConfirmResult } from "@/components/PurchaseConfirmModal";
import { ProductDetailPanel, ProductDetailSheet } from "@/components/ProductDetailPanel";
import {
  effectiveIntent,
  planFromIntent,
  itemTotal,
  type ShoppingItem,
  type ItemIntent,
} from "@/lib/shopping";
import { requireUnlocked } from "@/lib/gate.functions";
import { getList, saveItem, setItemBought, deleteItem, setItemsPlan, addCategory } from "@/lib/list.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/desejos")({
  loader: async () => {
    await requireUnlocked();
    return await getList();
  },
  component: Desejos,
});

function Desejos() {
  const initial = Route.useLoaderData();
  const refresh = useServerFn(getList);
  const persistItem = useServerFn(saveItem);
  const persistBought = useServerFn(setItemBought);
  const removeItem = useServerFn(deleteItem);
  const persistCategory = useServerFn(addCategory);
  const persistPlan = useServerFn(setItemsPlan);

  const [items, setItems] = useState<ShoppingItem[]>(initial.items);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [search, setSearch] = useState("");
  const [wishStatusFilter, setWishStatusFilter] = useState<"todos" | "quero" | "talvez" | "em_breve">("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseAccounts, setPurchaseAccounts] = useState<{ id: string; name: string; balance: number; currency: "EUR" | "USD" | "BRL" }[]>([]);

  const [selectedItem, setSelectedItem] = useState<ShoppingItem | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const reload = useCallback(async () => {
    const fresh = await refresh();
    setItems(fresh.items);
    setCategories(fresh.categories);
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => { if (document.visibilityState === "visible") void reload(); };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (effectiveIntent(item) !== "desejo") return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (wishStatusFilter !== "todos" && item.wishStatus !== wishStatusFilter) return false;
      return true;
    });
  }, [items, search, wishStatusFilter]);

  const handleQuickAdd = async (partialItem: Partial<ShoppingItem> & { name: string }, intent: ItemIntent) => {
    try {
      await persistItem({
        data: {
          name: partialItem.name,
          price: partialItem.price ?? 0,
          category: partialItem.category ?? categories[0] ?? "Outros",
          plan: planFromIntent(intent),
          ...(partialItem.link ? { link: partialItem.link } : {}),
          ...(partialItem.photo ? { photo: partialItem.photo } : {}),
          ...(partialItem.store ? { store: partialItem.store } : {}),
        },
      });
      await reload();
    } catch {
      toast.error("Erro ao adicionar.");
    }
  };

  const handleSave = (data: Omit<ShoppingItem, "id" | "bought">, id?: string) => {
    void (async () => {
      try {
        await persistItem({
          data: {
            ...(id ? { id } : {}),
            name: data.name,
            price: data.price,
            link: data.link ?? null,
            photo: data.photo ?? null,
            category: data.category,
            store: data.store ?? null,
            address: data.address ?? null,
            quantity: data.quantity ?? 1,
            notes: data.notes ?? null,
            plan: "proximo_mes",
          },
        });
        await reload();
      } catch {
        toast.error("Erro ao salvar.");
      }
    })();
  };

  const removeHandler = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedItem?.id === id) setSelectedItem(null);
    void removeItem({ data: { id } }).catch(() => {
      toast.error("Erro ao remover.");
      void reload();
    });
  };

  const moveToCart = (id: string) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, plan: "este_mes" as const } : i));
    if (selectedItem?.id === id) setSelectedItem(null);
    void persistPlan({ data: { ids: [id], plan: "este_mes" } }).then(() => {
      toast.success("Movido para Comprar.");
    }).catch(() => {
      toast.error("Erro ao mover.");
      void reload();
    });
  };

  const changeWishStatus = (id: string, status: "quero" | "talvez" | "em_breve") => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, wishStatus: status } : i)));
    if (selectedItem?.id === id) {
      setSelectedItem((prev) => prev ? { ...prev, wishStatus: status } : null);
    }
    const target = items.find((i) => i.id === id);
    if (target) {
      void persistItem({
        data: {
          id: target.id,
          name: target.name,
          price: target.price,
          category: target.category,
          wishStatus: status,
        },
      }).then(() => {
        toast.success("Status atualizado.");
        void reload();
      }).catch(() => {
        toast.error("Erro ao atualizar status.");
        void reload();
      });
    }
  };

  const openPurchase = (item: ShoppingItem) => {
    try { setPurchaseAccounts(JSON.parse(localStorage.getItem("minha-lista:accounts") ?? "[]")); } catch { setPurchaseAccounts([]); }
    setPurchaseItem(item);
    setPurchaseOpen(true);
  };

  const handlePurchaseConfirm = async (result: PurchaseConfirmResult) => {
    if (!purchaseItem) return;
    const eurValue = result.pricePaid;
    let rates = { USD: 1.17, BRL: 6.3 };
    try { rates = { ...rates, ...JSON.parse(localStorage.getItem("minha-lista:eur-rates") ?? "{}") }; } catch { /* fallback */ }
    const debit = result.account.currency === "EUR" ? eurValue : eurValue * (rates as Record<string, number>)[result.account.currency]!;
    try {
      const accounts = JSON.parse(localStorage.getItem("minha-lista:accounts") ?? "[]");
      localStorage.setItem("minha-lista:accounts", JSON.stringify(accounts.map((a: any) => a.id === result.account.id ? { ...a, balance: a.balance - debit } : a)));
      const movement = { id: crypto.randomUUID(), accountId: result.account.id, type: "saida", amount: debit, description: `Compra · ${purchaseItem.name}`, date: result.date };
      const movements = JSON.parse(localStorage.getItem("minha-lista:movements") ?? "[]");
      localStorage.setItem("minha-lista:movements", JSON.stringify([movement, ...movements]));
      setItems((curr) => curr.map((i) => i.id === purchaseItem.id ? { ...i, bought: true } : i));
      await persistBought({ data: { id: purchaseItem.id, bought: true } });
      await reload();
      toast.success("Compra registrada.");
    } catch {
      toast.error("Erro ao registrar.");
    }
    setPurchaseOpen(false);
  };

  const STATUS_LABELS = { todos: "Todos", quero: "Quero muito", talvez: "Talvez", em_breve: "Em breve" } as const;

  return (
    <AppLayout>
      <div className="w-full max-w-[1400px] space-y-6 pb-24">
        {/* Header (Row 1 & Row 2) */}
        <div className="space-y-4">
          {/* Row 1: Title + Subtitle + Adicionar Button */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Desejos</h1>
              <p className="text-sm text-muted-foreground mt-0.5 font-medium">
                {visible.length} {visible.length === 1 ? "produto salvo" : "produtos salvos"}
              </p>
            </div>
            <button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-extrabold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <Plus className="size-4" /> Adicionar
            </button>
          </div>

          {/* Row 2: QuickCapture */}
          <QuickCapture defaultIntent="desejo" categories={categories} onAdd={handleQuickAdd} />
        </div>

        {/* Main 2-Column Dashboard Container */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          {/* Left Column: Filters, Search & Grid */}
          <div className="flex-1 w-full min-w-0 space-y-4">
            {/* Row 3: Status Filters (Segmented Pill Group) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {(["todos", "quero", "talvez", "em_breve"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setWishStatusFilter(status)}
                  className={cn(
                    "px-4 py-1.5 text-[12px] font-extrabold rounded-full border transition-all",
                    wishStatusFilter === status
                      ? "bg-foreground text-background border-foreground shadow-sm"
                      : "bg-surface border-border/80 text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>

            {/* Row 4: Search Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produtos na sua lista de desejos..."
                className="w-full h-10 pl-9 pr-8 rounded-xl border border-border bg-surface text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 grid size-5 place-items-center rounded-full hover:bg-muted text-muted-foreground"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Wishlist Product Grid (Max 4 per row desktop) */}
            {visible.length === 0 ? (
              <EmptyState
                icon={Heart}
                title="Nenhum desejo encontrado"
                description={
                  search || wishStatusFilter !== "todos"
                    ? "Tente ajustar a busca ou o filtro de status."
                    : "Cole o link de um produto que você deseja comprar futuramente."
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch pt-1">
                {visible.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    isHighlighted={selectedItem?.id === item.id}
                    onSelectDetails={(it) => setSelectedItem(it)}
                    onEdit={(it) => {
                      setEditing(it);
                      setDialogOpen(true);
                    }}
                    onDelete={(id) => removeHandler(id)}
                    onMoveToCart={(id) => moveToCart(id)}
                    onMarkBought={(it) => openPurchase(it)}
                    onChangeWishStatus={(id, status) => changeWishStatus(id, status)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Details Panel (Desktop) */}
          {selectedItem && (
            <div className="hidden md:flex flex-col w-[380px] xl:w-[420px] shrink-0 self-start sticky top-6">
              <ProductDetailPanel
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onEdit={(it) => { setEditing(it); setDialogOpen(true); setSelectedItem(null); }}
                onMoveToCart={(id) => moveToCart(id)}
                onChangeWishStatus={(id, status) => changeWishStatus(id, status)}
                onDelete={(id) => removeHandler(id)}
                onMakeRecurring={(id) => {
                  setItems(prev => prev.map(i => i.id === id ? { ...i, plan: "recorrentes" } : i));
                  void persistPlan({ data: { ids: [id], plan: "recorrentes" } }).then(() => {
                    toast.success("Movido para Recorrentes.");
                    void reload();
                  }).catch(() => { toast.error("Erro ao mover."); void reload(); });
                  setSelectedItem(null);
                }}
                className="w-full"
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <ProductDetailSheet
        open={!!selectedItem && isMobile}
        item={selectedItem ?? ({} as ShoppingItem)}
        onClose={() => setSelectedItem(null)}
        onEdit={(it) => { setEditing(it); setDialogOpen(true); setSelectedItem(null); }}
        onMoveToCart={(id) => moveToCart(id)}
        onChangeWishStatus={(id, status) => changeWishStatus(id, status)}
        onDelete={(id) => removeHandler(id)}
        onMakeRecurring={(id) => {
          setItems(prev => prev.map(i => i.id === id ? { ...i, plan: "recorrentes" } : i));
          void persistPlan({ data: { ids: [id], plan: "recorrentes" } }).then(() => {
            toast.success("Movido para Recorrentes.");
            void reload();
          }).catch(() => { toast.error("Erro ao mover."); void reload(); });
          setSelectedItem(null);
        }}
      />

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        editing={editing}
        defaultPlan="proximo_mes"
        onSave={handleSave}
        onCreateCategory={(name) => {
          setCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
          void persistCategory({ data: { name } }).catch(() => toast.error("Erro ao criar categoria."));
        }}
      />

      <PurchaseConfirmModal
        open={purchaseOpen}
        item={purchaseItem}
        accounts={purchaseAccounts}
        onOpenChange={setPurchaseOpen}
        onConfirm={handlePurchaseConfirm}
      />
    </AppLayout>
  );
}
