export type PlanKey = "este_mes" | "proximo_mes" | "recorrentes";
export type ItemIntent = "comprar" | "desejo" | "recorrente";
export type WishStatus = "quero" | "talvez" | "em_breve";
export type Priority = "alta" | "media" | "baixa";
export type Frequency = "semanal" | "quinzenal" | "mensal" | "anual" | "personalizado" | "sem_frequencia" | "x_dias";

export type ShoppingItem = {
  id: string;
  name: string;
  price: number;
  link?: string | undefined;
  photo?: string | undefined;
  category: string;
  bought: boolean;
  /** Intenção principal do item */
  intent?: ItemIntent | undefined;
  /** Mantido para retrocompatibilidade (mapeado para intent no loader) */
  plan?: PlanKey | undefined;
  /** Campos específicos de Desejos */
  desiredPrice?: number | undefined;
  wishStatus?: WishStatus | undefined;
  plannedMonth?: string | undefined; // "2026-10" | "algum_dia"
  /** Campos específicos de Recorrentes */
  frequency?: Frequency | undefined;
  frequencyDays?: number | undefined; // para "x_dias"
  lastDate?: string | undefined; // ISO date
  nextDate?: string | undefined; // ISO date calculada
  /** Campos gerais */
  priority?: Priority | undefined;
  store?: string | undefined;
  address?: string | undefined;
  quantity?: number | undefined;
  notes?: string | undefined;
  /** Nome da lista planejada de compras (ex: "Hoje", "Amanhã", "Esta semana", "Este mês", "Sem data") */
  listName?: string | undefined;
};

export const DEFAULT_SHOPPING_LISTS = ["Hoje", "Amanhã", "Esta semana", "Este mês", "Sem data"] as const;
export type DefaultListName = (typeof DEFAULT_SHOPPING_LISTS)[number];

export function extractListNameFromNotes(notes?: string | null): string | undefined {
  if (!notes) return undefined;
  const match = notes.match(/\[Lista:\s*([^\]]+)\]/i);
  return match ? match[1].trim() : undefined;
}

export function formatNotesWithListName(notes?: string | null, listName?: string | null): string | undefined {
  const cleanNotes = (notes || "").replace(/\[Lista:\s*[^\]]+\]\s*/gi, "").trim();
  if (!listName) return cleanNotes || undefined;
  return cleanNotes ? `[Lista: ${listName}] ${cleanNotes}` : `[Lista: ${listName}]`;
}

export function getItemListName(item: Pick<ShoppingItem, "listName" | "notes">): string {
  if (item.listName && item.listName.trim()) return item.listName.trim();
  const extracted = extractListNameFromNotes(item.notes);
  if (extracted) return extracted;
  return "Sem data";
}

/** Converte o plan legado para o novo intent semântico */
export function intentFromPlan(plan?: PlanKey | null): ItemIntent {
  if (plan === "recorrentes") return "recorrente";
  if (plan === "proximo_mes") return "desejo";
  return "comprar";
}

/** Converte intent para o plan legado (para persistência) */
export function planFromIntent(intent?: ItemIntent | null): PlanKey {
  if (intent === "recorrente") return "recorrentes";
  if (intent === "desejo") return "proximo_mes";
  return "este_mes";
}

/** Parâmetros de rastreamento que só sujam o link do produto. */
const TRACKING_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "utm_id", "fbclid", "gclid", "gbraid", "wbraid", "msclkid", "igshid",
  "mc_cid", "mc_eid", "si", "ref", "ref_", "referrer", "source", "spm",
  "yclid", "_branch_match_id",
];

export function cleanUrl(value: string) {
  const raw = value.trim();
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return raw;
    for (const param of TRACKING_PARAMS) url.searchParams.delete(param);
    for (const key of [...url.searchParams.keys()]) {
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return raw;
  }
}

export function itemTotal(item: Pick<ShoppingItem, "price" | "quantity">) {
  return (item.price || 0) * Math.max(item.quantity ?? 1, 1);
}

/**
 * Converte qualquer string de valor monetário (ex: "4268.81", "4.268,81", "4268,81", "€ 4.268,81")
 * para um número válido (ex: 4268.81). Reconhece ponto e vírgula de forma inteligente.
 */
