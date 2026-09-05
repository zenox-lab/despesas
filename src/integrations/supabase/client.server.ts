// Supabase admin client (server-side apenas — bypassa RLS).
// NUNCA importar este ficheiro em componentes de cliente ou ficheiros *.functions.ts.
// Apenas para uso em *.server.ts e handlers de servidor confiáveis.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

function createSupabaseAdminClient() {
  const url = process.env['SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
  const serviceRoleKey =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ||
    process.env['SUPABASE_ANON_KEY'] ||
    process.env['VITE_SUPABASE_ANON_KEY'];

  if (!url || !serviceRoleKey) {
    const missing = [
      ...(!url ? ['SUPABASE_URL (ou VITE_SUPABASE_URL)'] : []),
      ...(!serviceRoleKey ? ['SUPABASE_SERVICE_ROLE_KEY (ou VITE_SUPABASE_ANON_KEY)'] : []),
    ];
    const message = `Missing Supabase server environment variable(s): ${missing.join(', ')}. Check your .env file or Vercel Environment Variables.`;
    console.error(`[Supabase Admin] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

// Server-side Supabase client with service role — bypasses RLS.
// SECURITY: Only use this for trusted server-side operations, never expose to client code.
// Load inside server handlers: const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
// Top-level import is safe only in other .server.ts modules.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
