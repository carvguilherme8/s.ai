import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Client com a secret key: IGNORA RLS. Use só em código de servidor para escritas
 * que o usuário não pode fazer direto (Entrega, correção, nota, Feedback, resumo do Diagnóstico).
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
