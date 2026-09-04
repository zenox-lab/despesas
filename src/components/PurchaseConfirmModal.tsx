import { useState, useEffect } from "react";
import { Check, ShoppingBag, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatEUR, itemTotal, parseFlexibleNumber, type ShoppingItem } from "@/lib/shopping";

export type PurchaseAccount = {
  id: string;
  name: string;
  balance: number;
  currency: "EUR" | "USD" | "BRL";
};

export type PurchaseConfirmResult = {
  account: PurchaseAccount;
  pricePaid: number;
  date: string;
  financialCategory: string;
};

type PurchaseConfirmModalProps = {
  open: boolean;
  item: ShoppingItem | null;
  accounts: PurchaseAccount[];
  onOpenChange: (open: boolean) => void;
  onConfirm: (result: PurchaseConfirmResult) => void;
};

const FINANCIAL_CATEGORIES = [
  "Compras", "Beleza", "Cuidado Pessoal", "Casa/Limpeza",
  "Alimentação", "Farmácia", "Eletrônicos", "Saúde", "Outros",
];

export function PurchaseConfirmModal({
  open,
  item,
  accounts,
  onOpenChange,
  onConfirm,
}: PurchaseConfirmModalProps) {
  const [accountId, setAccountId] = useState("");
  const [pricePaid, setPricePaid] = useState("");
  const [date, setDate] = useState("");
  const [finCategory, setFinCategory] = useState("Compras");

  useEffect(() => {
    if (!open || !item) return;
    setAccountId(accounts[0]?.id ?? "");
    setPricePaid(String(itemTotal(item)));
    setDate(new Date().toISOString().split("T")[0]!);
    setFinCategory(item.category === "Alimentação" ? "Alimentação" : "Compras");
  }, [open, item, accounts]);

  if (!item) return null;

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const parsedPrice = parseFlexibleNumber(pricePaid);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    onConfirm({
      account: selectedAccount,
      pricePaid: parsedPrice,
      date,
      financialCategory: finCategory,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar compra</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Produto */}
          <div className="rounded-xl bg-muted/60 p-3">
            <div className="flex items-center gap-3">
              {item.photo && (
                <img
                  src={item.photo}
                  alt={item.name}
                  className="size-12 shrink-0 rounded-lg border border-border object-cover bg-white"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold">{item.name}</p>
                {item.store && (
                  <p className="text-[11px] text-muted-foreground">{item.store}</p>
                )}
              </div>
            </div>
          </div>

          {/* Preço pago */}
          <div className="space-y-1.5">
            <Label>Preço pago (€)</Label>
            <Input
              value={pricePaid}
              onChange={(e) => setPricePaid(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <Label>Data da compra</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Conta */}
          <div className="space-y-1.5">
            <Label>Conta utilizada</Label>
            {accounts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-[12px] text-muted-foreground text-center">
                Cadastre uma conta em Finanças primeiro.
              </p>
            ) : (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} · {acc.currency} {acc.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Categoria financeira */}
          <div className="space-y-1.5">
            <Label>Categoria financeira</Label>
            <Select value={finCategory} onValueChange={setFinCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FINANCIAL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resumo */}
          {selectedAccount && parsedPrice > 0 && (
            <div className="rounded-xl bg-success/8 border border-success/20 px-3 py-2.5">
              <p className="text-[11px] text-success/80 font-medium">
                {selectedAccount.name} será debitado em{" "}
                <span className="font-extrabold">{formatEUR(parsedPrice)}</span>
              </p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!accountId || parsedPrice <= 0}>
            <Check className="size-4" />
            Confirmar compra
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
