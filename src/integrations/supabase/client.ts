import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseClient() {
  const url =
    import.meta.env['VITE_SUPABASE_URL'] ||
    (typeof process !== 'undefined' &&
      (process.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL']));

  const anonKey =
    import.meta.env['VITE_SUPABASE_ANON_KEY'] ||
    (typeof process !== 'undefined' &&
      (process.env['VITE_SUPABASE_ANON_KEY'] || process.env['SUPABASE_ANON_KEY']));

  if (!url || !anonKey) {
    const missing = [
      ...(!url ? ['VITE_SUPABASE_URL'] : []),
      ...(!anonKey ? ['VITE_SUPABASE_ANON_KEY'] : []),
    ];

    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}.`;
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