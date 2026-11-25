import "server-only";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessao } from "@/lib/supabase/server";

/**
 * Professora logada (sessão real do Supabase). Sem sessão, ou com sessão de aluno, vai para /entrar.
 *
 * Devolve o client com a secret key (ignora RLS), então toda consulta feita com o `supabase`
 * retornado DEVE filtrar por `professor.id` manualmente.
 *
 * Toda página e server action da professora passa por aqui: é a fronteira de autorização,
 * além do redirecionamento no proxy.
 */
export async function getProfessorAtual() {
  const sessao = await getSessao();
  if (!sessao || sessao.profile.papel !== "professor") redirect("/entrar");
  return { supabase: createAdminClient(), professor: sessao.profile, email: sessao.user.email ?? "" };
}
