import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_CATEGORIES, type PlanKey, type ShoppingItem } from "./shopping";

type LocalData = { items: ShoppingItem[]; categories: string[] };

const file = join(process.cwd(), "shopping-data.local.json");

const seedItems: ShoppingItem[] = [
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1001", name: "Kérastase Genesis Homme Spray de Force Épaississant 150 ml", price: 31.91, link: "https://kelujo.com/kerastase/genesis-homme/spray-de-force-epaississant-150ml", photo: "https://kelujo.com/4264-large_default/spray-de-force-epaississant-150ml.jpg", category: "Cuidado Pessoal", bought: false, plan: "proximo_mes", store: "Kelujo" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1002", name: "ISDIN Fusion Water Magic SPF 50 50 ml", price: 21.95, link: "https://www.druni.es/fotoprotector-fusion-water-isdin-protector-solar-base-agua-spf-50", photo: "https://www.druni.es/media/catalog/product/5/7/5794708.jpg?quality=80&fit=bounds&height=750&width=750&canvas=750:750", category: "Cuidado Pessoal", bought: false, plan: "este_mes", store: "Druni" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1003", name: "Revlon Professional Uniq One All In One 150 ml", price: 7.70, link: "https://www.druni.es/uniq-one-all-in-one-revlon-professional-sin-aclarado-todo-tipo-cabellos", photo: "https://www.druni.es/media/catalog/product/7/0/7001268.png?quality=80&fit=bounds&height=750&width=750&canvas=750:750", category: "Cuidado Pessoal", bought: false, plan: "este_mes", store: "Druni" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1004", name: "ACM Azeane Ácido Azelaico 15% 30 ml", price: 17.50, link: "https://www.farmaciasdirect.es/products/acm-laboratoires-azeane-acido-azelaico-15-crema-30ml?variant=49039460008254", photo: "https://cdn.shopify.com/s/files/1/0835/5138/7966/files/acm-laboratoires-azeane-acido-azelaico-15-crema-30ml-266053.webp", category: "Cuidado Pessoal", bought: false, plan: "este_mes", store: "Farmaciasdirect" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1005", name: "Kérastase Genesis Homme Bain de Masse Épaississant 250 ml", price: 22.99, link: "https://www.druni.es/genesis-homme-bain-masse-epaississant-kerastase-champu-reforzador-espesor", photo: "https://www.druni.es/media/catalog/product/7/0/7003419.jpg?quality=80&fit=bounds&height=750&width=750&canvas=750:750", category: "Cuidado Pessoal", bought: false, plan: "este_mes", store: "Druni" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1006", name: "Lattafa Asad Eau de Parfum 100 ml", price: 19.94, link: "https://www.primor.eu/es_es/lattafa-asad-eau-de-parfum-126177.html", photo: "https://cdn2.primor.eu/media/catalog/product/cache/f8158826193ba5faa8b862a9bd1eb9e9/A/S/ASAD_db52.JPG", category: "Beleza", bought: false, plan: "proximo_mes", store: "Primor" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1007", name: "Minoxidil Viñas 50 mg/ml", price: 20.25, link: "https://www.farmainstant.com/anticaida-cabello/7857-vinas-minoxidil-50mg-ml.html", photo: "https://www.farmainstant.com/7857-large_default/vinas-minoxidil-50mg-ml.jpg", category: "Farmácia", bought: false, plan: "este_mes", store: "FarmaInstant" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1008", name: "Philips Bodygroom Series 7000 BG7480/15", price: 66.03, link: "https://www.mediamarkt.es/es/product/_afeitadora-corporal-philips-bg748015-3-accesorios-120-min-cabezal-flexible-2d-y-sistema-de-recorte-y-afeitado-negro-intenso-1617716.HTML", photo: "https://assets.mmsrg.com/isr/166325/c1/-/ASSET_MMS_171678661/fee_786_587_png", category: "Cuidado Pessoal", bought: false, plan: "proximo_mes", store: "MediaMarkt" },
  { id: "1a4ce8b0-33c1-4d62-b14e-0a1d8e5b1009", name: "UGREEN Nexode Air carregador USB-C GaN 45W", price: 24.99, link: "https://eu.ugreen.com/es-es/products/nexode-air-usb-c-charger-45w-gan-foldable-plug", photo: "https://eu.ugreen.com/cdn/shop/files/ugreen-nexode-air-usb-c-charger-45w-gan-foldable-plug-1514178.webp?v=1780106542", category: "Eletrônicos", bought: false, plan: "proximo_mes", store: "UGREEN" },
  { id: "base-rec-001", name: "Ovos (dúzia)", price: 2.49, category: "Alimentos", bought: false, plan: "recorrentes", frequency: "semanal", store: "Supermercado" },
  { id: "base-rec-002", name: "Leite UHT 1L", price: 0.95, category: "Alimentos", bought: false, plan: "recorrentes", frequency: "semanal", store: "Supermercado" },
  { id: "base-rec-003", name: "Pão de Forma", price: 1.59, category: "Alimentos", bought: false, plan: "recorrentes", frequency: "semanal", store: "Padaria" },
  { id: "base-rec-004", name: "Café Moído 250g", price: 3.20, category: "Alimentos", bought: false, plan: "recorrentes", frequency: "quinzenal", store: "Supermercado" },
  { id: "base-rec-005", name: "Macarrão Spagheti 500g", price: 1.10, category: "Alimentos", bought: false, plan: "recorrentes", frequency: "mensal", store: "Supermercado" },
  { id: "base-rec-006", name: "Arroz Agulha 1kg", price: 1.35, category: "Alimentos", bought: false, plan: "recorrentes", frequency: "mensal", store: "Supermercado" },
  { id: "base-rec-007", name: "Papel Higiênico (12 rolos)", price: 4.80, category: "Casa/Limpeza", bought: false, plan: "recorrentes", frequency: "quinzenal", store: "Supermercado" },
  { id: "base-rec-008", name: "Shampoo 400ml", price: 3.99, category: "Cuidado Pessoal", bought: false, plan: "recorrentes", frequency: "mensal", store: "Supermercado" },
];