export function parseFlexibleNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return isNaN(value) ? 0 : value;

  let str = String(value).trim();
  if (!str) return 0;

  // Remover símbolos de moeda e caracteres não numéricos (mantendo dígitos, ponto, vírgula e sinal de menos)
  str = str.replace(/[^\d.,\-]/g, "");
  if (!str) return 0;

  // Se contiver ponto E vírgula (ex: "4.268,81" ou "4,268.81")
  if (str.includes(".") && str.includes(",")) {
    const lastDot = str.lastIndexOf(".");
    const lastComma = str.lastIndexOf(",");
    if (lastComma > lastDot) {
      // Formato europeu/brasileiro "4.268,81" -> remover pontos de milhar, trocar vírgula por ponto
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      // Formato americano "4,268.81" -> remover vírgulas de milhar
      str = str.replace(/,/g, "");
    }
  }
  // Se contiver APENAS vírgula (ex: "4268,81")
  else if (str.includes(",")) {
    str = str.replace(",", ".");
  }
  // Se contiver APENAS ponto(s) (ex: "4268.81" ou múltiplos pontos "4.268.81")
  else if (str.includes(".")) {
    const parts = str.split(".");
    if (parts.length > 2) {
      const decimal = parts.pop();
      str = parts.join("") + "." + decimal;
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

export function mapsUrl(address: string, store?: string) {
  const query = [store?.trim(), address.trim()].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Calcula a próxima data de uma recorrência a partir da última data conhecida */
export function calcNextDate(item: Pick<ShoppingItem, "frequency" | "frequencyDays" | "lastDate">): string {
  const base = item.lastDate ? new Date(item.lastDate) : new Date();
  const next = new Date(base);
  switch (item.frequency) {
    case "semanal": next.setDate(next.getDate() + 7); break;
    case "mensal": next.setMonth(next.getMonth() + 1); break;
    case "anual": next.setFullYear(next.getFullYear() + 1); break;
    case "x_dias": next.setDate(next.getDate() + (item.frequencyDays ?? 30)); break;
    default: next.setMonth(next.getMonth() + 1);
  }
  return next.toISOString().split("T")[0]!;
}

/** Legado – mantido para retrocompatibilidade */
export const PLANS: { key: PlanKey; label: string }[] = [
  { key: "este_mes", label: "Preciso comprar" },
  { key: "proximo_mes", label: "Quero mais tarde" },
  { key: "recorrentes", label: "Casa e recorrentes" },
];

export function planLabel(plan?: PlanKey | null) {
  return PLANS.find((p) => p.key === plan)?.label ?? "";
}

export const INTENT_LABELS: Record<ItemIntent, string> = {
  comprar: "Comprar",
  desejo: "Desejo",
  recorrente: "Recorrente",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  semanal: "Semanal",
  quinzenal: "Quinzenal",
  mensal: "Mensal",
  personalizado: "Personalizado",
  sem_frequencia: "Sem frequência",
  anual: "Anual",
  x_dias: "A cada X dias",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const DEFAULT_CATEGORIES = [
  "Beleza",
  "Cuidado Pessoal",
  "Casa/Limpeza",
  "Alimentação",
  "Farmácia",
  "Eletrônicos",
  "Outros",
];

const ITEMS_KEY = "lista-compras:items";
const CATEGORIES_KEY = "lista-compras:categories";

export function loadItems(): ShoppingItem[] {
  try {
    const raw = localStorage.getItem(ITEMS_KEY);
    return raw ? (JSON.parse(raw) as ShoppingItem[]) : [];
  } catch {
    return [];
  }
}

export function saveItems(items: ShoppingItem[]) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

export function loadCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]));
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

export function saveCategories(categories: string[]) {
  localStorage.setItem(
    CATEGORIES_KEY,
    JSON.stringify(categories.filter((c) => !DEFAULT_CATEGORIES.includes(c))),
  );
}

export function formatEUR(value: number) {
  return `€${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

export function formatCurrency(value: number, currency: "EUR" | "USD" | "BRL") {
  const symbol = { EUR: "€", USD: "$", BRL: "R$" }[currency];
  return `${symbol}${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)}`;
}

export function groupByCategory(items: ShoppingItem[]) {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  return Array.from(groups.entries());
}

/** Retorna o intent efetivo de um item (prioriza intent, fallback via plan) */
export function effectiveIntent(item: ShoppingItem): ItemIntent {
  if (item.intent) return item.intent;
  return intentFromPlan(item.plan);
}
