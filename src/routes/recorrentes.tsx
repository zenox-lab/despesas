import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useCallback, useMemo, useEffect } from "react";
import {
  Repeat2,
  Plus,
  ShoppingCart,
  Search,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Filter,
  FolderPlus,
  FolderEdit,
  ArrowUpDown,
  Folder,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/EmptyState";
import { ItemDialog } from "@/components/shopping/ItemDialog";
import { DestinationDialog } from "@/components/shopping/DestinationDialog";
import { ProductThumbnail } from "@/components/ProductThumbnail";
import {
  formatEUR,
  itemTotal,
  effectiveIntent,
  getItemListName,
  FREQUENCY_LABELS,
  sortItemsAlphabetically,
  sortCategoriesAlphabetically,
  type ShoppingItem,
} from "@/lib/shopping";
import { requireUnlocked } from "@/lib/gate.functions";
import {
  getList,
  saveItem,
  deleteItem,
  addCategory,
  renameCategory,
  deleteCategory,
} from "@/lib/list.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/recorrentes")({
  loader: async () => {
    await requireUnlocked();
    return await getList();
  },
  component: Recorrentes,
});

type FilterPeriod = "hoje" | "amanha" | "semana" | "mes" | "todos";

const FILTER_LABELS: Record<FilterPeriod, string> = {
  hoje: "Hoje",
  amanha: "Amanhã",
  semana: "Esta semana",
  mes: "Este mês",
  todos: "Todos",
};

