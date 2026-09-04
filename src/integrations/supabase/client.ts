import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function getSupabaseConfig() {
  if (typeof window === "undefined") {
    const url =
      process.env["SUPABASE_URL"] ||
      process.env["VITE_SUPABASE_URL"];

    const anonKey =
      process.env["SUPABASE_ANON_KEY"] ||
      process.env["VITE_SUPABASE_ANON_KEY"];

    return { url, anonKey };
  }

  const url = import.meta.env["VITE_SUPABASE_URL"];
  const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

  return { url, anonKey };
}

function createSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    const missing = [
      ...(!url ? ["SUPABASE_URL / VITE_SUPABASE_URL"] : []),
      ...(!anonKey ? ["SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY"] : []),
    ];

    const message = `Missing Supabase environment variable(s): ${missing.join(", ")}.`;

    console.error("[Supabase]", message);

    throw new Error(message);
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      storage:
        typeof window !== "undefined"
          ? localStorage
          : undefined,
      persistSession: typeof window !== "undefined",
      autoRefreshToken: typeof window !== "undefined",
    },
  });
}

let _supabase:
  | ReturnType<typeof createSupabaseClient>
  | undefined;

export const supabase = new Proxy(
  {} as ReturnType<typeof createSupabaseClient>,
  {
    get(_, prop, receiver) {
      if (!_supabase) {
        _supabase = createSupabaseClient();
      }

      return Reflect.get(_supabase, prop, receiver);
    },
  },
);