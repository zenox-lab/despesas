import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { DEFAULT_CATEGORIES, type ShoppingItem } from "@/lib/shopping";

const itemInput = z.object({
  id: z.string().min(1).optional(),
  name: z.string().trim().min(1).max(140),
  price: z.number().min(0).max(1_000_000),
  link: z.string().trim().max(2000).optional().nullable(),
  photo: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(1).max(40),
  plan: z.enum(["este_mes", "proximo_mes", "recorrentes"]).nullable().optional(),
  store: z.string().trim().max(120).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  quantity: z.number().int().min(1).max(999).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  desiredPrice: z.number().min(0).max(1_000_000).optional().nullable(),
  wishStatus: z.enum(["quero", "talvez", "em_breve"]).optional().nullable(),
  listName: z.string().trim().max(100).optional().nullable(),
  frequency: z.string().max(50).optional().nullable(),
  frequencyDays: z.number().int().optional().nullable(),
  priority: z.string().max(20).optional().nullable(),
  intent: z.enum(["comprar", "desejo", "recorrente"]).optional().nullable(),
});

export const getList = createServerFn({ method: "GET" }).handler(async () => {
  const { assertUnlocked } = await import("./gate.server");
  await assertUnlocked();
  const { isLocalAuthBypassed } = await import("./gate.server");
  if (isLocalAuthBypassed()) {
    const { localGetList } = await import("./local-list.server");
    return localGetList();
  }
  let supabaseAdmin;
  try {
    ({ supabaseAdmin } = await import("@/integrations/supabase/client.server"));
    void supabaseAdmin.from;
  } catch (error) {
    if (isLocalAuthBypassed()) {
      console.warn("[Local] Supabase admin não configurado; abrindo uma lista vazia.");
      return { items: [] as ShoppingItem[], categories: DEFAULT_CATEGORIES };
    }
    throw error;
  }

  const [items, categories] = await Promise.all([
    supabaseAdmin
      .from("shopping_items")
      .select("id, name, price, link, photo, category, bought, plan, intent, store, address, quantity, notes, priority, wish_status, desired_price, planned_month, frequency, frequency_days, last_date, next_date")
      .order("name", { ascending: true }),
    supabaseAdmin.from("shopping_categories").select("name").order("name", { ascending: true }),
  ]);
  if (items.error) throw items.error;
  if (categories.error) throw categories.error;

  const { extractListNameFromNotes, sortItemsAlphabetically, sortCategoriesAlphabetically } = await import("@/lib/shopping");

  const list: ShoppingItem[] = sortItemsAlphabetically((items.data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    price: Number(row.price) || 0,
    link: row.link ?? undefined,
    photo: row.photo ?? row.image ?? row.image_url ?? row.imageUrl ?? row.thumbnail ?? row.thumbnail_url ?? undefined,
    category: row.category,
    bought: row.bought,
    plan: (row.plan as ShoppingItem["plan"]) ?? undefined,
    intent: (row.intent as ShoppingItem["intent"]) ?? undefined,
    store: row.store ?? undefined,
    address: row.address ?? undefined,
    quantity: row.quantity ?? 1,
    notes: row.notes ?? undefined,
    priority: (row.priority as ShoppingItem["priority"]) ?? undefined,
    wishStatus: (row.wish_status as ShoppingItem["wishStatus"]) ?? undefined,
    desiredPrice: Number(row.desired_price) || undefined,
    plannedMonth: row.planned_month ?? undefined,
    frequency: (row.frequency as ShoppingItem["frequency"]) ?? undefined,
    frequencyDays: row.frequency_days ?? undefined,
    lastDate: row.last_date ?? undefined,
    nextDate: row.next_date ?? undefined,
    listName: row.listName ?? row.list_name ?? extractListNameFromNotes(row.notes) ?? undefined,
  })));

  const stored = (categories.data ?? []).map((c: any) => c.name);
  return {
    items: list,
    categories: sortCategoriesAlphabetically(stored.length > 0 ? stored : DEFAULT_CATEGORIES),
  };
});

export const saveItem = createServerFn({ method: "POST" })
  .validator((data: unknown) => itemInput.parse(data))
  .handler(async ({ data }) => {
    const { assertUnlocked } = await import("./gate.server");
    await assertUnlocked();
    const { formatNotesWithListName } = await import("@/lib/shopping");
    const formattedNotes = formatNotesWithListName(data.notes, data.listName);
    const { isLocalAuthBypassed } = await import("./gate.server");
    if (isLocalAuthBypassed()) {
      const { localSaveItem } = await import("./local-list.server");
      return localSaveItem({
        ...(data.id ? { id: data.id } : {}), name: data.name, price: data.price,
        link: data.link ?? undefined, photo: data.photo ?? undefined, category: data.category,
        plan: data.plan ?? undefined, store: data.store ?? undefined,
        address: data.address ?? undefined, quantity: data.quantity ?? 1,
        notes: formattedNotes,
        listName: data.listName ?? undefined,
        frequency: (data.frequency as ShoppingItem["frequency"]) ?? undefined,
      });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: Record<string, any> = {
      name: data.name,
      price: data.price,
      link: data.link || null,
      photo: data.photo || null,
      category: data.category,
      store: data.store || null,
      address: data.address || null,
      quantity: data.quantity ?? 1,
      notes: formattedNotes || null,
      desired_price: data.desiredPrice || null,
      wish_status: data.wishStatus || null,
      frequency: data.frequency || (data.plan === "recorrentes" ? "semanal" : null),
      ...(data.frequencyDays ? { frequency_days: data.frequencyDays } : {}),
      ...(data.priority ? { priority: data.priority } : {}),
      ...(data.plan !== undefined ? { plan: data.plan } : {}),
      ...(data.plan === "recorrentes" ? { intent: "recorrente" } : {}),
    };

    if (data.id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.id);
      if (isUuid) {
        const { error } = await supabaseAdmin
          .from("shopping_items")
          .update(payload)
          .eq("id", data.id);
        if (error) {
          console.error("[saveItem] Erro ao atualizar item no Supabase:", error);
          throw error;
        }
        return { id: data.id };
      }
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("shopping_items")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.error("[saveItem] Erro ao inserir item no Supabase:", error);
      throw error;
    }
    return { id: inserted.id };
  });

