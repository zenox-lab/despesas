import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowRightLeft,
  TrendingUp,
  Landmark,
  Wallet,
  Pencil,
  Trash2,
  Check,
  Calendar as CalendarIcon,
  Tag,
  PieChart,
  Repeat,
  Play,
  Pause,
  MoreVertical,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatEUR, parseFlexibleNumber } from "@/lib/shopping";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/financas")({
  component: Finances,
});

type Frequency = "mensal" | "anual" | "unica";
type Currency = "EUR" | "USD" | "BRL";

// Despesa Fixa (Registro Permanente Reutilizável)
type FixedExpense = {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  dueDay: number;
  category: string;
  preferredAccountId?: string;
  paused: boolean;
  notes?: string;
};

// Ocorrência Mensal de Despesa
type Expense = {
  id: string;
  name: string;
  amount: number;
  category: string;
  dueDay: number;
  frequency: Frequency;
  paid: boolean;
  accountId?: string;
  notes?: string;
  date?: string;
  fixedExpenseId?: string;
  monthKey?: string;
};

type AccountKind = "banco" | "digital" | "corretora" | "dinheiro";
type Account = {
  id: string;
  name: string;
  balance: number;
  kind: AccountKind;
  currency: Currency;
  color: string;
};

type Movement = {
  id: string;
  accountId: string;
  type: "entrada" | "saida";
  amount: number;
  description: string;
  date: string;
};

type FxRates = { USD: number; BRL: number; date: string };

const KEY = "minha-lista:expenses";
const FIXED_KEY = "minha-lista:fixed-expenses";
const CATEGORY_KEY = "minha-lista:expense-categories";
const ACCOUNT_KEY = "minha-lista:accounts";
const MOVEMENT_KEY = "minha-lista:movements";
const FX_KEY = "minha-lista:eur-rates";

const PRESET_ACCOUNTS: Account[] = [
  { id: "preset-santander", name: "Santander", balance: 0, kind: "banco", currency: "EUR", color: "#ec0000" },
  { id: "preset-bbva", name: "BBVA", balance: 0, kind: "banco", currency: "EUR", color: "#001391" },
  { id: "preset-wise", name: "Wise", balance: 0, kind: "digital", currency: "EUR", color: "#9fe870" },
  { id: "preset-nomad", name: "Nomad", balance: 0, kind: "digital", currency: "USD", color: "#111111" },
  { id: "preset-apex", name: "Apex Trader Funding", balance: 0, kind: "corretora", currency: "USD", color: "#2563eb" },
  { id: "preset-btg", name: "BTG Pactual", balance: 0, kind: "corretora", currency: "BRL", color: "#001e62" },
];

const DEFAULT_FIXED_EXPENSES: FixedExpense[] = [
  {
    id: "fe-aluguel",
    name: "Aluguel",
    amount: 900,
    currency: "EUR",
    dueDay: 5,
    category: "Casa",
    preferredAccountId: "preset-santander",
    paused: false,
  },
  {
    id: "fe-telefone",
    name: "Telefone",
    amount: 20,
    currency: "EUR",
    dueDay: 10,
    category: "Serviços",
    preferredAccountId: "preset-wise",
    paused: false,
  },
  {
    id: "fe-academia",
    name: "Academia",
    amount: 30,
    currency: "EUR",
    dueDay: 15,
    category: "Saúde",
    paused: false,
  },
  {
    id: "fe-metro",
    name: "Recarga Cartão Metrô",
    amount: 33,
    currency: "EUR",
    dueDay: 24,
    category: "Transporte",
    paused: false,
  },
];

const DEFAULT_CATEGORIES = [
  "Alimentação",
  "Compras",
  "Casa",
  "Transporte",
  "Saúde",
  "Lazer",
  "Assinaturas",
  "Serviços",
  "Outros",
];

function load<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

