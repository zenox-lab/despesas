// Supabase client (browser / SSR public).
// Usa VITE_SUPABASE_ANON_KEY — a chave pública padrão do Supabase.
// NUNCA colocar a service role key aqui — este ficheiro é incluído no bundle do cliente.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseClient() {
  // Vite injeta VITE_* no bundle do cliente em build-time.
  // Em SSR (server-side), lê de process.env como fallback.
  const url =
    import.meta.env['VITE_SUPABASE_URL'] ||
    (typeof process !== 'undefined' && process.env['SUPABASE_URL']);
  const anonKey =
    import.meta.env['VITE_SUPABASE_ANON_KEY'] ||
    (typeof process !== 'undefined' && process.env['SUPABASE_ANON_KEY']);

  if (!url || !anonKey) {
    const missing = [
      ...(!url ? ['VITE_SUPABASE_URL'] : []),
      ...(!anonKey ? ['VITE_SUPABASE_ANON_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Check your .env file.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
