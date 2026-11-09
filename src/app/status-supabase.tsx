import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TABELAS = ["profiles", "turmas", "materiais", "topicos", "atividades", "entregas"] as const;

/** Indicador de conexão: conta linhas de cada tabela (só números, nenhum dado pessoal). */
export async function StatusSupabase() {
  await connection(); // sempre no momento da requisição
  const inicio = Date.now();

  let contagens: { tabela: string; total: number | null }[] = [];
  let erro: string | null = null;
  try {
    const supabase = createAdminClient();
    contagens = await Promise.all(
      TABELAS.map(async (tabela) => {
        const { count, error } = await supabase.from(tabela).select("*", { count: "exact", head: true });
        if (error) throw new Error(`${tabela}: ${error.message}`);
        return { tabela, total: count };
      }),
    );
  } catch (e) {
    erro = e instanceof Error ? e.message : String(e);
  }
  const ms = Date.now() - inicio;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="flex items-center gap-2 text-sm font-medium">
        <span className={`h-2.5 w-2.5 rounded-full ${erro ? "bg-red-500" : "bg-emerald-500"}`} />
        {erro ? "Supabase: falha na conexão" : `Supabase conectado · ${ms} ms`}
      </p>
      {erro ? (
        <p className="mt-2 text-sm text-red-600">{erro}</p>
      ) : (
        <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
          {contagens.map(({ tabela, total }) => (
            <div key={tabela}>
              <dt className="text-zinc-500">{tabela}</dt>
              <dd className="text-lg font-semibold tabular-nums">{total ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function StatusSupabaseCarregando() {
  return (
    <div className="rounded-lg border border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800">
      Verificando conexão com o Supabase…
    </div>
  );
}
