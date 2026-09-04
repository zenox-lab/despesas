import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, BarChart3, Building2, CalendarDays, Check, CreditCard, Home, Landmark, Pencil, Plus, ReceiptText, TrendingUp, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatEUR } from "@/lib/shopping";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/despesas")({ component: Expenses });

type Frequency = "mensal" | "anual" | "unica";
type Expense = { id: string; name: string; amount: number; category: string; dueDay: number; frequency: Frequency; paid: boolean };

const KEY = "minha-lista:expenses";
const CATEGORY_KEY = "minha-lista:expense-categories";
const ACCOUNT_KEY = "minha-lista:accounts";
const MOVEMENT_KEY = "minha-lista:movements";
const FX_KEY = "minha-lista:eur-rates";
type AccountKind = "banco" | "digital" | "corretora" | "dinheiro";
type Currency = "EUR" | "USD" | "BRL";
type Account = { id: string; name: string; balance: number; kind: AccountKind; currency: Currency; color: string };
type Movement = { id: string; accountId: string; type: "entrada" | "saida"; amount: number; description: string; date: string };
type FxRates = { USD: number; BRL: number; date: string };
const PRESET_ACCOUNTS: Account[] = [
  { id: "preset-santander", name: "Santander", balance: 0, kind: "banco", currency: "EUR", color: "#ec0000" },
  { id: "preset-wise", name: "Wise", balance: 0, kind: "digital", currency: "EUR", color: "#9fe870" },
  { id: "preset-nomad", name: "Nomad", balance: 0, kind: "digital", currency: "USD", color: "#111111" },
  { id: "preset-bbva", name: "BBVA", balance: 0, kind: "banco", currency: "EUR", color: "#001391" },
  { id: "preset-apex", name: "Apex Trader Funding", balance: 0, kind: "corretora", currency: "USD", color: "#2563eb" },
  { id: "preset-btg", name: "BTG Pactual", balance: 0, kind: "banco", currency: "BRL", color: "#001e62" },
  { id: "preset-c6", name: "C6 Bank", balance: 0, kind: "banco", currency: "BRL", color: "#242424" },
];
const DEFAULT_CATEGORIES = ["Moradia", "Telefone e internet", "Assinaturas", "Saúde", "Transporte", "Outros"];
const seed: Expense[] = [
  { id: "rent", name: "Aluguel", amount: 0, category: "Moradia", dueDay: 5, frequency: "mensal", paid: false },
  { id: "phone", name: "Telefone", amount: 0, category: "Telefone e internet", dueDay: 10, frequency: "mensal", paid: false },
];

function load<T>(key: string, fallback: T): T { try { return JSON.parse(localStorage.getItem(key) ?? "") as T; } catch { return fallback; } }

