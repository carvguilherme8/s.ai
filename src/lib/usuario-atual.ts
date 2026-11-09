import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Login SIMULADO (enquanto o login real está desligado).
 * Sempre devolve a professora do seed. Para trocar, defina DEMO_PROFESSOR_EMAIL.
 *
 * Como usa a secret key (ignora RLS), toda consulta feita com o `supabase`
 * retornado DEVE filtrar por `professor.id` manualmente.
 *
 * Quando o login voltar, troque esta função por uma que lê a sessão
 * (ver commit 5958a54) e o restante das páginas continua igual.
 */
export async function getProfessorAtual() {
  const supabase = createAdminClient();
  const email = process.env.DEMO_PROFESSOR_EMAIL ?? "professora@demo.s-ai.dev";

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (!user) throw new Error(`Professor simulado ${email} não encontrado. Rode: npm run seed`);

  const { data: professor, error: erroProfile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (erroProfile) throw erroProfile;

  return { supabase, professor, email };
}
