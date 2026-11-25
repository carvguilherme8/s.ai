import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Verificação de saúde. O cron diário da Vercel (vercel.json) chama esta rota, o que mantém o
 * projeto Supabase do plano gratuito ativo (ele pausa após alguns dias sem uso).
 * Não expõe detalhes de erro.
 */
export async function GET() {
  const inicio = Date.now();
  const { error } = await createAdminClient().from("turmas").select("id", { head: true, count: "exact" }).limit(1);
  return Response.json({ ok: !error, ms: Date.now() - inicio }, { status: error ? 503 : 200 });
}