function money(value: number, currency: Currency) {
  const symbol = { EUR: "€", USD: "$", BRL: "R$" }[currency];
  return `${symbol}${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

function Finances() {
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);

  const [fixedDialogOpen, setFixedDialogOpen] = useState(false);
  const [editingFixedExpense, setEditingFixedExpense] = useState<FixedExpense | null>(null);

  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);

  const [payAccountModalOpen, setPayAccountModalOpen] = useState(false);
  const [expenseToPay, setExpenseToPay] = useState<Expense | null>(null);

  // Estado do Dia Selecionado e Modal de Detalhes
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<number | null>(null);
  const [dayDetailModalOpen, setDayDetailModalOpen] = useState(false);
  const [presetDayForNewExpense, setPresetDayForNewExpense] = useState<{ dueDay: number; date: string } | null>(null);

  const [fxRates, setFxRates] = useState<FxRates>({ USD: 1.17, BRL: 6.3, date: "" });
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthLabel = useMemo(() => {
    return new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(currentDate);
  }, [currentDate]);

  const currentMonthKey = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = String(currentDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [currentDate]);

  const prevMonth = () => {
    setSelectedCalendarDay(null);
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const nextMonth = () => {
    setSelectedCalendarDay(null);
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };

  useEffect(() => {
    const loadedFixed = load(FIXED_KEY, DEFAULT_FIXED_EXPENSES);
    const hasMetro = loadedFixed.some((item) => item.id === "fe-metro" || item.name.toLowerCase().includes("metrô") || item.name.toLowerCase().includes("metro"));
    const mergedFixed = hasMetro
      ? loadedFixed
      : [
          ...loadedFixed,
          {
            id: "fe-metro",
            name: "Recarga Cartão Metrô",
            amount: 33,
            currency: "EUR" as Currency,
            dueDay: 24,
            category: "Transporte",
            paused: false,
          },
        ];
    setFixedExpenses(mergedFixed);
    localStorage.setItem(FIXED_KEY, JSON.stringify(mergedFixed));

    setExpenses(load(KEY, []));
    setCategories(load(CATEGORY_KEY, DEFAULT_CATEGORIES));
    setMovements(load(MOVEMENT_KEY, []));

    const stored = load<Partial<Account>[]>(ACCOUNT_KEY, []).map((account) => ({
      id: account.id ?? crypto.randomUUID(),
      name: account.name ?? "Conta",
      balance: account.balance ?? 0,
      kind: account.kind ?? "banco",
      currency: account.currency ?? "EUR",
      color: account.color ?? "#2563eb",
    }));

    const filteredStored = stored.filter(
      (a) => !a.name.toLowerCase().includes("c6")
    );

    const aliases: Record<string, string[]> = {
      Santander: ["santander"],
      Wise: ["wise"],
      Nomad: ["nomad"],
      BBVA: ["bbva"],
      "Apex Trader Funding": ["apex trader funding", "apex", "eps"],
      "BTG Pactual": ["btg pactual", "btg"],
    };

    const merged = PRESET_ACCOUNTS.map((preset) => {
      const existing = filteredStored.find((account) =>
        aliases[preset.name]?.includes(account.name.toLocaleLowerCase("pt"))
      );
      return existing
        ? { ...existing, name: preset.name }
        : preset;
    });

    setAccounts(merged);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(merged));
  }, []);

  useEffect(() => {
    const cached = load<FxRates | null>(FX_KEY, null);
    if (cached?.USD && cached?.BRL) setFxRates(cached);
    fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,BRL")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { date: string; rates: { USD: number; BRL: number } }) => {
        if (!data.rates?.USD || !data.rates?.BRL) return;
        const next = { USD: data.rates.USD, BRL: data.rates.BRL, date: data.date };
        setFxRates(next);
        localStorage.setItem(FX_KEY, JSON.stringify(next));
      })
      .catch(() => undefined);
  }, []);

  const persistExpenses = (next: Expense[]) => {
    setExpenses(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  };
  const persistFixedExpenses = (next: FixedExpense[]) => {
    setFixedExpenses(next);
    localStorage.setItem(FIXED_KEY, JSON.stringify(next));
  };
  const persistAccounts = (next: Account[]) => {
    setAccounts(next);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next));
  };
  const persistMovements = (next: Movement[]) => {
    setMovements(next);
    localStorage.setItem(MOVEMENT_KEY, JSON.stringify(next));
  };

  // Gerador/Sincronizador automático de ocorrências mensais a partir de Despesas Fixas
  useEffect(() => {
    if (fixedExpenses.length === 0) return;

    let changed = false;
    const updated = [...expenses];

    for (const fixed of fixedExpenses) {
      if (fixed.paused) continue;

      const exists = updated.some(
        (e) =>
          e.fixedExpenseId === fixed.id &&
          (e.monthKey === currentMonthKey || e.date?.startsWith(currentMonthKey))
      );

      if (!exists) {
        const dayStr = String(Math.min(fixed.dueDay, 28)).padStart(2, "0");
        const occurrence: Expense = {
          id: `fe_${fixed.id}_${currentMonthKey}`,
          fixedExpenseId: fixed.id,
          monthKey: currentMonthKey,
          name: fixed.name,
          amount: fixed.amount,
          category: fixed.category,
          dueDay: fixed.dueDay,
          frequency: "mensal",
          paid: false,
          accountId: fixed.preferredAccountId,
          notes: fixed.notes,
          date: `${currentMonthKey}-${dayStr}`,
        };
        updated.push(occurrence);
        changed = true;
      }
    }

    if (changed) {
      persistExpenses(updated);
    }
  }, [fixedExpenses, currentMonthKey]);

  // Filtragem de despesas do mês corrente selecionado
  const currentMonthExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      if (exp.monthKey) return exp.monthKey === currentMonthKey;
      if (exp.date) return exp.date.startsWith(currentMonthKey);
      return true;
    });
  }, [expenses, currentMonthKey]);

  // Totais mensais do mês ativo
  const totalPrevisto = useMemo(
    () => currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0),
    [currentMonthExpenses]
  );
  const totalPago = useMemo(
    () => currentMonthExpenses.filter((e) => e.paid).reduce((sum, e) => sum + e.amount, 0),
    [currentMonthExpenses]
  );
  const totalAindaVaiSair = totalPrevisto - totalPago;

  const bankTotal = useMemo(
    () =>
      accounts.reduce((sum, account) => {
        if (account.currency === "EUR") return sum + account.balance;
        return sum + account.balance / (fxRates[account.currency] || 1);
      }, 0),
    [accounts, fxRates]
  );

  const saldoLivre = Math.max(0, bankTotal - totalAindaVaiSair);

  // Agrupamento de contas
  const accountGroups = useMemo(() => {
    const digital = accounts.filter(
      (a) => a.kind === "digital" || a.name === "Wise" || a.name === "Nomad"
    );
    const banco = accounts.filter(
      (a) =>
        (a.kind === "banco" && a.name !== "BTG Pactual") ||
        a.name === "Santander" ||
        a.name === "BBVA"
    );
    const trading = accounts.filter(
      (a) =>
        a.kind === "corretora" ||
        a.name.includes("Apex") ||
        a.name.includes("BTG")
    );

    return [
      { title: "CONTA DIGITAL", items: digital, icon: Wallet },
      { title: "BANCO FÍSICO", items: banco, icon: Landmark },
      { title: "MESA PROPRIETÁRIA / TRADING", items: trading, icon: TrendingUp },
    ];
  }, [accounts]);

  // Próximas despesas pendentes do mês ordenadas por dia
  const upcomingExpenses = useMemo(() => {
    return currentMonthExpenses
      .filter((e) => !e.paid)
      .sort((a, b) => a.dueDay - b.dueDay);
  }, [currentMonthExpenses]);

  // Despesas agrupadas por categoria para o mês atual
  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of categories) map.set(cat, 0);
    for (const exp of currentMonthExpenses) {
      const current = map.get(exp.category) ?? 0;
      map.set(exp.category, current + exp.amount);
    }
    return Array.from(map.entries()).filter(([_, total]) => total > 0);
  }, [currentMonthExpenses, categories]);

  // Dias do calendário para o mês corrente
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();

    const days = [];
    for (let i = 0; i < firstDayIndex; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(day);
    return days;
  }, [currentDate]);

  // Mapear despesas por dia do mês corrente
  const currentMonthExpensesByDayMap = useMemo(() => {
    const map = new Map<number, Expense[]>();
    for (const exp of currentMonthExpenses) {
      const list = map.get(exp.dueDay) ?? [];
      list.push(exp);
      map.set(exp.dueDay, list);
    }
    return map;
  }, [currentMonthExpenses]);

  // Toggle de status Pago / Pendente com modal de confirmação
  const handleTogglePaid = (expense: Expense) => {
    if (expense.paid) {
      // Reverter pagamento
      persistExpenses(
        expenses.map((item) => (item.id === expense.id ? { ...item, paid: false } : item))
      );
      if (expense.accountId) {
        persistAccounts(
          accounts.map((acc) =>
            acc.id === expense.accountId ? { ...acc, balance: acc.balance + expense.amount } : acc
          )
        );
      }
      toast.info(`Despesa "${expense.name}" marcada como pendente.`);
    } else {
      // Marcar como pago -> Abrir modal de conta e confirmação
      setExpenseToPay(expense);
      setPayAccountModalOpen(true);
    }
  };

  const handleDeleteExpense = (expense: Expense) => {
    persistExpenses(expenses.filter((e) => e.id !== expense.id));
    if (expense.paid && expense.accountId) {
      persistAccounts(
        accounts.map((acc) =>
          acc.id === expense.accountId ? { ...acc, balance: acc.balance + expense.amount } : acc
        )
      );
    }
    toast.success(`Despesa "${expense.name}" removida.`);
  };

  const handleConfirmPayExpense = (selectedAccountId: string, paidAmount: number, paymentDate?: string) => {
    if (!expenseToPay) return;
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) return;

    const dateToSave = paymentDate || expenseToPay.date || new Date().toISOString().split("T")[0];

    persistExpenses(
      expenses.map((item) =>
        item.id === expenseToPay.id
          ? {
              ...item,
              paid: true,
              accountId: selectedAccountId,
              amount: paidAmount,
              date: dateToSave,
            }
          : item
      )
    );

    // Deduzir valor da conta selecionada
    persistAccounts(
      accounts.map((acc) =>
        acc.id === selectedAccountId
          ? { ...acc, balance: acc.balance - paidAmount }
          : acc
      )
    );

    // Registrar movimentação de saída
    const movement: Movement = {
      id: crypto.randomUUID(),
      accountId: selectedAccountId,
      type: "saida",
      amount: paidAmount,
      description: `Pagamento · ${expenseToPay.name}`,
      date: new Date().toISOString(),
    };
    persistMovements([movement, ...movements]);

    toast.success(`Despesa "${expenseToPay.name}" paga com a conta ${account.name}!`);
    setExpenseToPay(null);
    setPayAccountModalOpen(false);
  };

  const handleSaveFixedExpense = (fixed: FixedExpense) => {
    if (editingFixedExpense) {
      const nextList = fixedExpenses.map((item) => (item.id === fixed.id ? fixed : item));
      persistFixedExpenses(nextList);

      // Se existir ocorrência pendente no mês atual, atualiza seus dados básicos
      persistExpenses(
        expenses.map((item) => {
          if (item.fixedExpenseId === fixed.id && !item.paid && item.monthKey === currentMonthKey) {
            return {
              ...item,
              name: fixed.name,
              amount: fixed.amount,
              category: fixed.category,
              dueDay: fixed.dueDay,
              accountId: fixed.preferredAccountId,
            };
          }
          return item;
        })
      );
      toast.success("Despesa fixa atualizada!");
    } else {
      persistFixedExpenses([...fixedExpenses, fixed]);
      toast.success("Nova despesa fixa cadastrada!");
    }
    setFixedDialogOpen(false);
  };

  const handleSaveExpense = (expense: Expense, deductBalanceNow?: boolean, sourceAccountId?: string) => {
    const expenseWithMonth: Expense = {
      ...expense,
      monthKey: currentMonthKey,
      date: expense.date || `${currentMonthKey}-${String(expense.dueDay).padStart(2, "0")}`,
    };

    if (editingExpense) {
      // Ajustar saldo de conta se o valor ou conta mudou para uma despesa já paga
      if (editingExpense.paid) {
        persistAccounts(
          accounts.map((acc) => {
            let b = acc.balance;
            if (acc.id === editingExpense.accountId) {
              b += editingExpense.amount; // Reverter valor anterior
            }
            if (expenseWithMonth.paid && acc.id === (expenseWithMonth.accountId || sourceAccountId)) {
              b -= expenseWithMonth.amount; // Aplicar novo valor
            }
            return { ...acc, balance: b };
          })
        );
      }
      persistExpenses(expenses.map((item) => (item.id === expense.id ? expenseWithMonth : item)));
      toast.success("Despesa atualizada.");
    } else {
      persistExpenses([...expenses, expenseWithMonth]);
      if (deductBalanceNow && sourceAccountId) {
        persistAccounts(
          accounts.map((acc) =>
            acc.id === sourceAccountId ? { ...acc, balance: acc.balance - expense.amount } : acc
          )
        );
        const movement: Movement = {
          id: crypto.randomUUID(),
          accountId: sourceAccountId,
          type: "saida",
          amount: expense.amount,
          description: `Despesa · ${expense.name}`,
          date: new Date().toISOString(),
        };
        persistMovements([movement, ...movements]);
      }
      toast.success("Nova despesa cadastrada!");
    }
    setExpenseDialogOpen(false);
  };

  const handleOpenAddExpenseForDay = (day: number) => {
    const monthStr = String(currentDate.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    setPresetDayForNewExpense({
      dueDay: day,
      date: `${currentDate.getFullYear()}-${monthStr}-${dayStr}`,
    });
    setEditingExpense(null);
    setExpenseDialogOpen(true);
  };

  return (
    <AppLayout>
      <div className="w-full max-w-[1400px] pb-24 space-y-6">
        {/* ── HEADER DA PÁGINA COM NAVEGAÇÃO DE MÊS ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={prevMonth}
              className="grid size-9 place-items-center rounded-xl border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition shadow-sm"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="size-5" />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight capitalize">{monthLabel}</h1>
              <p className="text-xs text-muted-foreground font-semibold">Painel de Controle Financeiro</p>
            </div>
            <button
              onClick={nextMonth}
              className="grid size-9 place-items-center rounded-xl border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground transition shadow-sm"
              aria-label="Próximo mês"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          <Button
            onClick={() => {
              setPresetDayForNewExpense(null);
              setEditingExpense(null);
              setExpenseDialogOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-extrabold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
          >
            <Plus className="size-4" /> Nova despesa
          </Button>
        </div>

        {/* ── 1. MONTH SUMMARY CARDS ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* Card 1: Disponível */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Saldo disponível</span>
              <Wallet className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {formatEUR(bankTotal)}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Todas as contas</p>
            </div>
          </div>

          {/* Card 2: Previsto */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Previsto no mês</span>
              <CalendarIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                {formatEUR(totalPrevisto)}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Total de despesas</p>
            </div>
          </div>

          {/* Card 3: Já pago */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Já pago</span>
              <Check className="size-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-emerald-600">
                {formatEUR(totalPago)}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Quitado no mês</p>
            </div>
          </div>

          {/* Card 4: Ainda vai sair */}
          <div className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Ainda vai sair</span>
              <TrendingUp className="size-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-amber-600">
                {formatEUR(totalAindaVaiSair)}
              </p>
              <p className="text-[11px] font-semibold text-muted-foreground mt-0.5">Pendente no mês</p>
            </div>
          </div>

          {/* Card 5: Livre depois das contas */}
          <div className="col-span-2 md:col-span-1 flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm h-full">
            <div className="flex items-center justify-between text-emerald-600 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider">Livre pós-contas</span>
              <Wallet className="size-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-black tracking-tight text-emerald-700">
                {formatEUR(saldoLivre)}
              </p>
              <p className="text-[11px] font-semibold text-emerald-600/80 mt-0.5">Estimativa livre</p>
            </div>
          </div>
        </div>

        {/* ── 2. ACCOUNTS / WALLETS ── */}
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                <Landmark className="size-4 text-primary" /> Contas & Saldos
              </h2>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Visão detalhada por instituição financeira
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() => setMovementDialogOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs font-extrabold rounded-xl border-border bg-background hover:bg-muted"
              >
                <Plus className="size-3.5" /> Nova movimentação
              </Button>

              <Button
                onClick={() => setTransferDialogOpen(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs font-extrabold rounded-xl border-border bg-background hover:bg-muted"
              >
                <ArrowRightLeft className="size-3.5" /> Transferir
              </Button>

              <Button
                onClick={() => {
                  setEditingAccount(null);
                  setAccountDialogOpen(true);
                }}
                variant="outline"
                size="sm"
                className="flex items-center gap-1.5 text-xs font-extrabold rounded-xl border-border bg-background hover:bg-muted"
              >
                <Plus className="size-3.5" /> Adicionar conta
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accountGroups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div
                  key={group.title}
                  className="rounded-xl border border-border/80 bg-background/50 p-3.5 space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <GroupIcon className="size-3.5 text-primary" /> {group.title}
                      </span>
                      <span className="text-xs font-bold text-muted-foreground">
                        {group.items.length} {group.items.length === 1 ? "conta" : "contas"}
                      </span>
                    </div>

                    {group.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground/70 italic py-2">Sem contas neste grupo</p>
                    ) : (
                      <div className="space-y-2">
                        {group.items.map((acc) => (
                          <div
                            key={acc.id}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-border/70 bg-background shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className="size-3 rounded-full shrink-0"
                                style={{ backgroundColor: acc.color }}
                              />
                              <span className="text-[13px] font-extrabold truncate">{acc.name}</span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[13px] font-black text-foreground tabular-nums">
                                {money(acc.balance, acc.currency)}
                              </span>
                              <button
                                onClick={() => {
                                  setEditingAccount(acc);
                                  setAccountDialogOpen(true);
                                }}
                                className="text-muted-foreground hover:text-foreground p-1 transition"
                                title="Editar conta"
                              >
                                <Pencil className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3. DESPESAS FIXAS (MENSAS E RECORRENTES) ── */}
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                <Repeat className="size-4 text-primary" /> Despesas Fixas (Mensais)
              </h2>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Compromissos permanentes gerados automaticamente a cada mês
              </p>
            </div>

            <Button
              onClick={() => {
                setEditingFixedExpense(null);
                setFixedDialogOpen(true);
              }}
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-xs font-extrabold rounded-xl border-border bg-background hover:bg-muted"
            >
              <Plus className="size-3.5" /> Adicionar despesa fixa
            </Button>
          </div>

          {fixedExpenses.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground space-y-1">
              <p className="text-xs italic">Nenhuma despesa fixa cadastrada.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-background">
              {fixedExpenses.map((fixed) => {
                const occurrence = currentMonthExpenses.find(
                  (e) => e.fixedExpenseId === fixed.id
                );
                const preferredAcc = accounts.find((a) => a.id === fixed.preferredAccountId);

                return (
                  <div
                    key={fixed.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 transition-colors",
                      fixed.paused ? "bg-muted/20 opacity-75" : "hover:bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center justify-center rounded-lg bg-muted px-2.5 py-1 text-[11px] font-black text-foreground shrink-0 w-12">
                        Dia {String(fixed.dueDay).padStart(2, "0")}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[13.5px] font-extrabold text-foreground">
                            {fixed.name}
                          </span>
                          {fixed.paused && (
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                              Pausada
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          <span>{fixed.category}</span>
                          {preferredAcc && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 font-semibold">
                                <span
                                  className="size-2 rounded-full inline-block"
                                  style={{ backgroundColor: preferredAcc.color }}
                                />
                                {preferredAcc.name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      <span className="text-[14px] font-black text-foreground tabular-nums">
                        {money(fixed.amount, fixed.currency)}
                      </span>

                      {!fixed.paused && (
                        <div>
                          {occurrence?.paid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg">
                              <Check className="size-3" /> Pago no mês
                            </span>
                          ) : occurrence ? (
                            <button
                              onClick={() => handleTogglePaid(occurrence)}
                              className="flex items-center gap-1 text-[11px] font-extrabold text-amber-600 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 px-2.5 py-1 rounded-lg transition"
                            >
                              Pagar este mês
                            </button>
                          ) : null}
                        </div>
                      )}

                      <div className="flex items-center gap-1 border-l border-border/60 pl-2">
                        <button
                          onClick={() => {
                            persistFixedExpenses(
                              fixedExpenses.map((item) =>
                                item.id === fixed.id ? { ...item, paused: !item.paused } : item
                              )
                            );
                            toast.info(
                              fixed.paused
                                ? `Despesa "${fixed.name}" reativada.`
                                : `Despesa "${fixed.name}" pausada.`
                            );
                          }}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                          title={fixed.paused ? "Reativar despesa fixa" : "Pausar despesa fixa"}
                        >
                          {fixed.paused ? (
                            <Play className="size-3.5 text-emerald-600" />
                          ) : (
                            <Pause className="size-3.5 text-amber-600" />
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setEditingFixedExpense(fixed);
                            setFixedDialogOpen(true);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition"
                          title="Editar despesa fixa"
                        >
                          <Pencil className="size-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            persistFixedExpenses(
                              fixedExpenses.filter((item) => item.id !== fixed.id)
                            );
                            toast.success(`Despesa fixa "${fixed.name}" removida.`);
                          }}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted transition"
                          title="Excluir despesa fixa"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── 4. DAILY SPENDING CALENDAR (CALENDÁRIO DE GASTOS DIÁRIOS) ── */}
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div>
              <h2 className="text-sm font-extrabold tracking-tight flex items-center gap-2">
                <CalendarIcon className="size-4 text-primary" /> Calendário de Gastos Diários
              </h2>
              <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">
                Total realizado e compromissos pendentes por dia
              </p>
            </div>

            {selectedCalendarDay && (
              <button
                onClick={() => {
                  setSelectedCalendarDay(null);
                  setDayDetailModalOpen(false);
                }}
                className="text-xs font-bold text-primary hover:underline"
              >
                Limpar seleção (Dia {selectedCalendarDay})
              </button>
            )}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted-foreground uppercase">
            <span>Dom</span>
            <span>Seg</span>
            <span>Ter</span>
            <span>Qua</span>
            <span>Qui</span>
            <span>Sex</span>
            <span>Sáb</span>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-12 rounded-xl bg-muted/10" />;
              }

              const dayExps = currentMonthExpensesByDayMap.get(day) ?? [];
              const paidExps = dayExps.filter((e) => e.paid);
              const pendingExps = dayExps.filter((e) => !e.paid);

              const paidTotal = paidExps.reduce((sum, e) => sum + e.amount, 0);
              const pendingTotal = pendingExps.reduce((sum, e) => sum + e.amount, 0);
              const isSelected = selectedCalendarDay === day;

              return (
                <button
                  key={day}
                  onClick={() => {
                    setSelectedCalendarDay(day);
                    setDayDetailModalOpen(true);
                  }}
                  className={cn(
                    "flex flex-col justify-between h-[54px] p-1.5 rounded-xl border text-left transition-all relative overflow-hidden",
                    isSelected
                      ? "border-primary ring-2 ring-primary/20 bg-primary/10"
                      : dayExps.length > 0
                      ? "border-border bg-background hover:border-primary/40 shadow-2xs"
                      : "border-border/30 bg-surface/40 text-muted-foreground/80 hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center justify-between w-full leading-none">
                    <span className="text-[11px] font-black">{day}</span>
                    {dayExps.length > 0 && (
                      <span className="text-[9px] font-extrabold text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">
                        {dayExps.length}
                      </span>
                    )}
                  </div>

                  <div className="mt-auto space-y-0.5">
                    {paidTotal > 0 ? (
                      <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight truncate">
                        {formatEUR(paidTotal)}
                      </p>
                    ) : pendingTotal > 0 ? (
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 tabular-nums leading-tight truncate">
                        {formatEUR(pendingTotal)}
                      </p>
                    ) : null}

                    {paidTotal > 0 && pendingTotal > 0 && (
                      <p className="text-[8.5px] font-extrabold text-amber-600 dark:text-amber-400 leading-none truncate">
                        +{formatEUR(pendingTotal)} pend.
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 5. PRÓXIMAS DESPESAS ── */}
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                <TrendingUp className="size-4 text-amber-500" /> Próximas despesas pendentes
              </h2>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Contas e compromissos a vencer em ordem cronológica no mês
              </p>
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              {upcomingExpenses.length} pendentes
            </span>
          </div>

          {upcomingExpenses.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground space-y-1">
              <Check className="size-8 text-emerald-500 mx-auto" />
              <p className="text-sm font-bold">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground">Nenhuma despesa pendente para este mês.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-background">
              {upcomingExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="inline-flex items-center justify-center rounded-lg bg-muted px-2.5 py-1 text-[11px] font-extrabold text-foreground shrink-0 w-12">
                      Dia {exp.dueDay}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-extrabold text-foreground truncate">{exp.name}</p>
                      <p className="text-[11.5px] text-muted-foreground truncate">{exp.category}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[14px] font-black text-foreground tabular-nums">
                      {formatEUR(exp.amount)}
                    </span>

                    <button
                      onClick={() => handleTogglePaid(exp)}
                      className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 hover:bg-amber-500/20 transition"
                    >
                      Pendente (Pagar)
                    </button>

                    <button
                      onClick={() => {
                        setEditingExpense(exp);
                        setExpenseDialogOpen(true);
                      }}
                      className="text-muted-foreground hover:text-foreground p-1 transition"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 6. DESPESAS DO MÊS POR CATEGORIA ── */}
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-extrabold tracking-tight flex items-center gap-2">
                <PieChart className="size-4 text-primary" /> Despesas do mês por Categoria
              </h2>
              <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                Distribuição dos gastos cadastrados e compras efetuadas
              </p>
            </div>
            <span className="text-xs font-bold text-primary">{formatEUR(totalPrevisto)}</span>
          </div>

          {expensesByCategory.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              Nenhum gasto registrado este mês.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {expensesByCategory.map(([cat, totalCat]) => {
                const percentage = totalPrevisto > 0 ? (totalCat / totalPrevisto) * 100 : 0;
                return (
                  <div
                    key={cat}
                    className="p-3.5 rounded-xl border border-border/70 bg-background space-y-2"
                  >
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-extrabold text-foreground flex items-center gap-1.5">
                        <Tag className="size-3 text-muted-foreground" /> {cat}
                      </span>
                      <span className="font-black text-primary">{formatEUR(totalCat)}</span>
                    </div>

                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, percentage)}%` }}
                      />
                    </div>

                    <p className="text-[10.5px] font-semibold text-muted-foreground text-right">
                      {percentage.toFixed(1)}% do total
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* MODAL DETALHES DO DIA DO CALENDÁRIO */}
      <DayDetailModal
        open={dayDetailModalOpen}
        day={selectedCalendarDay}
        currentDate={currentDate}
        expenses={currentMonthExpenses}
        accounts={accounts}
        onClose={() => setDayDetailModalOpen(false)}
        onAddExpenseForDay={handleOpenAddExpenseForDay}
        onTogglePaid={handleTogglePaid}
        onEditExpense={(exp) => {
          setEditingExpense(exp);
          setExpenseDialogOpen(true);
        }}
        onDeleteExpense={handleDeleteExpense}
      />

      {/* MODAL DESPESA FIXA */}
      <FixedExpenseDialog
        open={fixedDialogOpen}
        editing={editingFixedExpense}
        categories={categories}
        accounts={accounts}
        onClose={() => setFixedDialogOpen(false)}
        onSave={handleSaveFixedExpense}
      />

      {/* MODAL NOVA/EDITAR DESPESA MANUAL */}
      <ExpenseDialog
        open={expenseDialogOpen}
        editing={editingExpense}
        categories={categories}
        accounts={accounts}
        defaultDueDay={presetDayForNewExpense?.dueDay}
        defaultDate={presetDayForNewExpense?.date}
        onClose={() => setExpenseDialogOpen(false)}
        onSave={handleSaveExpense}
        onNewCategory={(name) => {
          const next = [...categories, name];
          setCategories(next);
          localStorage.setItem(CATEGORY_KEY, JSON.stringify(next));
        }}
      />

      {/* MODAL EDITAR CONTA */}
      <AccountDialog
        open={accountDialogOpen}
        editing={editingAccount}
        onClose={() => setAccountDialogOpen(false)}
        onSave={(account) => {
          persistAccounts(
            editingAccount && accounts.some((item) => item.id === editingAccount.id)
              ? accounts.map((item) => (item.id === account.id ? account : item))
              : [...accounts, account]
          );
          setAccountDialogOpen(false);
        }}
        {...(editingAccount
          ? {
              onDelete: () => {
                persistAccounts(accounts.filter((item) => item.id !== editingAccount.id));
                setAccountDialogOpen(false);
              },
            }
          : {})}
      />

      {/* MODAL TRANSFERÊNCIA */}
      <TransferDialog
        open={transferDialogOpen}
        accounts={accounts}
        onClose={() => setTransferDialogOpen(false)}
        onTransfer={(from, to, amount) => {
          persistAccounts(
            accounts.map((account) =>
              account.id === from
                ? { ...account, balance: account.balance - amount }
                : account.id === to
                ? { ...account, balance: account.balance + amount }
                : account
            )
          );
          setTransferDialogOpen(false);
          toast.success("Transferência realizada.");
        }}
      />

      {/* MODAL MOVIMENTAÇÃO */}
      <MovementDialog
        open={movementDialogOpen}
        accounts={accounts}
        onClose={() => setMovementDialogOpen(false)}
        onSave={(movement) => {
          persistAccounts(
            accounts.map((account) =>
              account.id === movement.accountId
                ? {
                    ...account,
                    balance:
                      account.balance +
                      (movement.type === "entrada" ? movement.amount : -movement.amount),
                  }
                : account
            )
          );
          persistMovements([movement, ...movements]);
          setMovementDialogOpen(false);
          toast.success("Movimentação salva.");
        }}
      />

      {/* MODAL SELEÇÃO DE CONTA PARA PAGAR DESPESA */}
      {payAccountModalOpen && expenseToPay && (
        <PayAccountModal
          expense={expenseToPay}
          accounts={accounts}
          onClose={() => setPayAccountModalOpen(false)}
          onConfirm={handleConfirmPayExpense}
        />
      )}
    </AppLayout>
  );
}

