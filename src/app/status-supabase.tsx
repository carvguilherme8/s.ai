import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TABELAS = ["profiles", "turmas", "materiais", "topicos", "atividades", "entregas"] as const;

/** Conta linhas de cada tabela (só números, nenhum dado pessoal) e mede a latência. */
async function verificarConexao() {
  const inicio = Date.now();
  try {
    const supabase = createAdminClient();
    const contagens = await Promise.all(
      TABELAS.map(async (tabela) => {
        const { count, error } = await supabase.from(tabela).select("*", { count: "exact", head: true });
        if (error) throw new Error(`${tabela}: ${error.message}`);
        return { tabela, total: count };
      }),
    );
    return { contagens, erro: null, ms: Date.now() - inicio };
  } catch (e) {
    return { contagens: [], erro: e instanceof Error ? e.message : String(e), ms: Date.now() - inicio };
  }
}

/** Indicador de conexão com o Supabase: uma linha discreta, com os números a um clique. */
export async function StatusSupabase() {
  await connection(); // sempre no momento da requisição
  const { contagens, erro, ms } = await verificarConexao();

  return (
    <details className="text-xs text-muted">
      <summary className="flex cursor-pointer items-center gap-2">
        <span aria-hidden className={`h-2 w-2 rounded-full ${erro ? "bg-danger" : "bg-accent"}`} />
        {erro ? "Supabase: falha na conexão" : `Supabase conectado · ${ms} ms`}
      </summary>
      {erro ? (
        <p className="mt-2 text-danger">{erro}</p>
      ) : (
        <dl className="mt-3 grid max-w-md grid-cols-3 gap-3">
          {contagens.map(({ tabela, total }) => (
            <div key={tabela}>
              <dt>{tabela}</dt>
              <dd className="text-base font-semibold text-ink tabular-nums">{total ?? "—"}</dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}

export function StatusSupabaseCarregando() {
  return <p className="text-xs text-muted">Verificando conexão com o Supabase…</p>;
}
