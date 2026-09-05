import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Plus,
  X,
  SlidersHorizontal,
  History,
  ShoppingCart,
  ArrowLeft,
  Calendar,
  ChevronRight,
  CheckCircle2,
  ListPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { ProductRow } from "@/components/ProductRow";
import { QuickCapture } from "@/components/QuickCapture";
import { EmptyState } from "@/components/EmptyState";
import { ItemDialog } from "@/components/shopping/ItemDialog";
import { CategoryDialog } from "@/components/shopping/CategoryDialog";
import { DestinationDialog } from "@/components/shopping/DestinationDialog";
import { PurchaseConfirmModal, type PurchaseConfirmResult } from "@/components/PurchaseConfirmModal";
import { ProductDetailPanel, ProductDetailSheet } from "@/components/ProductDetailPanel";
import {
  formatEUR,
  itemTotal,
  groupByCategory,
  effectiveIntent,
  getItemListName,
  DEFAULT_SHOPPING_LISTS,
  planFromIntent,
  sortItemsAlphabetically,
  sortCategoriesAlphabetically,
  type ShoppingItem,
} from "@/lib/shopping";
import { requireUnlocked } from "@/lib/gate.functions";
import {
  getList,
  saveItem,
  setItemBought,
  deleteItem,
  addCategory,
  renameCategory,
  deleteCategory,
  setItemsPlan,
} from "@/lib/list.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/comprar")({
  loader: async () => {
    await requireUnlocked();
    return await getList();
  },
  component: Comprar,
});