function Recorrentes() {
  const initial = Route.useLoaderData();
  const refresh = useServerFn(getList);
  const persistItem = useServerFn(saveItem);
  const removeItem = useServerFn(deleteItem);
  const persistCategory = useServerFn(addCategory);
  const persistRenameCategory = useServerFn(renameCategory);
  const persistDeleteCategory = useServerFn(deleteCategory);

  const [items, setItems] = useState<ShoppingItem[]>(initial.items);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [period, setPeriod] = useState<FilterPeriod>("todos");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showOnlySelected, setShowOnlySelected] = useState(false);

  // Categoria ativa selecionada no painel lateral
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);

  // Modais de Categoria
  const [renameCategoryTarget, setRenameCategoryTarget] = useState<string | null>(null);
  const [renameCategoryValue, setRenameCategoryValue] = useState("");
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<string | null>(null);
  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

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

  // Lista base permanente de itens recorrentes
  const baseItems = useMemo(() => {
    return sortItemsAlphabetically(items.filter((item) => effectiveIntent(item) === "recorrente"));
  }, [items]);

  // Obter todas as categorias únicas (registradas + presentes nos itens base)
  const allCategories = useMemo(() => {
    const set = new Set([...categories, ...baseItems.map((i) => i.category)]);
    return sortCategoriesAlphabetically(Array.from(set));
  }, [categories, baseItems]);

  // Selecionar por padrão a primeira categoria se nenhuma estiver selecionada
  useEffect(() => {
    if (!selectedCategory && allCategories.length > 0) {
      setSelectedCategory(allCategories[0] ?? null);
    }
  }, [allCategories, selectedCategory]);

  // Itens selecionados para a "Próxima compra"
  const selectedItems = useMemo(() => {
    return sortItemsAlphabetically(baseItems.filter((i) => selectedIds.includes(i.id)));
  }, [baseItems, selectedIds]);

  // Valor total estimado dos itens selecionados
  const selectedTotal = useMemo(() => {
    return selectedItems.reduce((sum, i) => sum + itemTotal(i), 0);
  }, [selectedItems]);

  // Itens da categoria selecionada
  const activeCategoryItems = useMemo(() => {
    if (!selectedCategory) return [];
    const filtered = baseItems.filter((item) => {
      if (item.category !== selectedCategory) return false;
      if (showOnlySelected && !selectedIds.includes(item.id)) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (period === "hoje" || period === "amanha" || period === "semana") {
        return item.frequency === "semanal" || item.frequency === "quinzenal";
      }
      if (period === "mes") {
        return (
          item.frequency === "semanal" ||
          item.frequency === "quinzenal" ||
          item.frequency === "mensal"
        );
      }
      return true;
    });
    return sortItemsAlphabetically(filtered);
  }, [baseItems, selectedCategory, period, search, showOnlySelected, selectedIds]);

  // Alternar seleção individual
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  // Alternar selecionar todos na categoria ativa
  const toggleSelectAllCategory = () => {
    const catIds = activeCategoryItems.map((i) => i.id);
    const allSelected = catIds.length > 0 && catIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !catIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...catIds])));
    }
  };

  const [destDialogOpen, setDestDialogOpen] = useState(false);

  const sendToComprar = () => {
    if (selectedItems.length === 0) return;
    setDestDialogOpen(true);
  };

  const renderCategoryDetail = (catName: string) => {
    const catItems = baseItems.filter((item) => {
      if (item.category !== catName) return false;
      if (showOnlySelected && !selectedIds.includes(item.id)) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (period === "hoje" || period === "amanha" || period === "semana") {
        return item.frequency === "semanal" || item.frequency === "quinzenal";
      }
      if (period === "mes") {
        return (
          item.frequency === "semanal" ||
          item.frequency === "quinzenal" ||
          item.frequency === "mensal"
        );
      }
      return true;
    });

    const isAllSelected = catItems.length > 0 && catItems.every((i) => selectedIds.includes(i.id));

    return (
      <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm space-y-4 sm:space-y-5">
        {/* Header do Painel da Categoria */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3 sm:pb-4">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
              Detalhes da Categoria
            </span>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2 mt-0.5">
              <Folder className="size-5 text-primary" /> {catName}
            </h2>
            <p className="text-xs text-muted-foreground font-semibold mt-0.5">
              {catItems.length} {catItems.length === 1 ? "produto cadastrado" : "produtos cadastrados"} · Total estimado:{" "}
              <strong className="text-primary">
                {formatEUR(catItems.reduce((sum, i) => sum + itemTotal(i), 0))}
              </strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddItemToCategory(catName)}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-[12.5px] font-extrabold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <Plus className="size-4" /> Novo item em {catName}
            </button>
          </div>
        </div>

        {/* Filtro de Busca Interno */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Buscar em ${catName}...`}
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-background text-xs outline-none transition focus:border-primary"
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

          {catItems.length > 0 && (
            <button
              onClick={() => {
                const catIds = catItems.map((i) => i.id);
                if (isAllSelected) {
                  setSelectedIds((prev) => prev.filter((id) => !catIds.includes(id)));
                } else {
                  setSelectedIds((prev) => Array.from(new Set([...prev, ...catIds])));
                }
              }}
              className="text-[11.5px] font-bold text-muted-foreground hover:text-foreground transition px-2 py-1 shrink-0"
            >
              {isAllSelected ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          )}
        </div>

        {/* Lista de Produtos Reutilizáveis na Categoria Ativa */}
        {catItems.length === 0 ? (
          <EmptyState
            icon={Repeat2}
            title={`Nenhum produto em ${catName}`}
            description={`Clique em "+ Novo item em ${catName}" para cadastrar seus produtos base.`}
          />
        ) : (
          <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-background">
            {catItems.map((item) => {
              const isChecked = selectedIds.includes(item.id);
              const freqText =
                FREQUENCY_LABELS[item.frequency ?? "semanal"] ?? item.frequency;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3.5 py-3 cursor-pointer transition-colors hover:bg-muted/40 min-h-[56px]",
                    isChecked && "bg-primary/5"
                  )}
                >
                  {/* Checkbox + Thumbnail + Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelect(item.id);
                      }}
                      className={cn(
                        "grid size-5 shrink-0 place-items-center rounded-md border transition-all cursor-pointer",
                        isChecked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/80 bg-background hover:border-primary/50"
                      )}
                    >
                      {isChecked && <Check className="size-3.5 stroke-[3]" />}
                    </div>

                    <ProductThumbnail src={item.photo} alt={item.name} size="sm" />

                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-[13.5px] font-bold leading-tight truncate",
                          isChecked ? "text-foreground font-extrabold" : "text-foreground"
                        )}
                      >
                        {item.name}
                      </p>
                      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground mt-0.5 flex-wrap">
                        {item.store && (
                          <span className="font-semibold text-foreground/80">
                            {item.store}
                          </span>
                        )}
                        {item.price > 0 && (
                          <span className="font-bold text-primary">
                            {formatEUR(item.price)}
                          </span>
                        )}
                        {freqText && (
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider text-muted-foreground">
                            {freqText}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Menu de Opções (...) */}
                  <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                    <RowMenu
                      onEdit={() => {
                        setEditing(item);
                        setDialogOpen(true);
                      }}
                      onDelete={() => removeHandler(item.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Painel Inferior de "Próxima Compra" / Ações */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
              <ShoppingCart className="size-4 text-primary" /> Próxima compra
            </span>
            <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-bold">
              {selectedIds.length} {selectedIds.length === 1 ? "item selecionado" : "itens selecionados"}
            </span>
          </div>

          <div className="flex items-baseline justify-between pt-1">
            <span className="text-xs font-bold text-muted-foreground">Estimado total</span>
            <span className="text-2xl font-black text-primary">{formatEUR(selectedTotal)}</span>
          </div>

          {selectedIds.length > 0 && (
            <div className="max-h-36 overflow-y-auto space-y-1 border-t border-b border-border/40 py-2 text-[12px]">
              {selectedItems.map((it) => (
                <div key={it.id} className="flex items-center justify-between py-0.5">
                  <span className="font-semibold truncate max-w-[220px]">{it.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-muted-foreground">{formatEUR(it.price)}</span>
                    <button
                      onClick={() => toggleSelect(it.id)}
                      className="text-muted-foreground hover:text-destructive transition p-0.5"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              disabled={selectedIds.length === 0}
              onClick={sendToComprar}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-[13px] font-extrabold hover:bg-primary/90 disabled:opacity-50 transition shadow-sm"
            >
              <ShoppingCart className="size-4" /> Adicionar à lista Comprar
            </button>
            {selectedIds.length > 0 && (
              <button
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-border text-muted-foreground hover:text-destructive hover:border-destructive/30 text-[11.5px] font-bold px-3 py-2.5 transition"
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const handleConfirmDestination = async (targetList: string) => {
    if (selectedItems.length === 0) return;
    try {
      const fresh = await refresh();
      const existingComprarInTarget = fresh.items.filter(
        (i) => effectiveIntent(i) === "comprar" && !i.bought && getItemListName(i) === targetList
      );

      let addedCount = 0;
      let duplicateCount = 0;

      for (const item of selectedItems) {
        const isDuplicate = existingComprarInTarget.some(
          (ex) => ex.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (isDuplicate) {
          duplicateCount++;
          continue;
        }

        await persistItem({
          data: {
            name: item.name,
            price: item.price,
            category: item.category,
            plan: "este_mes",
            listName: targetList,
            ...(item.store ? { store: item.store } : {}),
            ...(item.photo ? { photo: item.photo } : {}),
            ...(item.link ? { link: item.link } : {}),
            ...(item.notes ? { notes: item.notes } : {}),
            ...(item.quantity ? { quantity: item.quantity } : {}),
          },
        });
        addedCount++;
      }

      setSelectedIds([]);
      setShowOnlySelected(false);
      await reload();

      if (addedCount > 0) {
        const dupMsg =
          duplicateCount > 0
            ? ` (${duplicateCount} duplicado${duplicateCount > 1 ? "s" : ""} evitado${
                duplicateCount > 1 ? "s" : ""
              })`
            : "";
        toast.success(
          `${addedCount} ${
            addedCount === 1 ? "item adicionado" : "itens adicionados"
          } à lista "${targetList}"!${dupMsg}`
        );
      } else if (duplicateCount > 0) {
        toast.info(`Todos os itens selecionados já estão na lista "${targetList}".`);
      }
    } catch {
      toast.error("Erro ao adicionar itens à lista Comprar.");
    }
  };

  const handleAddItemToCategory = (catName: string) => {
    setEditing({
      id: "",
      name: "",
      price: 0,
      category: catName,
      bought: false,
      plan: "recorrentes",
      frequency: "semanal",
    } as ShoppingItem);
    setDialogOpen(true);
  };

  const handleCreateCategory = async () => {
    const clean = newCategoryName.trim();
    if (!clean) return;
    const existing = categories.find((c) => c.toLowerCase() === clean.toLowerCase());
    if (existing) {
      toast.info(`A categoria "${existing}" já existe.`);
      setSelectedCategory(existing);
      setNewCategoryModalOpen(false);
      setNewCategoryName("");
      return;
    }
    try {
      setCategories((prev) => [...prev, clean]);
      await persistCategory({ data: { name: clean } });
      await reload();
      setSelectedCategory(clean);
      toast.success(`Categoria "${clean}" criada!`);
    } catch {
      toast.error("Erro ao criar categoria.");
    }
    setNewCategoryModalOpen(false);
    setNewCategoryName("");
  };

  const handleRenameCategory = async () => {
    if (!renameCategoryTarget) return;
    const clean = renameCategoryValue.trim();
    if (!clean || clean === renameCategoryTarget) {
      setRenameCategoryTarget(null);
      return;
    }
    try {
      setCategories((prev) => prev.map((c) => (c === renameCategoryTarget ? clean : c)));
      setItems((prev) => prev.map((i) => (i.category === renameCategoryTarget ? { ...i, category: clean } : i)));
      if (selectedCategory === renameCategoryTarget) setSelectedCategory(clean);
      await persistRenameCategory({ data: { from: renameCategoryTarget, to: clean } });
      await reload();
      toast.success(`Categoria renomeada para "${clean}".`);
    } catch {
      toast.error("Erro ao renomear categoria.");
      void reload();
    }
    setRenameCategoryTarget(null);
  };

  const handleDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    const target = deleteCategoryTarget;
    try {
      setCategories((prev) => prev.filter((c) => c !== target));
      setItems((prev) => prev.map((i) => (i.category === target ? { ...i, category: "Outros" } : i)));
      if (selectedCategory === target) setSelectedCategory(null);
      await persistDeleteCategory({ data: { name: target, moveTo: "Outros" } });
      await reload();
      toast.success(`Categoria "${target}" excluída.`);
    } catch {
      toast.error("Erro ao excluir categoria.");
      void reload();
    }
    setDeleteCategoryTarget(null);
  };

  const handleSave = (data: Omit<ShoppingItem, "id" | "bought">, id?: string) => {
    void (async () => {
      try {
        // Checar duplicado de item base ao criar novo
        if (!id) {
          const isDup = baseItems.some(
            (b) =>
              b.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
              b.category === data.category
          );
          if (isDup) {
            toast.info(`O item "${data.name}" já existe na categoria "${data.category}".`);
            return;
          }
        }

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
            frequency: data.frequency ?? "semanal",
            plan: "recorrentes",
          },
        });
        await reload();
      } catch {
        toast.error("Erro ao salvar item base.");
      }
    })();
  };

  const removeHandler = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => prev.filter((i) => i !== id));
    void removeItem({ data: { id } }).catch(() => {
      toast.error("Erro ao remover.");
      void reload();
    });
  };

  return (
    <AppLayout>
      <div className="w-full max-w-[1400px] pb-24 space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Recorrentes</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Lista mestre permanente de compras frequentes. Clique em uma categoria para ver e selecionar seus produtos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setNewCategoryName("");
                setNewCategoryModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-[13px] font-bold text-foreground hover:bg-muted transition shadow-sm"
            >
              <FolderPlus className="size-4 text-primary" /> Nova categoria
            </button>
            <button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-extrabold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
            >
              <Plus className="size-4" /> Novo item base
            </button>
          </div>
        </div>

        {/* Layout Dashboard em 2 Colunas */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          {/* COLUNA ESQUERDA: Cards Compactos de Categoria */}
          <div className="w-full lg:w-[420px] xl:w-[460px] shrink-0 space-y-4">
            {/* Filtros de Planejamento e Selecionar Todos */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex gap-1.5 flex-wrap">
                {(["hoje", "amanha", "semana", "mes", "todos"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriod(p);
                      setShowOnlySelected(false);
                    }}
                    className={cn(
                      "px-3 py-1 text-[11.5px] font-bold rounded-full border transition",
                      period === p && !showOnlySelected
                        ? "bg-foreground text-background border-foreground shadow-sm"
                        : "bg-surface border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    {FILTER_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Grid de Cards Compactos de Categoria */}
            {allCategories.length === 0 ? (
              <EmptyState
                icon={Repeat2}
                title="Nenhuma categoria cadastrada"
                description="Crie suas categorias e cadastre seus produtos frequentes."
              />
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {allCategories.map((cat) => {
                  const catItems = baseItems.filter((i) => i.category === cat);
                  const catTotal = catItems.reduce((sum, i) => sum + itemTotal(i), 0);
                  const catSelectedCount = catItems.filter((i) => selectedIds.includes(i.id)).length;
                  const isSelected = selectedCategory === cat;

                  return (
                    <div key={cat} className="space-y-3">
                      <div
                        onClick={() => setSelectedCategory(isSelected ? null : cat)}
                        className={cn(
                          "group relative flex flex-col justify-between rounded-2xl border p-4 shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md"
                            : "border-border bg-surface hover:border-primary/40"
                        )}
                      >
                        {/* Topo do Card Compacto */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Folder className={cn("size-4 shrink-0 transition-colors", isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                              <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground truncate">
                                {cat}
                              </h2>
                            </div>

                            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground pt-0.5">
                              <span>{catItems.length} {catItems.length === 1 ? "item" : "itens"}</span>
                              {catTotal > 0 && <span className="text-foreground font-bold">· {formatEUR(catTotal)}</span>}
                            </div>
                          </div>

                          {/* Ações da Categoria */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleAddItemToCategory(cat)}
                              className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-extrabold text-foreground hover:bg-muted transition shadow-2xs"
                              title="Adicionar item nesta categoria"
                            >
                              <Plus className="size-3.5 text-primary" /> Item
                            </button>

                            <CategoryCardMenu
                              onAddItem={() => handleAddItemToCategory(cat)}
                              onRename={() => {
                                setRenameCategoryTarget(cat);
                                setRenameCategoryValue(cat);
                              }}
                              onReorder={() => toast.info(`Itens de "${cat}" ordenados.`)}
                              onDelete={() => setDeleteCategoryTarget(cat)}
                            />
                          </div>
                        </div>

                        {/* Rodapé do Card Compacto */}
                        <div className="flex items-center justify-between border-t border-border/50 pt-2.5 mt-3 text-[11.5px]">
                          <span className="font-semibold text-muted-foreground">
                            {catSelectedCount > 0 ? (
                              <strong className="text-primary">{catSelectedCount} selecionado{catSelectedCount > 1 ? "s" : ""}</strong>
                            ) : (
                              "Toque para expandir produtos"
                            )}
                          </span>
                          <ChevronRight className={cn("size-4 text-muted-foreground/60 transition-transform", isSelected && "rotate-90 text-primary")} />
                        </div>
                      </div>

                      {/* EXCLUSIVO MOBILE: Expansão Sanfona diretamente abaixo do Card Selecionado */}
                      {isSelected && (
                        <div className="lg:hidden animate-in fade-in slide-in-from-top-2 duration-200 pb-2">
                          {renderCategoryDetail(cat)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* COLUNA DIREITA (DESKTOP): Painel de Detalhes da Categoria & Lista Selecionável */}
          <div className="flex-1 w-full min-w-0 hidden lg:block">
            {!selectedCategory ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center space-y-3">
                <div className="grid size-12 place-items-center rounded-2xl bg-muted/60 text-muted-foreground mx-auto">
                  <Repeat2 className="size-6" />
                </div>
                <h3 className="text-base font-bold">Selecione uma categoria</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  Clique em qualquer card de categoria à esquerda para visualizar e marcar os produtos que precisa comprar.
                </p>
              </div>
            ) : (
              renderCategoryDetail(selectedCategory)
            )}
          </div>
        </div>
      </div>

      {/* Floating Sticky Action Bar no Mobile */}
      {selectedIds.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 sm:bottom-6 z-40 flex justify-center px-4 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between gap-3 w-full max-w-md rounded-2xl border border-border bg-foreground text-background p-3 shadow-float">
            <div className="pl-1">
              <p className="text-[13px] font-extrabold leading-none">
                {selectedIds.length} {selectedIds.length === 1 ? "selecionado" : "selecionados"}
              </p>
              <p className="text-[11px] text-primary-foreground/80 font-bold mt-1">
                Total: {formatEUR(selectedTotal)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedIds([])}
                className="grid size-8 place-items-center text-background/70 hover:text-background rounded-lg"
                title="Limpar seleção"
              >
                <X className="size-4" />
              </button>
              <button
                onClick={sendToComprar}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[12.5px] font-extrabold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
              >
                <ShoppingCart className="size-4" /> Adicionar à lista
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ItemDialog */}
      <ItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        categories={categories}
        editing={editing}
        defaultPlan="recorrentes"
        onSave={handleSave}
        onCreateCategory={(name) => {
          setCategories((prev) => (prev.includes(name) ? prev : [...prev, name]));
          void persistCategory({ data: { name } }).catch(() => toast.error("Erro ao criar categoria."));
        }}
      />

      {/* DestinationDialog */}
      <DestinationDialog
        open={destDialogOpen}
        onOpenChange={setDestDialogOpen}
        selectedCount={selectedItems.length}
        onConfirm={handleConfirmDestination}
      />

      {/* Modal Nova Categoria */}
      {newCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold">Criar Nova Categoria</h3>
            <input
              type="text"
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nome da categoria (ex: Pet, Bebidas...)"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none transition focus:border-primary"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setNewCategoryModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                disabled={!newCategoryName.trim()}
                onClick={handleCreateCategory}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Renomear Categoria */}
      {renameCategoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold">Renomear Categoria</h3>
            <input
              type="text"
              autoFocus
              value={renameCategoryValue}
              onChange={(e) => setRenameCategoryValue(e.target.value)}
              placeholder="Novo nome"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm outline-none transition focus:border-primary"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRenameCategoryTarget(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                disabled={!renameCategoryValue.trim()}
                onClick={handleRenameCategory}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-extrabold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão de Categoria */}
      {deleteCategoryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold">Excluir Categoria</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Tem certeza que deseja excluir a categoria <strong>"{deleteCategoryTarget}"</strong>? Os itens desta categoria serão mantidos e movidos para "Outros".
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeleteCategoryTarget(null)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteCategory}
                className="rounded-xl bg-destructive px-4 py-2 text-xs font-extrabold text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function CategoryCardMenu({
  onAddItem,
  onRename,
  onReorder,
  onDelete,
}: {
  onAddItem: () => void;
  onRename: () => void;
  onReorder: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid size-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
        aria-label="Opções da categoria"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-44 rounded-xl border border-border bg-surface shadow-float py-1 animate-rise">
            <button
              onClick={() => {
                setOpen(false);
                onAddItem();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
            >
              <Plus className="size-3.5 text-muted-foreground" /> Adicionar item
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onRename();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
            >
              <FolderEdit className="size-3.5 text-muted-foreground" /> Renomear
            </button>
            <button
              onClick={() => {
                setOpen(false);
                onReorder();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
            >
              <ArrowUpDown className="size-3.5 text-muted-foreground" /> Reordenar itens
            </button>
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="size-3.5" /> Excluir
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function RowMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="grid size-7 place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition"
        aria-label="Mais opções"
      >
        <MoreHorizontal className="size-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-40 rounded-xl border border-border bg-surface shadow-float py-1 animate-rise">
            <button
              onClick={() => {
                setOpen(false);
                onEdit();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium hover:bg-muted"
            >
              <Pencil className="size-3.5 text-muted-foreground" /> Editar item
            </button>
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] font-medium text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="size-3.5" /> Excluir
            </button>
          </div>
        </>
      )}
    </div>
  );
}