export const setItemBought = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ id: z.string().min(1), bought: z.boolean() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { assertUnlocked } = await import("./gate.server");
    await assertUnlocked();
    const { isLocalAuthBypassed } = await import("./gate.server");
    if (isLocalAuthBypassed()) { const { localPatchItem } = await import("./local-list.server"); await localPatchItem(data.id, { bought: data.bought }); return { ok: true as const }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shopping_items")
      .update({ bought: data.bought })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const deleteItem = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { assertUnlocked } = await import("./gate.server");
    await assertUnlocked();
    const { isLocalAuthBypassed } = await import("./gate.server");
    if (isLocalAuthBypassed()) { const { localDeleteItem } = await import("./local-list.server"); await localDeleteItem(data.id); return { ok: true as const }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shopping_items")
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true as const };
  });

export const clearBought = createServerFn({ method: "POST" }).handler(async () => {
  const { assertUnlocked } = await import("./gate.server");
  await assertUnlocked();
  const { isLocalAuthBypassed } = await import("./gate.server");
  if (isLocalAuthBypassed()) { const { localClearBought } = await import("./local-list.server"); await localClearBought(); return { ok: true as const }; }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("shopping_items")
    .delete()
    .eq("bought", true);
  if (error) throw error;
  return { ok: true as const };
});

export const addCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ name: z.string().trim().min(1).max(40) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { assertUnlocked } = await import("./gate.server");
    await assertUnlocked();
    const { isLocalAuthBypassed } = await import("./gate.server");
    if (isLocalAuthBypassed()) { const { localAddCategory } = await import("./local-list.server"); await localAddCategory(data.name); return { ok: true as const }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shopping_categories")
      .upsert({ name: data.name }, { onConflict: "name" });
    if (error) throw error;
    return { ok: true as const };
  });

export const setItemsPlan = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        ids: z.array(z.string().min(1)).min(1).max(200),
        plan: z.enum(["este_mes", "proximo_mes", "recorrentes"]).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { assertUnlocked } = await import("./gate.server");
    await assertUnlocked();
    const { isLocalAuthBypassed } = await import("./gate.server");
    if (isLocalAuthBypassed()) { const { localSetPlans } = await import("./local-list.server"); await localSetPlans(data.ids, data.plan); return { ok: true as const }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shopping_items")
      .update({ plan: data.plan })
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true as const };
  });

export const renameCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        from: z.string().trim().min(1).max(40),
        to: z.string().trim().min(1).max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { assertUnlocked } = await import("./gate.server");
    await assertUnlocked();
    if (data.from === data.to) return { ok: true as const };
    const { isLocalAuthBypassed } = await import("./gate.server");
    if (isLocalAuthBypassed()) { const { localRenameCategory } = await import("./local-list.server"); await localRenameCategory(data.from, data.to); return { ok: true as const }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const up = await supabaseAdmin
      .from("shopping_categories")
      .upsert({ name: data.to }, { onConflict: "name" });
    if (up.error) throw up.error;
    const items = await supabaseAdmin
      .from("shopping_items")
      .update({ category: data.to })
      .eq("category", data.from);
    if (items.error) throw items.error;
    const del = await supabaseAdmin
      .from("shopping_categories")
      .delete()
      .eq("name", data.from);
    if (del.error) throw del.error;
    return { ok: true as const };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(40),
        moveTo: z.string().trim().min(1).max(40).default("Outros"),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { assertUnlocked } = await import("./gate.server");
    await assertUnlocked();
    if (data.name === data.moveTo) return { ok: true as const };
    const { isLocalAuthBypassed } = await import("./gate.server");
    if (isLocalAuthBypassed()) { const { localDeleteCategory } = await import("./local-list.server"); await localDeleteCategory(data.name, data.moveTo); return { ok: true as const }; }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const target = await supabaseAdmin
      .from("shopping_categories")
      .upsert({ name: data.moveTo }, { onConflict: "name" });
    if (target.error) throw target.error;
    const items = await supabaseAdmin
      .from("shopping_items")
      .update({ category: data.moveTo })
      .eq("category", data.name);
    if (items.error) throw items.error;
    const del = await supabaseAdmin
      .from("shopping_categories")
      .delete()
      .eq("name", data.name);
    if (del.error) throw del.error;
    return { ok: true as const };
  });
