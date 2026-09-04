import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ShoppingCart,
  Heart,
  Repeat2,
  ArrowRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { QuickCapture } from "@/components/QuickCapture";
import { EmptyState } from "@/components/EmptyState";
import { PurchaseConfirmModal, type PurchaseConfirmResult } from "@/components/PurchaseConfirmModal";
import {
  formatEUR,
  itemTotal,
  effectiveIntent,
  planFromIntent,
  loadItems,
  type ShoppingItem,
  type ItemIntent,
} from "@/lib/shopping";
import { requireUnlocked } from "@/lib/gate.functions";
import { getList, saveItem, setItemBought } from "@/lib/list.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    await requireUnlocked();
    return await getList();
  },
  component: Index,
});

const LEGACY_KEY = "lista-compras:items";

function Index() {
  const initial = Route.useLoaderData();
  const refresh = useServerFn(getList);
  const persistItem = useServerFn(saveItem);
  const persistBought = useServerFn(setItemBought);

  const [items, setItems] = useState<ShoppingItem[]>(initial.items);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const migrated = useRef(false);

  const [purchaseItem, setPurchaseItem] = useState<ShoppingItem | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseAccounts, setPurchaseAccounts] = useState<
    { id: string; name: string; balance: number; currency: "EUR" | "USD" | "BRL" }[]
  >([]);

  const [bankTotal, setBankTotal] = useState(0);
  const [unpaidExpenses, setUnpaidExpenses] = useState<any[]>([]);

  useEffect(() => {
    try {
      const accounts = JSON.parse(localStorage.getItem("minha-lista:accounts") ?? "[]");
      const expenses = JSON.parse(localStorage.getItem("minha-lista:expenses") ?? "[]");
      const rates = JSON.parse(localStorage.getItem("minha-lista:eur-rates") ?? '{"USD":1.1,"BRL":6.0}');

      const bTotal = accounts.reduce((sum: number, acc: any) => {
        if (acc.currency === "EUR") return sum + acc.balance;
        return sum + acc.balance / (rates[acc.currency] || 1);
      }, 0);

      const unpaid = expenses.filter((e: any) => !e.paid).sort((a: any, b: any) => a.dueDay - b.dueDay);

      setBankTotal(bTotal);
      setUnpaidExpenses(unpaid);
    } catch {}
  }, []);

  const reload = useCallback(async () => {
    const fresh = await refresh();
    setItems(fresh.items);
    setCategories(fresh.categories);
  }, [refresh]);

  useEffect(() => {
    void reload();
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

  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    const legacy = loadItems();
    if (legacy.length === 0) return;
    if (initial.items.length > 0) {
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    void (async () => {
      try {
        for (const item of legacy) {
          await persistItem({
            data: {
              name: item.name,
              price: item.price,
              link: item.link ?? null,
              photo: item.photo ?? null,
              category: item.category,
            },
          });
        }
        localStorage.removeItem(LEGACY_KEY);
        await reload();
        toast.success("Sua lista antiga foi salva no banco de dados.");
      } catch {
        toast.error("Não foi possível migrar a lista antiga.");
      }
    })();
  }, [initial.items.length, persistItem, reload]);

  const handleQuickAdd = async (partialItem: Partial<ShoppingItem>, intent: ItemIntent) => {
    try {
      await persistItem({
        data: {
          name: partialItem.name || "Novo item",
          price: partialItem.price || 0,
          category: partialItem.category || "Outros",
          plan: planFromIntent(intent),
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
      toast.success("Item adicionado com sucesso.");
    } catch {
      toast.error("Não foi possível adicionar o item.");
    }
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

      await persistBought({ data: { id: purchaseItem.id, bought: true } });
      await reload();
      toast.success(`Compra registrada na conta ${result.account.name}.`);
    } catch {
      toast.error("Erro ao processar o pagamento.");
    }
    setPurchaseOpen(false);
  };

  const dateStr = new Date().toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const allComprar = items.filter((i) => !i.bought && effectiveIntent(i) === "comprar");
  const comprarItems = allComprar.slice(0, 4); // Max 4 items on home
  const allRecorrentes = items.filter((i) => !i.bought && effectiveIntent(i) === "recorrente");
  const allDesejos = items.filter((i) => effectiveIntent(i) === "desejo");
  const desejos = allDesejos.slice(0, 4);

  const upcomingList = [
    ...unpaidExpenses.map((e) => ({
      name: e.name,
      priceStr: formatEUR(e.amount),
      dateStr: `${String(e.dueDay).padStart(2, "0")} ${new Date().toLocaleString("pt-PT", {
        month: "short",
      })}`,
      sortVal: e.dueDay,
    })),
    ...allRecorrentes.map((r) => ({
      name: r.name,
      priceStr: `~${formatEUR(itemTotal(r))}`,
      dateStr: "Em breve",
      sortVal: 99,
    })),
  ]
    .sort((a, b) => a.sortVal - b.sortVal)
    .slice(0, 5);

  return (
    <AppLayout>
      <div className="w-full max-w-[1400px] space-y-6 pb-24">
        {/* ── 1. HEADER & QUICK CAPTURE TOP AREA ── */}
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Hoje</h1>
            <p className="text-sm text-muted-foreground capitalize mt-0.5">{dateStr}</p>
          </div>

          <QuickCapture
            defaultIntent="comprar"
            categories={categories}
            onAdd={handleQuickAdd}
            mobilePlaceholder="Cole um link ou adicione um produto..."
          />
        </div>

        {/* ── 2. SUMMARY CARDS ROW ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: A Comprar */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">A Comprar</span>
              <ShoppingCart className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {allComprar.length}{" "}
                <span className="text-xs font-bold text-muted-foreground">
                  {allComprar.length === 1 ? "item" : "itens"}
                </span>
              </p>
              <p className="text-xs font-bold text-primary mt-0.5">
                {formatEUR(allComprar.reduce((s, i) => s + itemTotal(i), 0))}
              </p>
            </div>
          </div>

          {/* Card 2: Contas */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Contas</span>
              <Repeat2 className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {unpaidExpenses.length}{" "}
                <span className="text-xs font-bold text-muted-foreground">a pagar</span>
              </p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                Próximos vencimentos
              </p>
            </div>
          </div>

          {/* Card 3: Desejos */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Desejos</span>
              <Heart className="size-4 text-rose-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {allDesejos.length}{" "}
                <span className="text-xs font-bold text-muted-foreground">salvos</span>
              </p>
              <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                Lista de vontades
              </p>
            </div>
          </div>

          {/* Card 4: Livre (Highlighted Green) */}
          <div className="flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Livre</span>
              <span className="size-2 rounded-full bg-emerald-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatEUR(Math.max(0, bankTotal - unpaidExpenses.reduce((s, e) => s + e.amount, 0)))}
              </p>
              <p className="text-xs font-bold text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                Saldo disponível
              </p>
            </div>
          </div>
        </div>

        {/* ── 3. MAIN DASHBOARD CONTENT (2 COLUMNS DESKTOP) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* LEFT COLUMN: Preciso Resolver Container */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <ShoppingCart className="size-4 text-primary" /> Preciso resolver
                </h2>
                <Link
                  to="/comprar"
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  Ver todos ({allComprar.length}) <ArrowRight className="size-3" />
                </Link>
              </div>

              {comprarItems.length === 0 ? (
                <EmptyState
                  compact
                  icon={ShoppingCart}
                  title="Nada para comprar agora"
                  description="Todos os itens urgentes estão em dia."
                />
              ) : (
                <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-background">
                  {comprarItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Action radio button */}
                        <button
                          onClick={() => {
                            try {
                              setPurchaseAccounts(
                                JSON.parse(localStorage.getItem("minha-lista:accounts") ?? "[]")
                              );
                            } catch {
                              setPurchaseAccounts([]);
                            }
                            setPurchaseItem(item);
                            setPurchaseOpen(true);
                          }}
                          className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-border/80 hover:border-primary text-transparent hover:text-primary transition-all cursor-pointer"
                          aria-label="Marcar como comprado"
                        >
                          <Check className="size-3.5 stroke-[3]" />
                        </button>

                        {/* Image */}
                        {item.photo ? (
                          <img
                            src={item.photo}
                            alt={item.name}
                            className="size-11 shrink-0 rounded-lg object-cover bg-muted border border-border/50"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted/50 border border-border/50 text-muted-foreground/40">
                            <ShoppingCart className="size-4" />
                          </div>
                        )}

                        {/* Name + Category */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13.5px] font-bold text-foreground leading-snug truncate">
                            {item.name}
                          </p>
                          <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                            {item.category} {item.store ? `· ${item.store}` : ""}
                          </p>
                        </div>
                      </div>

                      {/* Price */}
                      <span className="shrink-0 text-[13.5px] font-extrabold text-foreground tabular-nums">
                        {formatEUR(itemTotal(item))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* RIGHT COLUMN: Próximos Container */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Repeat2 className="size-4 text-muted-foreground" /> Próximos
                </h2>
                <Link
                  to="/recorrentes"
                  className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
                >
                  Ver todos <ArrowRight className="size-3" />
                </Link>
              </div>

              {upcomingList.length === 0 ? (
                <EmptyState
                  compact
                  icon={Repeat2}
                  title="Nenhum evento próximo"
                  description="Sem contas ou compras previstas nos próximos dias."
                />
              ) : (
                <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-background">
                  {upcomingList.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 px-3.5 py-3 hover:bg-muted/30 transition-colors min-h-[56px]"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10.5px] font-bold uppercase text-muted-foreground shrink-0">
                          {item.dateStr}
                        </span>
                        <p className="text-[13.5px] font-bold text-foreground truncate">
                          {item.name}
                        </p>
                      </div>
                      <span className="shrink-0 text-[13.5px] font-extrabold text-muted-foreground tabular-nums">
                        {item.priceStr}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── 4. DESEJOS EM DESTAQUE SHOWCASE ── */}
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Heart className="size-4 text-rose-500" /> Desejos em destaque
            </h2>
            <Link
              to="/desejos"
              className="text-xs font-bold text-primary flex items-center gap-1 hover:underline"
            >
              Ver todos ({allDesejos.length}) <ArrowRight className="size-3" />
            </Link>
          </div>

          {desejos.length === 0 ? (
            <EmptyState
              compact
              icon={Heart}
              title="Sem desejos anotados"
              description="Explore produtos e salve os que tem vontade de comprar."
            />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              {desejos.slice(0, 4).map((item) => (
                <div
                  key={item.id}
                  className="group flex flex-col justify-between rounded-xl border border-border bg-background p-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden"
                >
                  <div className="space-y-2">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt={item.name}
                        className="w-full h-32 object-cover rounded-lg bg-muted border border-border/40"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-32 grid place-items-center rounded-lg bg-muted/40 text-muted-foreground/30 border border-border/40">
                        <Heart className="size-8" />
                      </div>
                    )}
                    <div>
                      <p className="text-[13px] font-bold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                        {item.name}
                      </p>
                      {item.store && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                          {item.store}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="mt-2.5 text-[14px] font-extrabold text-primary tabular-nums">
                    {formatEUR(itemTotal(item))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

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
