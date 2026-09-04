import { useEffect, useState } from "react";
import { ExternalLink, MapPin, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatEUR, itemTotal, mapsUrl, planLabel, type ShoppingItem } from "@/lib/shopping";

export type PurchaseAccount = { id: string; name: string; balance: number; currency: "EUR" | "USD" | "BRL" };

export function PurchaseDialog({ open, item, accounts, startPaying, onOpenChange, onPay }: { open: boolean; item: ShoppingItem | null; accounts: PurchaseAccount[]; startPaying: boolean; onOpenChange: (open: boolean) => void; onPay: (account: PurchaseAccount) => void }) {
  const [paying, setPaying] = useState(false);
  const [accountId, setAccountId] = useState("");
  useEffect(() => { if (!open) return; setPaying(startPaying); setAccountId(accounts[0]?.id ?? ""); }, [open, startPaying, accounts]);
  if (!item) return null;
  const value = itemTotal(item);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md"><DialogHeader><DialogTitle>{paying ? "Confirmar compra" : item.name}</DialogTitle></DialogHeader>
    {!paying ? <div className="space-y-4">
      {item.photo && <img src={item.photo} alt={item.name} className="h-48 w-full rounded-2xl border border-border object-contain bg-white" />}
      <div className="grid grid-cols-2 gap-2"><Info label="Preço" value={formatEUR(value)} /><Info label="Lista" value={planLabel(item.plan) || "Sem lista"} /><Info label="Categoria" value={item.category} /><Info label="Loja" value={item.store || "Não informada"} /></div>
      {item.notes && <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">{item.notes}</p>}
      <div className="flex flex-wrap gap-2">{item.link && <a href={item.link} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><ExternalLink className="size-3.5" /> Produto</Button></a>}{(item.address || item.store) && <a href={mapsUrl(item.address || item.store || "", item.address ? item.store : undefined)} target="_blank" rel="noreferrer"><Button variant="outline" size="sm"><MapPin className="size-3.5" /> Abrir no Google Maps</Button></a>}</div>
      <Button className="w-full" onClick={() => setPaying(true)}><ShoppingBag className="size-4" /> Comprar por {formatEUR(value)}</Button>
    </div> : <div className="space-y-4">
      <div className="rounded-2xl bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Você está comprando</p><p className="mt-1 text-sm font-extrabold">{item.name}</p><p className="mt-2 text-2xl font-extrabold text-primary">{formatEUR(value)}</p></div>
      {accounts.length ? <><div className="space-y-1.5"><p className="text-xs font-bold">Pagar com qual conta?</p><Select value={accountId} onValueChange={setAccountId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name} · {account.currency} {account.balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</SelectItem>)}</SelectContent></Select></div><Button className="w-full" disabled={!accountId} onClick={() => { const account = accounts.find((entry) => entry.id === accountId); if (account) onPay(account); }}>Pagar e concluir</Button></> : <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">Cadastre uma conta em Finanças antes de concluir a compra.</div>}
      <Button variant="ghost" className="w-full" onClick={() => setPaying(false)}>Voltar aos detalhes</Button>
    </div>}
  </DialogContent></Dialog>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-border bg-surface p-3"><p className="text-[9px] font-bold tracking-wider text-muted-foreground uppercase">{label}</p><p className="mt-1 truncate text-xs font-bold">{value}</p></div>; }