function DayDetailModal({
  open,
  day,
  currentDate,
  expenses,
  accounts,
  onClose,
  onAddExpenseForDay,
  onTogglePaid,
  onEditExpense,
  onDeleteExpense,
}: {
  open: boolean;
  day: number | null;
  currentDate: Date;
  expenses: Expense[];
  accounts: Account[];
  onClose: () => void;
  onAddExpenseForDay: (day: number) => void;
  onTogglePaid: (expense: Expense) => void;
  onEditExpense: (expense: Expense) => void;
  onDeleteExpense: (expense: Expense) => void;
}) {
  if (!day) return null;

  const monthStr = String(currentDate.getMonth() + 1).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  const dateStr = `${currentDate.getFullYear()}-${monthStr}-${dayStr}`;

  const formattedDate = new Intl.DateTimeFormat("pt-PT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));

  const dayExps = expenses.filter((e) => e.dueDay === day || e.date === dateStr);
  const paidExps = dayExps.filter((e) => e.paid);
  const pendingExps = dayExps.filter((e) => !e.paid);

  const spentTotal = paidExps.reduce((sum, e) => sum + e.amount, 0);
  const pendingTotal = pendingExps.reduce((sum, e) => sum + e.amount, 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold capitalize flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary" /> {formattedDate}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Banner de Totais do Dia */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-0.5">
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Gasto no dia
              </p>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">
                {formatEUR(spentTotal)}
              </p>
              <p className="text-[10px] font-semibold text-emerald-600/80">
                {paidExps.length} {paidExps.length === 1 ? "lançamento pago" : "lançamentos pagos"}
              </p>
            </div>

            <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-0.5">
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Pendente no dia
              </p>
              <p className="text-xl font-black text-amber-700 dark:text-amber-300">
                {formatEUR(pendingTotal)}
              </p>
              <p className="text-[10px] font-semibold text-amber-600/80">
                {pendingExps.length} {pendingExps.length === 1 ? "pendência" : "pendências"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Lançamentos ({dayExps.length})
            </span>
            <Button
              onClick={() => onAddExpenseForDay(day)}
              size="sm"
              className="h-8 text-xs font-extrabold rounded-lg gap-1"
            >
              <Plus className="size-3.5" /> Nova despesa
            </Button>
          </div>

          {dayExps.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground space-y-1">
              <p className="text-xs italic">Nenhuma despesa registrada para este dia.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {dayExps.map((exp) => {
                const account = accounts.find((a) => a.id === exp.accountId);
                return (
                  <div
                    key={exp.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/70 bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span
                        className={cn(
                          "size-2.5 rounded-full shrink-0",
                          exp.paid ? "bg-emerald-500" : "bg-amber-500 animate-pulse"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-extrabold text-foreground truncate">{exp.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 flex-wrap">
                          <span>{exp.category}</span>
                          {account && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-foreground/80">{account.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-xs font-black tabular-nums",
                          exp.paid ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                        )}
                      >
                        {formatEUR(exp.amount)}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition">
                            <MoreVertical className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onTogglePaid(exp)}>
                            {exp.paid ? (
                              <>
                                <Clock className="size-3.5 mr-2 text-amber-500" /> Marcar pendente
                              </>
                            ) : (
                              <>
                                <Check className="size-3.5 mr-2 text-emerald-500" /> Marcar pago
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditExpense(exp)}>
                            <Pencil className="size-3.5 mr-2" /> Editar despesa
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteExpense(exp)}
                            className="text-destructive font-semibold"
                          >
                            <Trash2 className="size-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FixedExpenseDialog({
  open,
  editing,
  categories,
  accounts,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: FixedExpense | null;
  categories: string[];
  accounts: Account[];
  onClose: () => void;
  onSave: (fixed: FixedExpense) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [dueDay, setDueDay] = useState("5");
  const [category, setCategory] = useState(categories[0] ?? "Casa");
  const [preferredAccountId, setPreferredAccountId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setCurrency(editing?.currency ?? "EUR");
    setDueDay(String(editing?.dueDay ?? 5));
    setCategory(editing?.category ?? categories[0] ?? "Casa");
    setPreferredAccountId(editing?.preferredAccountId ?? "none");
    setNotes(editing?.notes ?? "");
  }, [open, editing, categories]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar despesa fixa" : "Adicionar despesa fixa"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              id: editing?.id ?? crypto.randomUUID(),
              name: name.trim(),
              amount: parseFlexibleNumber(amount),
              currency,
              dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1)),
              category,
              preferredAccountId: preferredAccountId === "none" ? undefined : preferredAccountId,
              paused: editing?.paused ?? false,
              notes: notes.trim() || undefined,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label>Nome da despesa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aluguel, Telefone, Academia..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Moeda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">Euro · €</SelectItem>
                  <SelectItem value="USD">Dólar · $</SelectItem>
                  <SelectItem value="BRL">Real · R$</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dia do vencimento (1-31)</Label>
              <Input
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Conta preferencial (opcional)</Label>
            <Select value={preferredAccountId} onValueChange={setPreferredAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma conta preferencial</SelectItem>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} ({acc.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Observações (opcional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Contrato de aluguel"
            />
          </div>

          <Button type="submit" className="w-full">
            {editing ? "Salvar alterações" : "Adicionar despesa fixa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountDialog({
  open,
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  editing: Account | null;
  onClose: () => void;
  onSave: (account: Account) => void;
  onDelete?: () => void;
}) {
  const palette = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#dc2626",
    "#ea580c",
    "#16a34a",
    "#0d9488",
    "#334155",
  ];
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [kind, setKind] = useState<AccountKind>("banco");
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [color, setColor] = useState("#2563eb");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setBalance(String(editing?.balance ?? 0));
    setKind(editing?.kind ?? "banco");
    setCurrency(editing?.currency ?? "EUR");
    setColor(editing?.color ?? "#2563eb");
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar conta" : "Adicionar conta"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              id: editing?.id ?? crypto.randomUUID(),
              name: name.trim(),
              balance: parseFlexibleNumber(balance),
              kind,
              currency,
              color,
            });
          }}
        >
          <div className="space-y-1.5">
            <Label>Nome da conta</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Wise, Nomad, Santander..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={kind}
                onValueChange={(value) => {
                  const next = value as AccountKind;
                  setKind(next);
                  if (next === "corretora" && !editing) setCurrency("USD");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banco">Banco Físico</SelectItem>
                  <SelectItem value="digital">Conta Digital (Wise / Nomad)</SelectItem>
                  <SelectItem value="corretora">Mesa / Corretora</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Moeda da conta</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">Euro · €</SelectItem>
                  <SelectItem value="USD">Dólar · $</SelectItem>
                  <SelectItem value="BRL">Real · R$</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Saldo atual em {currency}</Label>
            <Input
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div className="space-y-2">
            <Label>Cor de identificação</Label>
            <div className="flex items-center gap-2">
              {palette.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setColor(item)}
                  style={{ backgroundColor: item }}
                  className={cn(
                    "size-8 rounded-full border-2 border-white shadow-sm transition",
                    color === item && "scale-110 ring-2 ring-foreground ring-offset-2"
                  )}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            {onDelete && (
              <Button type="button" variant="outline" className="text-destructive" onClick={onDelete}>
                <Trash2 className="size-4 mr-1" /> Excluir
              </Button>
            )}
            <Button className="flex-1">Salvar conta</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog({
  open,
  accounts,
  onClose,
  onTransfer,
}: {
  open: boolean;
  accounts: Account[];
  onClose: () => void;
  onTransfer: (from: string, to: string, amount: number) => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (!open) return;
    setFrom(accounts[0]?.id ?? "");
    setTo(accounts[1]?.id ?? "");
    setAmount("");
  }, [open, accounts]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir entre contas</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const value = parseFlexibleNumber(amount);
            if (from !== to && value > 0) onTransfer(from, to, value);
          }}
        >
          <div className="space-y-1.5">
            <Label>Da conta</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} · {money(account.balance, account.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Para a conta</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts
                  .filter((account) => account.id !== from)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>
          <Button className="w-full">
            <ArrowRightLeft className="size-4 mr-2" /> Confirmar transferência
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({
  open,
  accounts,
  onClose,
  onSave,
}: {
  open: boolean;
  accounts: Account[];
  onClose: () => void;
  onSave: (movement: Movement) => void;
}) {
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState<"entrada" | "saida">("entrada");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setAccountId(accounts[0]?.id ?? "");
    setType("entrada");
    setAmount("");
    setDescription("");
  }, [open, accounts]);

  const account = accounts.find((item) => item.id === accountId);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova movimentação</DialogTitle>
        </DialogHeader>
        {accounts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-bold">Cadastre uma conta primeiro</p>
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const value = parseFlexibleNumber(amount);
              if (value > 0 && accountId)
                onSave({
                  id: crypto.randomUUID(),
                  accountId,
                  type,
                  amount: value,
                  description: description.trim(),
                  date: new Date().toISOString(),
                });
            }}
          >
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
              <button
                type="button"
                onClick={() => setType("entrada")}
                className={cn(
                  "h-10 rounded-lg text-xs font-bold transition",
                  type === "entrada" && "bg-emerald-500 text-white shadow-sm"
                )}
              >
                + Entrada
              </button>
              <button
                type="button"
                onClick={() => setType("saida")}
                className={cn(
                  "h-10 rounded-lg text-xs font-bold transition",
                  type === "saida" && "bg-destructive text-white shadow-sm"
                )}
              >
                − Saída
              </button>
            </div>
            <div className="space-y-1.5">
              <Label>Conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} · {money(item.balance, item.currency)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor {account ? `em ${account.currency}` : ""}</Label>
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={type === "entrada" ? "Ex: Salário / Depósito" : "Ex: Compra avulsa"}
              />
            </div>
            <Button className="w-full">
              {type === "entrada" ? "Registrar entrada" : "Registrar saída"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({
  open,
  editing,
  categories,
  accounts,
  defaultDueDay,
  defaultDate,
  onClose,
  onSave,
  onNewCategory,
}: {
  open: boolean;
  editing: Expense | null;
  categories: string[];
  accounts: Account[];
  defaultDueDay?: number;
  defaultDate?: string;
  onClose: () => void;
  onSave: (expense: Expense, deductBalanceNow?: boolean, sourceAccountId?: string) => void;
  onNewCategory: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Outros");
  const [dueDay, setDueDay] = useState("1");
  const [date, setDate] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("mensal");
  const [newCategory, setNewCategory] = useState("");
  const [paidNow, setPaidNow] = useState(false);
  const [sourceAccountId, setSourceAccountId] = useState(accounts[0]?.id ?? "");

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setAmount(editing ? String(editing.amount) : "");
    setCategory(editing?.category ?? categories[0] ?? "Outros");
    setDueDay(String(editing?.dueDay ?? defaultDueDay ?? new Date().getDate()));
    setDate(editing?.date ?? defaultDate ?? "");
    setFrequency(editing?.frequency ?? "mensal");
    setNewCategory("");
    setPaidNow(editing?.paid ?? false);
    setSourceAccountId(editing?.accountId ?? accounts[0]?.id ?? "");
  }, [open, editing, categories, accounts, defaultDueDay, defaultDate]);

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar despesa" : "Nova despesa manual"}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            let finalCategory = category;
            if (category === "__new__") {
              finalCategory = newCategory.trim() || "Outros";
              onNewCategory(finalCategory);
            }
            onSave(
              {
                id: editing?.id ?? crypto.randomUUID(),
                name: name.trim(),
                amount: parseFlexibleNumber(amount),
                category: finalCategory,
                dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1)),
                date: date.trim() || undefined,
                frequency,
                paid: paidNow,
                ...(paidNow ? { accountId: sourceAccountId } : {}),
              },
              paidNow && !editing,
              sourceAccountId
            );
          }}
        >
          <div className="space-y-1.5">
            <Label>Descrição da despesa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Aluguel, Restaurante, Táxi..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor (€)</Label>
              <Input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Dia do vencimento</Label>
              <Input
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
              />
            </div>
          </div>

          {date && (
            <div className="space-y-1.5">
              <Label>Data específica</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">+ Nova categoria</SelectItem>
              </SelectContent>
            </Select>
            {category === "__new__" && (
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Nome da categoria"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Frequência</Label>
            <Select value={frequency} onValueChange={(value) => setFrequency(value as Frequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mensal">Todo mês</SelectItem>
                <SelectItem value="anual">Todo ano</SelectItem>
                <SelectItem value="unica">Uma vez / Avulsa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2 border-t border-border/60">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="paidNow"
                checked={paidNow}
                onChange={(e) => setPaidNow(e.target.checked)}
                className="size-4 rounded border-border text-primary focus:ring-primary"
              />
              <Label htmlFor="paidNow" className="cursor-pointer font-bold">
                Esta despesa já foi paga?
              </Label>
            </div>

            {paidNow && (
              <div className="space-y-1.5 animate-in fade-in duration-150">
                <Label>Conta utilizada para pagamento</Label>
                <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} · {money(acc.balance, acc.currency)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button type="submit" className="w-full">
            {editing ? "Salvar alterações" : "Cadastrar despesa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayAccountModal({
  expense,
  accounts,
  onClose,
  onConfirm,
}: {
  expense: Expense;
  accounts: Account[];
  onClose: () => void;
  onConfirm: (accountId: string, amount: number, paymentDate?: string) => void;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(
    expense.accountId && accounts.some((a) => a.id === expense.accountId)
      ? expense.accountId
      : accounts[0]?.id ?? ""
  );
  const [paidAmount, setPaidAmount] = useState(String(expense.amount));
  const [paymentDate, setPaymentDate] = useState(
    expense.date || new Date().toISOString().split("T")[0]
  );

  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0]?.id ?? "");
    }
  }, [accounts, selectedAccountId]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-muted/40 space-y-1">
            <p className="text-xs font-bold text-muted-foreground uppercase">Despesa</p>
            <p className="text-sm font-extrabold text-foreground">{expense.name}</p>
            <p className="text-xs font-semibold text-primary">{formatEUR(expense.amount)}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Conta debitada</Label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name} · {money(acc.balance, acc.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valor pago (€)</Label>
              <Input
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Data do pagamento</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              disabled={!selectedAccountId}
              onClick={() => {
                const amt = Number(paidAmount.replace(",", ".")) || expense.amount;
                onConfirm(selectedAccountId, amt, paymentDate);
              }}
            >
              Confirmar Pagamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