function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [fxRates, setFxRates] = useState<FxRates>({ USD: 1.17, BRL: 6.3, date: "" });
  const [month] = useState(() => new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(new Date()));

  useEffect(() => {
    setExpenses(load(KEY, seed));
    setCategories(load(CATEGORY_KEY, DEFAULT_CATEGORIES));
    setMovements(load(MOVEMENT_KEY, []));
    const stored = load<Partial<Account>[]>(ACCOUNT_KEY, []).map((account) => ({ id: account.id ?? crypto.randomUUID(), name: account.name ?? "Conta", balance: account.balance ?? 0, kind: account.kind ?? "banco", currency: account.currency ?? "EUR", color: account.color ?? "#2563eb" }));
    const aliases: Record<string, string[]> = {
      Santander: ["santander"], Wise: ["wise"], Nomad: ["nomad"], BBVA: ["bbva"],
      "Apex Trader Funding": ["apex trader funding", "apex", "eps"],
      "BTG Pactual": ["btg pactual", "btg"],
      "C6 Bank": ["c6 bank", "c6"],
    };
    const merged = PRESET_ACCOUNTS.map((preset) => {
      const existing = stored.find((account) => aliases[preset.name]?.includes(account.name.toLocaleLowerCase("pt")));
      const previousDefaults = ["#ec0000", "#65a30d", "#161616", "#1464a5", "#2563eb", "#075985"];
      return existing ? { ...existing, name: preset.name, color: previousDefaults.includes(existing.color) ? preset.color : existing.color } : preset;
    });
    setAccounts(merged);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(merged));
  }, []);
  useEffect(() => {
    const cached = load<FxRates | null>(FX_KEY, null);
    if (cached?.USD && cached?.BRL) setFxRates(cached);
    fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,BRL")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data: { date: string; rates: { USD: number; BRL: number } }) => {
        if (!data.rates?.USD || !data.rates?.BRL) return;
        const next = { USD: data.rates.USD, BRL: data.rates.BRL, date: data.date };
        setFxRates(next);
        localStorage.setItem(FX_KEY, JSON.stringify(next));
      })
      .catch(() => undefined);
  }, []);
  const persist = (next: Expense[]) => { setExpenses(next); localStorage.setItem(KEY, JSON.stringify(next)); };
  const persistAccounts = (next: Account[]) => { setAccounts(next); localStorage.setItem(ACCOUNT_KEY, JSON.stringify(next)); };
  const persistMovements = (next: Movement[]) => { setMovements(next); localStorage.setItem(MOVEMENT_KEY, JSON.stringify(next)); };
  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount, 0), [expenses]);
  const paid = useMemo(() => expenses.filter((expense) => expense.paid).reduce((sum, expense) => sum + expense.amount, 0), [expenses]);
  const remaining = total - paid;
  const spendingByCategory = useMemo(() => {
    const grouped = expenses.filter((expense) => expense.paid).reduce<Record<string, number>>((result, expense) => ({ ...result, [expense.category]: (result[expense.category] ?? 0) + expense.amount }), {});
    return Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  }, [expenses]);
  const bankTotal = useMemo(() => accounts.reduce((sum, account) => {
    if (account.currency === "EUR") return sum + account.balance;
    return sum + account.balance / fxRates[account.currency];
  }, 0), [accounts, fxRates]);

  const togglePaid = (expense: Expense) => {
    const willPay = !expense.paid;
    persist(expenses.map((item) => item.id === expense.id ? { ...item, paid: willPay } : item));
    const paymentAccount = accounts.find((account) => account.currency === "EUR" && account.kind !== "corretora") ?? accounts[0];
    if (paymentAccount) persistAccounts(accounts.map((account) => account.id === paymentAccount.id ? { ...account, balance: account.balance + (willPay ? -expense.amount : expense.amount) } : account));
  };

  const openNew = () => { setEditing(null); setOpen(true); };
  const save = (expense: Expense) => { persist(editing ? expenses.map((item) => item.id === expense.id ? expense : item) : [...expenses, expense]); setOpen(false); };

  return (
    <div className="min-h-screen bg-background pb-28">
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <nav className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-2xl border border-border bg-surface p-1 shadow-sm">
            <Link to="/" className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground"><Home className="size-4" /> Compras</Link>
            <span className="flex items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-background"><ReceiptText className="size-4" /> Finanças</span>
          </div>
          <Button onClick={openNew} className="h-11 rounded-2xl"><Plus className="size-4" /> <span className="hidden sm:inline">Nova despesa</span></Button>
        </nav>

        <header>
          <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">Meu mês</p>
          <h1 className="mt-1 text-2xl font-extrabold capitalize sm:text-3xl">Despesas de {month}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Contas fixas, assinaturas e tudo que precisa sair este mês.</p>
        </header>

        <section className="space-y-3">
          <div className="flex items-end justify-between px-1"><div><p className="text-[10px] font-bold tracking-wider text-primary uppercase">Minha carteira</p><h2 className="text-xl font-extrabold">{formatEUR(bankTotal)}</h2><p className="mt-0.5 text-[10px] text-muted-foreground">Todas as contas convertidas para euro{fxRates.date ? ` · cotação de ${new Intl.DateTimeFormat("pt-BR").format(new Date(`${fxRates.date}T12:00:00`))}` : ""}</p></div><button onClick={() => setTransferOpen(true)} disabled={accounts.length < 2} className="flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-bold disabled:opacity-40"><ArrowRightLeft className="size-3.5" /> Transferir</button></div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:px-0 lg:grid-cols-3">
            {accounts.map((account) => <AccountCard key={account.id} account={account} onEdit={() => { setEditingAccount(account); setAccountOpen(true); }} />)}
            <button onClick={() => { setEditingAccount(null); setAccountOpen(true); }} className="flex min-h-24 min-w-[62vw] snap-center flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 text-muted-foreground sm:min-w-0"><Plus className="size-4" /><span className="mt-1.5 text-[11px] font-bold">Adicionar conta</span></button>
          </div>
          <button onClick={() => setMovementOpen(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-bold text-primary-foreground"><TrendingUp className="size-4" /> Nova movimentação</button>
        </section>

        {movements.length > 0 && <section className="space-y-2"><div className="flex items-end justify-between px-1"><div><h2 className="text-base font-extrabold">Movimentações recentes</h2><p className="text-[11px] text-muted-foreground">Entradas e saídas registradas manualmente</p></div></div>{movements.slice(0, 5).map((movement) => { const account = accounts.find((item) => item.id === movement.accountId); return <div key={movement.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"><span className={cn("grid size-8 place-items-center rounded-lg text-sm font-bold", movement.type === "entrada" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{movement.type === "entrada" ? "+" : "−"}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{movement.description || (movement.type === "entrada" ? "Entrada" : "Saída")}</p><p className="text-[10px] text-muted-foreground">{account?.name ?? "Conta removida"}</p></div><p className={cn("text-xs font-extrabold", movement.type === "entrada" ? "text-success" : "text-destructive")}>{movement.type === "entrada" ? "+" : "−"}{money(movement.amount, account?.currency ?? "EUR")}</p><Button variant="ghost" size="icon" className="size-7" onClick={() => { if (account) persistAccounts(accounts.map((item) => item.id === account.id ? { ...item, balance: item.balance + (movement.type === "entrada" ? -movement.amount : movement.amount) } : item)); persistMovements(movements.filter((item) => item.id !== movement.id)); }}><Trash2 className="size-3.5" /></Button></div>; })}</section>}

        <section className="grid gap-3 sm:grid-cols-3">
          <Summary label="Previsto no mês" value={total} icon={<CalendarDays className="size-5" />} />
          <Summary label="Já foi pago" value={paid} accent="success" icon={<Check className="size-5" />} />
          <Summary label="Ainda falta" value={remaining} accent="primary" icon={<CreditCard className="size-5" />} />
        </section>

        {spendingByCategory.length > 0 && <section className="rounded-2xl border border-border bg-surface p-4"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold tracking-wider text-primary uppercase">Gastos do mês</p><h2 className="mt-0.5 text-sm font-extrabold">Por categoria</h2></div><BarChart3 className="size-4 text-muted-foreground" /></div><div className="mt-4 space-y-3">{spendingByCategory.slice(0, 5).map(([category, amount]) => <div key={category}><div className="mb-1 flex items-center justify-between text-[11px]"><span className="font-bold">{category}</span><span className="font-extrabold">{formatEUR(amount)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (amount / spendingByCategory[0]![1]) * 100)}%` }} /></div></div>)}</div></section>}

        <section className="space-y-3">
          <div className="flex items-end justify-between"><div><h2 className="text-lg font-extrabold">Contas e compromissos</h2><p className="text-xs text-muted-foreground">{expenses.length} itens cadastrados</p></div><Button variant="outline" size="sm" onClick={openNew}><Plus className="size-4" /> Adicionar</Button></div>
          {expenses.length === 0 ? (
            <div className="card-soft p-10 text-center"><ReceiptText className="mx-auto size-8 text-muted-foreground" /><p className="mt-3 text-sm font-bold">Nenhuma despesa cadastrada</p><p className="mt-1 text-xs text-muted-foreground">Comece pelo aluguel, telefone ou alguma assinatura.</p></div>
          ) : expenses.slice().sort((a,b) => a.dueDay - b.dueDay).map((expense) => (
            <article key={expense.id} className={cn("card-soft group flex items-center gap-3 p-4 transition", expense.paid && "opacity-60")}>
              <button onClick={() => togglePaid(expense)} className={cn("grid size-10 shrink-0 place-items-center rounded-xl border", expense.paid ? "border-success bg-success text-white" : "border-border bg-muted text-muted-foreground")} aria-label="Alternar pagamento">{expense.paid ? <Check className="size-5" /> : expense.dueDay}</button>
              <div className="min-w-0 flex-1"><p className={cn("truncate text-sm font-bold", expense.paid && "line-through")}>{expense.name}</p><p className="mt-0.5 text-xs text-muted-foreground">{expense.category} · dia {expense.dueDay} · {expense.frequency}</p></div>
              <p className="text-sm font-extrabold">{formatEUR(expense.amount)}</p>
              <div className="flex"><Button size="icon" variant="ghost" onClick={() => { setEditing(expense); setOpen(true); }}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" className="hover:text-destructive" onClick={() => persist(expenses.filter((item) => item.id !== expense.id))}><Trash2 className="size-4" /></Button></div>
            </article>
          ))}
        </section>
      </main>
      <ExpenseDialog open={open} editing={editing} categories={categories} onClose={() => setOpen(false)} onSave={save} onNewCategory={(name) => { const next = [...categories, name]; setCategories(next); localStorage.setItem(CATEGORY_KEY, JSON.stringify(next)); }} />
      <AccountDialog open={accountOpen} editing={editingAccount} onClose={() => setAccountOpen(false)} onSave={(account) => { persistAccounts(editingAccount && accounts.some((item) => item.id === editingAccount.id) ? accounts.map((item) => item.id === account.id ? account : item) : [...accounts, account]); setAccountOpen(false); }} {...(editingAccount ? { onDelete: () => { persistAccounts(accounts.filter((item) => item.id !== editingAccount.id)); setAccountOpen(false); } } : {})} />
      <TransferDialog open={transferOpen} accounts={accounts} onClose={() => setTransferOpen(false)} onTransfer={(from, to, amount) => { persistAccounts(accounts.map((account) => account.id === from ? { ...account, balance: account.balance - amount } : account.id === to ? { ...account, balance: account.balance + amount } : account)); setTransferOpen(false); }} />
      <MovementDialog open={movementOpen} accounts={accounts} onClose={() => setMovementOpen(false)} onSave={(movement) => { persistAccounts(accounts.map((account) => account.id === movement.accountId ? { ...account, balance: account.balance + (movement.type === "entrada" ? movement.amount : -movement.amount) } : account)); persistMovements([movement, ...movements]); setMovementOpen(false); }} />
    </div>
  );
}

function Summary({ label, value, icon, accent = "neutral" }: { label: string; value: number; icon: React.ReactNode; accent?: "neutral" | "primary" | "success" }) {
  return <div className={cn("card-soft p-4", accent === "primary" && "border-primary/30 bg-primary/5", accent === "success" && "border-success/30 bg-success/5")}><div className="mb-5 flex items-center justify-between text-muted-foreground"><span className="text-[10px] font-bold tracking-wider uppercase">{label}</span>{icon}</div><p className="text-2xl font-extrabold">{formatEUR(value)}</p></div>;
}

function money(value: number, currency: Currency) {
  const symbol = { EUR: "€", USD: "$", BRL: "R$" }[currency];
  return `${symbol}${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)}`;
}

function AccountCard({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const Icon = account.kind === "corretora" ? TrendingUp : account.kind === "dinheiro" ? Wallet : account.kind === "digital" ? CreditCard : Landmark;
  const label = { banco: "Conta bancária", digital: "Conta internacional", corretora: "Corretora", dinheiro: "Dinheiro" }[account.kind];
  return <button onClick={onEdit} style={{ background: `linear-gradient(165deg, ${account.color} 0%, color-mix(in oklch, ${account.color} 30%, #101828) 100%)` }} className="relative min-h-24 min-w-[62vw] snap-center overflow-hidden rounded-2xl p-3.5 text-left text-white shadow-md sm:min-w-0"><div className="absolute inset-x-0 top-0 h-px bg-white/45" /><div className="flex items-start justify-between"><div><p className="text-[9px] font-bold tracking-wider text-white/65 uppercase [text-shadow:0_1px_2px_rgb(0_0_0/.25)]">{label}</p><p className="mt-0.5 text-xs font-bold [text-shadow:0_1px_2px_rgb(0_0_0/.25)]">{account.name}</p></div><Icon className="size-4 text-white/80" /></div><p className="absolute bottom-3.5 left-3.5 text-base font-extrabold [text-shadow:0_1px_2px_rgb(0_0_0/.3)]">{money(account.balance, account.currency)}</p><Pencil className="absolute right-3.5 bottom-3.5 size-3 text-white/55" /></button>;
}

function AccountDialog({ open, editing, onClose, onSave, onDelete }: { open: boolean; editing: Account | null; onClose: () => void; onSave: (account: Account) => void; onDelete?: () => void }) {
  const palette = ["#2563eb", "#7c3aed", "#db2777", "#dc2626", "#ea580c", "#16a34a", "#0d9488", "#334155"];
  const [name, setName] = useState(""); const [balance, setBalance] = useState(""); const [kind, setKind] = useState<AccountKind>("banco"); const [currency, setCurrency] = useState<Currency>("EUR"); const [color, setColor] = useState("#2563eb");
  useEffect(() => { if (!open) return; setName(editing?.name ?? ""); setBalance(String(editing?.balance ?? 0)); setKind(editing?.kind ?? "banco"); setCurrency(editing?.currency ?? "EUR"); setColor(editing?.color ?? "#2563eb"); }, [open, editing]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editing ? "Editar conta" : "Adicionar conta"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onSave({ id: editing?.id ?? crypto.randomUUID(), name: name.trim(), balance: Number(balance.replace(",", ".")) || 0, kind, currency, color }); }}><div className="space-y-1.5"><Label>Nome da conta</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Wise, Nomad, banco ou Apex/IPS" required /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Tipo</Label><Select value={kind} onValueChange={(value) => { const next = value as AccountKind; setKind(next); if (next === "corretora" && !editing) setCurrency("USD"); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="banco">Banco</SelectItem><SelectItem value="digital">Wise / Nomad</SelectItem><SelectItem value="corretora">Apex / IPS / Corretora</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem></SelectContent></Select></div><div className="space-y-1.5"><Label>Moeda da conta</Label><Select value={currency} onValueChange={(value) => setCurrency(value as Currency)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="EUR">Euro · €</SelectItem><SelectItem value="USD">Dólar · $</SelectItem><SelectItem value="BRL">Real · R$</SelectItem></SelectContent></Select></div></div><div className="space-y-1.5"><Label>Saldo atual em {currency}</Label><Input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" /></div><div className="space-y-2"><Label>Cor do cartão</Label><div className="flex items-center gap-2">{palette.map((item) => <button key={item} type="button" onClick={() => setColor(item)} style={{ backgroundColor: item }} className={cn("size-8 rounded-full border-2 border-white shadow-sm transition", color === item && "scale-110 ring-2 ring-foreground ring-offset-2")} aria-label={`Escolher cor ${item}`} />)}<label className="relative grid size-8 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-muted text-[10px] font-bold"><span>+</span><input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" /></label></div><div style={{ background: `linear-gradient(165deg, ${color}, color-mix(in oklch, ${color} 35%, #101828))` }} className="h-12 rounded-xl border border-white/20" /></div><div className="flex gap-2">{onDelete && <Button type="button" variant="outline" className="text-destructive" onClick={onDelete}><Trash2 className="size-4" /> Excluir</Button>}<Button className="flex-1">Salvar conta</Button></div></form></DialogContent></Dialog>;
}

function TransferDialog({ open, accounts, onClose, onTransfer }: { open: boolean; accounts: Account[]; onClose: () => void; onTransfer: (from: string, to: string, amount: number) => void }) {
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [amount, setAmount] = useState("");
  useEffect(() => { if (!open) return; setFrom(accounts[0]?.id ?? ""); setTo(accounts[1]?.id ?? ""); setAmount(""); }, [open, accounts]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Transferir entre contas</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const value = Number(amount.replace(",", ".")) || 0; if (from !== to && value > 0) onTransfer(from, to, value); }}><div className="space-y-1.5"><Label>Da conta</Label><Select value={from} onValueChange={setFrom}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {money(account.balance, account.currency)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Para a conta</Label><Select value={to} onValueChange={setTo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accounts.filter((account) => account.id !== from).map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Valor</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" /></div><p className="text-xs text-muted-foreground">A transferência movimenta o saldo entre as contas. Conversão de moeda ainda não é aplicada automaticamente.</p><Button className="w-full"><ArrowRightLeft className="size-4" /> Confirmar transferência</Button></form></DialogContent></Dialog>;
}

function MovementDialog({ open, accounts, onClose, onSave }: { open: boolean; accounts: Account[]; onClose: () => void; onSave: (movement: Movement) => void }) {
  const [accountId, setAccountId] = useState(""); const [type, setType] = useState<"entrada" | "saida">("entrada"); const [amount, setAmount] = useState(""); const [description, setDescription] = useState("");
  useEffect(() => { if (!open) return; setAccountId(accounts[0]?.id ?? ""); setType("entrada"); setAmount(""); setDescription(""); }, [open, accounts]);
  const account = accounts.find((item) => item.id === accountId);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>{accounts.length === 0 ? <div className="py-6 text-center"><p className="text-sm font-bold">Cadastre uma conta primeiro</p><p className="mt-1 text-xs text-muted-foreground">A movimentação precisa estar ligada a uma conta.</p></div> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const value = Number(amount.replace(",", ".")) || 0; if (value > 0 && accountId) onSave({ id: crypto.randomUUID(), accountId, type, amount: value, description: description.trim(), date: new Date().toISOString() }); }}><div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1"><button type="button" onClick={() => setType("entrada")} className={cn("h-10 rounded-lg text-xs font-bold", type === "entrada" && "bg-success text-white shadow-sm")}>+ Entrada</button><button type="button" onClick={() => setType("saida")} className={cn("h-10 rounded-lg text-xs font-bold", type === "saida" && "bg-destructive text-white shadow-sm")}>− Saída</button></div><div className="space-y-1.5"><Label>Conta</Label><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {money(item.balance, item.currency)}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label>Valor {account ? `em ${account.currency}` : ""}</Label><Input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" autoFocus /></div><div className="space-y-1.5"><Label>Descrição</Label><Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder={type === "entrada" ? "Ex: Pagamento recebido" : "Ex: Saque ou compra"} /></div><Button className="w-full">{type === "entrada" ? "Registrar entrada" : "Registrar saída"}</Button></form>}</DialogContent></Dialog>;
}

function ExpenseDialog({ open, editing, categories, onClose, onSave, onNewCategory }: { open: boolean; editing: Expense | null; categories: string[]; onClose: () => void; onSave: (expense: Expense) => void; onNewCategory: (name: string) => void }) {
  const [name, setName] = useState(""); const [amount, setAmount] = useState(""); const [category, setCategory] = useState(categories[0] ?? "Outros"); const [dueDay, setDueDay] = useState("1"); const [frequency, setFrequency] = useState<Frequency>("mensal"); const [newCategory, setNewCategory] = useState("");
  useEffect(() => { if (!open) return; setName(editing?.name ?? ""); setAmount(editing ? String(editing.amount) : ""); setCategory(editing?.category ?? categories[0] ?? "Outros"); setDueDay(String(editing?.dueDay ?? 1)); setFrequency(editing?.frequency ?? "mensal"); setNewCategory(""); }, [open, editing, categories]);
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{editing ? "Editar despesa" : "Nova despesa"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); let finalCategory = category; if (category === "__new__") { finalCategory = newCategory.trim() || "Outros"; onNewCategory(finalCategory); } onSave({ id: editing?.id ?? crypto.randomUUID(), name: name.trim(), amount: Number(amount.replace(",", ".")) || 0, category: finalCategory, dueDay: Math.min(31, Math.max(1, Number(dueDay) || 1)), frequency, paid: editing?.paid ?? false }); }}><div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Aluguel" required /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Valor (€)</Label><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0,00" /></div><div className="space-y-1.5"><Label>Dia do pagamento</Label><Input value={dueDay} onChange={(e) => setDueDay(e.target.value.replace(/\D/g, ""))} inputMode="numeric" /></div></div><div className="space-y-1.5"><Label>Categoria</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}<SelectItem value="__new__">+ Nova categoria</SelectItem></SelectContent></Select>{category === "__new__" && <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Nome da categoria" />}</div><div className="space-y-1.5"><Label>Frequência</Label><Select value={frequency} onValueChange={(value) => setFrequency(value as Frequency)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="mensal">Todo mês</SelectItem><SelectItem value="anual">Todo ano</SelectItem><SelectItem value="unica">Uma vez</SelectItem></SelectContent></Select></div><Button type="submit" className="w-full">{editing ? "Salvar alterações" : "Cadastrar despesa"}</Button></form></DialogContent></Dialog>;
}