function Comprar() {
  const initial = Route.useLoaderData();
  const refresh = useServerFn(getList);
  const persistItem = useServerFn(saveItem);
  const persistBought = useServerFn(setItemBought);
  const removeItem = useServerFn(deleteItem);
  const persistCategory = useServerFn(addCategory);
  const persistRename = useServerFn(renameCategory);
  const persistDeleteCategory = useServerFn(deleteCategory);
  const persistPlan = useServerFn(setItemsPlan);

  const [items, setItems] = useState<ShoppingItem[]>(initial.items);
  const [categories, setCategories] = useState<string[]>(initial.categories);

  // Navegação entre Visão Geral de Listas vs Lista Aberta
  const [activeList, setActiveList] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Todas");
  const [showPurchased, setShowPurchased] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newListDialogOpen, setNewListDialogOpen] = useState(false);

  const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseAccounts, setPurchaseAccounts] = useState<
    { id: string; name: string; balance: number; currency: "EUR" | "USD" | "BRL" }[]
  >([]);

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
    const onFocus = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [reload]);

  // Apenas itens de compras (exclui estritamente a lista de Desejos e Recorrentes base)
  const comprarItems = useMemo(() => {
    return sortItemsAlphabetically(items.filter((i) => effectiveIntent(i) === "comprar"));
  }, [items]);

  // Obter todas as listas planejadas únicas (padrões + customizadas com itens)
  const allListNames = useMemo(() => {
    const customNames = comprarItems.map(getItemListName);
    const set = new Set([...DEFAULT_SHOPPING_LISTS, ...customNames]);
    return Array.from(set);
  }, [comprarItems]);

  // Itens visíveis dentro da lista aberta (se houver)
  const activeListItems = useMemo(() => {
    if (!activeList) return [];
    return sortItemsAlphabetically(comprarItems.filter((i) => getItemListName(i) === activeList));
  }, [comprarItems, activeList]);

  const visibleItems = useMemo(() => {
    let list = activeListItems;
    if (showPurchased) {
      list = list.filter((i) => i.bought);
    } else {
      list = list.filter((i) => !i.bought);
    }

    if (filter !== "Todas") {
      list = list.filter((i) => i.category === filter);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((i) =>
        [i.name, i.category, i.store, i.notes].some((val) => val?.toLowerCase().includes(term))
      );
    }
    return sortItemsAlphabetically(list);
  }, [activeListItems, filter, search, showPurchased]);

  const groups = useMemo(() => groupByCategory(visibleItems), [visibleItems]);

  // Resumos da lista ativa
  const activePendingItems = useMemo(() => activeListItems.filter((i) => !i.bought), [activeListItems]);
  const activeBoughtItems = useMemo(() => activeListItems.filter((i) => i.bought), [activeListItems]);
  const activePendingTotal = useMemo(
    () => activePendingItems.reduce((sum, i) => sum + itemTotal(i), 0),
    [activePendingItems]
  );

  // Resumo global de Comprar
  const globalPendingItems = useMemo(() => comprarItems.filter((i) => !i.bought), [comprarItems]);
  const globalPendingTotal = useMemo(
    () => globalPendingItems.reduce((sum, i) => sum + itemTotal(i), 0),
    [globalPendingItems]
  );

  const handleQuickAdd = async (partialItem: Partial<ShoppingItem>, intent: any) => {
    try {
      const targetList = activeList || "Esta semana";
      await persistItem({
        data: {
          name: partialItem.name || "Novo item",
          price: partialItem.price || 0,
          category: partialItem.category || "Outros",
          plan: planFromIntent(intent),
          listName: targetList,
          ...(partialItem.link ? { link: partialItem.link } : {}),
          ...(partialItem.photo || (partialItem as any).image
            ? { photo: partialItem.photo || (partialItem as any).image }
            : {}),
          ...(partialItem.store ? { store: partialItem.store } : {}),
          ...(partialItem.address ? { address: partialItem.address } : {}),
          ...(partialItem.notes ? { notes: partialItem.notes } : {}),
        },
      });
      await reload();
      toast.success(`Item adicionado à lista "${targetList}".`);
    } catch {
      toast.error("Erro ao adicionar item.");
    }
  };

  const handleSave = (data: Omit<ShoppingItem, "id" | "bought">, id?: string) => {
    void (async () => {
      try {
        await persistItem({
          data: {
            ...(id ? { id } : {}),
            ...data,
            listName: data.listName || activeList || "Esta semana",
          },
        });
        await reload();
      } catch {
        toast.error("Erro ao salvar.");
      }
    })();
  };

  const removeItemHandler = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    void removeItem({ data: { id } }).catch(() => {
      toast.error("Erro ao excluir.");
      void reload();
    });
  };

  const moveToWishlist = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, plan: "proximo_mes" } : i)));
    void persistPlan({ data: { ids: [id], plan: "proximo_mes" } })
      .then(() => {
        toast.success("Movido para a lista de desejos (Desejos).");
        void reload();
      })
      .catch(() => {
        toast.error("Erro ao mover.");
        void reload();
      });
  };

  const openPurchase = (item: ShoppingItem) => {
    try {
      setPurchaseAccounts(JSON.parse(localStorage.getItem("minha-lista:accounts") ?? "[]"));
    } catch {
      setPurchaseAccounts([]);
    }
    setPurchaseItem(item);
    setPurchaseOpen(true);
  };

  const handlePurchaseConfirm = async (result: PurchaseConfirmResult) => {
    if (!purchaseItem) return;
    const eurValue = result.pricePaid;
    let rates = { USD: 1.17, BRL: 6.3 };
    try {
      rates = { ...rates, ...JSON.parse(localStorage.getItem("minha-lista:eur-rates") ?? "{}") };
    } catch {}

    const debit =
      result.account.currency === "EUR"
        ? eurValue
        : eurValue * (rates as any)[result.account.currency];

    try {
      const accounts = JSON.parse(localStorage.getItem("minha-lista:accounts") ?? "[]");
      const updatedAccounts = accounts.map((acc: any) =>
        acc.id === result.account.id ? { ...acc, balance: acc.balance - debit } : acc
      );
      localStorage.setItem("minha-lista:accounts", JSON.stringify(updatedAccounts));

      const movement = {
        id: crypto.randomUUID(),
        accountId: result.account.id,
        type: "saida",
        amount: debit,
        description: `Compra · ${purchaseItem.name}`,
        date: new Date().toISOString(),
      };
      const movements = JSON.parse(localStorage.getItem("minha-lista:movements") ?? "[]");
      localStorage.setItem("minha-lista:movements", JSON.stringify([movement, ...movements]));

      const expense = {
        id: crypto.randomUUID(),
        name: purchaseItem.name,
        amount: eurValue,
        category: "Compras",
        dueDay: new Date().getDate(),
        frequency: "unica",
        paid: true,
      };
      const expenses = JSON.parse(localStorage.getItem("minha-lista:expenses") ?? "[]");
      localStorage.setItem("minha-lista:expenses", JSON.stringify([expense, ...expenses]));

      setItems((curr) => curr.map((i) => (i.id === purchaseItem.id ? { ...i, bought: true } : i)));
      await persistBought({ data: { id: purchaseItem.id, bought: true } });
      await reload();
      toast.success(`Compra paga e registrada.`);
    } catch {
      toast.error("Erro ao registrar a compra.");
      void reload();
    }
    setPurchaseOpen(false);
  };

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of items) map[item.category] = (map[item.category] ?? 0) + 1;
    return map;
  }, [items]);

  return (
    <AppLayout>
      <div className="w-full max-w-[1400px] pb-24">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {activeList ? (
              <div className="space-y-1">
                <button
                  onClick={() => setActiveList(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition mb-1"
                >
                  <ArrowLeft className="size-3.5" /> Voltar para todas as listas
                </button>
                <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
                  <Calendar className="size-7 text-primary" /> {activeList}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {activePendingItems.length} {activePendingItems.length === 1 ? "item pendente" : "itens pendentes"} ·{" "}
                  <strong className="text-primary">{formatEUR(activePendingTotal)}</strong>
                  {activeListItems.length > 0 && (
                    <span className="ml-2 text-xs">
                      ({activeBoughtItems.length}/{activeListItems.length} comprados)
                    </span>
                  )}
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Comprar</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Listas planejadas de compras ({globalPendingItems.length} itens pendentes ·{" "}
                  <strong className="text-primary">{formatEUR(globalPendingTotal)}</strong>)
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!activeList && (
              <button
                onClick={() => setNewListDialogOpen(true)}
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] font-bold text-foreground hover:bg-muted transition shadow-sm"
              >
                <ListPlus className="size-4 text-primary" /> Nova lista
              </button>
            )}
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="size-4 mr-2" /> Adicionar item
            </Button>
          </div>
        </div>

        {/* Captura rápida */}
        <div className="mb-6">
          <QuickCapture defaultIntent="comprar" categories={categories} onAdd={handleQuickAdd} />
        </div>

        {/* Conteúdo Principal */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          <div className="flex-1 w-full min-w-0">
            {/* VISTA 1: Visão Geral das Listas Planejadas (quando NENHUMA lista está aberta) */}
            {!activeList ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5">
                {allListNames.map((listName) => {
                  const listItems = comprarItems.filter((i) => getItemListName(i) === listName);
                  const pending = listItems.filter((i) => !i.bought);
                  const bought = listItems.filter((i) => i.bought);
                  const estTotal = pending.reduce((sum, i) => sum + itemTotal(i), 0);

                  return (
                    <div
                      key={listName}
                      onClick={() => setActiveList(listName)}
                      className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer space-y-4"
                    >
                      {/* Topo do Card: Nome da lista e stats */}
                      <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
                        <div className="space-y-1">
                          <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2 group-hover:text-primary transition-colors">
                            <Calendar className="size-4 text-muted-foreground group-hover:text-primary" />
                            {listName}
                          </h2>
                          <p className="text-xs text-muted-foreground font-semibold">
                            {listItems.length} {listItems.length === 1 ? "item" : "itens"}
                            {listItems.length > 0 && (
                              <span>
                                {" "}
                                · <strong className="text-foreground">{formatEUR(estTotal)}</strong>
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Status de progresso */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {listItems.length > 0 && (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
                                bought.length === listItems.length
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : "bg-muted text-muted-foreground"
                              )}
                            >
                              <CheckCircle2 className="size-3" />
                              {bought.length}/{listItems.length}
                            </span>
                          )}
                          <ChevronRight className="size-5 text-muted-foreground/60 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>

                      {/* Pré-visualização compacta dos itens */}
                      <div className="min-h-[48px] flex items-center">
                        {listItems.length === 0 ? (
                          <p className="text-xs text-muted-foreground/70 italic">Nenhum item nesta lista</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {pending.slice(0, 5).map((it) => (
                              <span
                                key={it.id}
                                className="inline-flex items-center rounded-lg border border-border/70 bg-background px-2.5 py-1 text-[12px] font-bold text-foreground truncate max-w-[160px]"
                              >
                                {it.name}
                              </span>
                            ))}
                            {pending.length > 5 && (
                              <span className="inline-flex items-center rounded-lg bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground">
                                +{pending.length - 5}
                              </span>
                            )}
                            {pending.length === 0 && bought.length > 0 && (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                                Todos os itens comprados!
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Rodapé do Card */}
                      <div className="flex items-center justify-between text-[12px] font-bold text-primary pt-1">
                        <span>Abrir lista completa</span>
                        <span className="text-muted-foreground text-[11px] group-hover:underline">Tocar para ver →</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VISTA 2: Conteúdo da Lista Aberta (activeList !== null) */
              <div className="space-y-5">
                {/* Abas e Filtros da Lista */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex w-full sm:w-auto max-w-[280px] items-center gap-1 rounded-lg bg-muted/60 p-1">
                    <button
                      onClick={() => setShowPurchased(false)}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-[13px] font-bold transition-all",
                        !showPurchased
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Pendentes ({activePendingItems.length})
                    </button>
                    <button
                      onClick={() => setShowPurchased(true)}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-[13px] font-bold transition-all",
                        showPurchased
                          ? "bg-background shadow-sm text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Comprados ({activeBoughtItems.length})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-48">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar..."
                        className="h-9 w-full rounded-xl border border-border bg-surface pl-8 pr-3 text-[13px] shadow-sm outline-none transition focus:border-primary"
                      />
                      {search && (
                        <button
                          onClick={() => setSearch("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 grid size-5 place-items-center rounded-full hover:bg-muted text-muted-foreground"
                        >
                          <X className="size-3" />
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="h-9 appearance-none rounded-xl border border-border bg-surface pl-3 pr-8 text-[12px] font-bold shadow-sm outline-none transition focus:border-primary"
                      >
                        <option value="Todas">Todas categorias</option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <SlidersHorizontal className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>

                {/* Lista Agrupada por Categoria */}
                <div className="space-y-4 pt-2">
                  {groups.length === 0 ? (
                    <EmptyState
                      icon={showPurchased ? History : ShoppingCart}
                      title={showPurchased ? "Nenhum item comprado nesta lista" : "Lista vazia"}
                      description={
                        showPurchased
                          ? "Os itens marcados como comprados nesta lista aparecerão aqui."
                          : `Adicione itens à lista "${activeList}".`
                      }
                    />
                  ) : (
                    groups.map(([category, list]) => (
                      <section key={category}>
                        <div className="mb-2 flex items-center justify-between px-1">
                          <h2 className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                            {category}
                          </h2>
                          <span className="text-[10px] font-bold text-muted-foreground">
                            {formatEUR(
                              list.filter((i) => !i.bought).reduce((s, i) => s + itemTotal(i), 0)
                            )}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {list.map((item) => (
                            <ProductRow
                              key={item.id}
                              item={item}
                              isHighlighted={selectedItem?.id === item.id}
                              onOpenDetails={(it) => setSelectedItem(it)}
                              onToggle={(id) => {
                                const t = items.find((i) => i.id === id);
                                if (t && !t.bought) openPurchase(t);
                              }}
                              onEdit={(it) => {
                                setEditing(it);
                                setDialogOpen(true);
                              }}
                              onDelete={(id) => removeItemHandler(id)}
                              onMarkBought={(it) => openPurchase(it)}
                              onMoveToWishlist={(id) => moveToWishlist(id)}
                            />
                          ))}
                        </ul>
                      </section>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Coluna Direita: Painel de Detalhes ou Resumo */}
          <div className="hidden lg:flex flex-col w-[360px] xl:w-[400px] shrink-0 self-start sticky top-6">
            {selectedItem ? (
              <ProductDetailPanel
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onEdit={(it) => {
                  setEditing(it);
                  setDialogOpen(true);
                  setSelectedItem(null);
                }}
                onMoveToWishlist={(id) => {
                  moveToWishlist(id);
                  setSelectedItem(null);
                }}
                onMarkBought={(it) => {
                  openPurchase(it);
                  setSelectedItem(null);
                }}
                onMakeRecurring={(id) => {
                  setItems((prev) =>
                    prev.map((i) => (i.id === id ? { ...i, plan: "recorrentes" } : i))
                  );
                  void persistPlan({ data: { ids: [id], plan: "recorrentes" } })
                    .then(() => {
                      toast.success("Movido para Recorrentes.");
                      void reload();
                    })
                    .catch(() => {
                      toast.error("Erro ao mover.");
                      void reload();
                    });
                  setSelectedItem(null);
                }}
                className="w-full"
              />
            ) : (
              <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
                <h3 className="font-extrabold text-base border-b border-border/60 pb-3 flex items-center gap-2">
                  <ShoppingCart className="size-4 text-primary" />
                  {activeList ? `Resumo · ${activeList}` : "Resumo Geral de Compras"}
                </h3>

                <div className="space-y-3 text-[13.5px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">Itens pendentes</span>
                    <span className="font-bold">
                      {activeList ? activePendingItems.length : globalPendingItems.length}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">Estimado total</span>
                    <span className="font-extrabold text-primary">
                      {formatEUR(activeList ? activePendingTotal : globalPendingTotal)}
                    </span>
                  </div>
                </div>

                <hr className="border-border/60" />

                {/* Resumo por Listas quando na visão geral */}
                {!activeList && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                      Por lista planejada
                    </p>
                    {allListNames.map((ln) => {
                      const lItems = comprarItems.filter((i) => !i.bought && getItemListName(i) === ln);
                      const lTotal = lItems.reduce((s, i) => s + itemTotal(i), 0);
                      if (lItems.length === 0) return null;
                      return (
                        <div
                          key={ln}
                          onClick={() => setActiveList(ln)}
                          className="flex items-center justify-between text-[13px] cursor-pointer hover:text-primary transition"
                        >
                          <span className="font-semibold">{ln}</span>
                          <span className="font-bold">{formatEUR(lTotal)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button
                  onClick={() => setCategoryOpen(true)}
                  className="flex items-center text-[12.5px] font-bold text-muted-foreground hover:text-foreground transition-colors w-full pt-1"
                >
                  <SlidersHorizontal className="size-3.5 mr-2" /> Gerir categorias
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sheet de detalhes no Mobile */}
      <ProductDetailSheet
        open={!!selectedItem && isMobile}
        item={selectedItem ?? ({} as ShoppingItem)}
        onClose={() => setSelectedItem(null)}
        onEdit={(it) => {
          setEditing(it);
          setDialogOpen(true);
          setSelectedItem(null);
        }}
        onMoveToWishlist={(id) => {
          moveToWishlist(id);
          setSelectedItem(null);
        }}
        onMarkBought={(it) => {
          openPurchase(it);
          setSelectedItem(null);
        }}
      />

      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        editing={editing}
        defaultPlan="este_mes"
        onSave={handleSave}
        onCreateCategory={(name) => {
          setCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
          void persistCategory({ data: { name } }).catch(() => toast.error("Erro ao criar categoria."));
        }}
      />

      <CategoryDialog
        open={categoryOpen}
        onOpenChange={setCategoryOpen}
        categories={categories}
        counts={counts}
        onCreate={(name) => {
          if (categories.includes(name)) return toast.info("Categoria já existe.");
          setCategories((prev) => [...prev, name]);
          void persistCategory({ data: { name } }).catch(() => toast.error("Erro ao criar."));
        }}
        onRename={(from, to) => {
          setCategories((prev) => prev.map((c) => (c === from ? to : c)));
          setItems((prev) => prev.map((i) => (i.category === from ? { ...i, category: to } : i)));
          if (filter === from) setFilter(to);
          void persistRename({ data: { from, to } }).catch(() => toast.error("Erro ao renomear."));
        }}
        onDelete={(name) => {
          setCategories((prev) => prev.filter((c) => c !== name));
          setItems((prev) => prev.map((i) => (i.category === name ? { ...i, category: "Outros" } : i)));
          if (filter === name) setFilter("Todas");
          void persistDeleteCategory({ data: { name, moveTo: "Outros" } }).catch(() =>
            toast.error("Erro ao excluir.")
          );
        }}
      />

      <DestinationDialog
        open={newListDialogOpen}
        onOpenChange={setNewListDialogOpen}
        selectedCount={0}
        onConfirm={(targetList) => {
          setActiveList(targetList);
          setEditing(null);
          setDialogOpen(true);
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