async function read(): Promise<LocalData> {
  try {
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as LocalData;
    // Normalize photo field for all items to ensure legacy fields map to photo
    parsed.items = (parsed.items ?? []).map(item => ({
      ...item,
      photo: item.photo ?? (item as any).image ?? (item as any).image_url ?? (item as any).imageUrl ?? (item as any).thumbnail ?? (item as any).thumbnail_url ?? undefined,
    })).sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" }));
    parsed.categories = [...(parsed.categories ?? DEFAULT_CATEGORIES)].sort((a, b) => (a || "").localeCompare(b || "", "pt-BR", { sensitivity: "base" }));
    return parsed;
  } catch {
    const data = {
      items: seedItems.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })),
      categories: [...DEFAULT_CATEGORIES].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
    };
    await write(data);
    return data;
  }
}

async function write(data: LocalData) { await writeFile(file, JSON.stringify(data, null, 2), "utf8"); }

export async function localGetList() { return read(); }
export async function localSaveItem(item: Omit<ShoppingItem, "bought"> & { id?: string }) {
  const data = await read();
  const id = item.id ?? crypto.randomUUID();
  const current = data.items.find((entry) => entry.id === id);
  const next = { ...current, ...item, id, bought: current?.bought ?? false } as ShoppingItem;
  data.items = current ? data.items.map((entry) => entry.id === id ? next : entry) : [...data.items, next];
  await write(data); return { id };
}
export async function localPatchItem(id: string, patch: Partial<ShoppingItem>) { const data = await read(); data.items = data.items.map((item) => item.id === id ? { ...item, ...patch } : item); await write(data); }
export async function localDeleteItem(id: string) { const data = await read(); data.items = data.items.filter((item) => item.id !== id); await write(data); }
export async function localClearBought() { const data = await read(); data.items = data.items.filter((item) => !item.bought); await write(data); }
export async function localSetPlans(ids: string[], plan: PlanKey | null) { const data = await read(); data.items = data.items.map((item) => ids.includes(item.id) ? { ...item, plan: plan ?? undefined } : item); await write(data); }
export async function localAddCategory(name: string) { const data = await read(); data.categories = Array.from(new Set([...data.categories, name])); await write(data); }
export async function localRenameCategory(from: string, to: string) { const data = await read(); data.categories = data.categories.map((name) => name === from ? to : name); data.items = data.items.map((item) => item.category === from ? { ...item, category: to } : item); await write(data); }
export async function localDeleteCategory(name: string, moveTo: string) { const data = await read(); data.categories = Array.from(new Set(data.categories.filter((entry) => entry !== name).concat(moveTo))); data.items = data.items.map((item) => item.category === name ? { ...item, category: moveTo } : item); await write(data); }
