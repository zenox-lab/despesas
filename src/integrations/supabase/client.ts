import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://phsvifuvtssnneczkslo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_A-6m4xsZwBi258C-NhZE6Q__9AqWhHU";

function createSupabaseClient() {
  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      auth: {
        storage:
          typeof window !== "undefined"
            ? localStorage
            : undefined,
        persistSession: typeof window !== "undefined",
        autoRefreshToken: typeof window !== "undefined",
      },
    },
  );
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