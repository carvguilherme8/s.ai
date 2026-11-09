import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";

export async function PainelProfessor() {
  await connection();
  const { supabase, professor, email } = await getProfessorAtual();

  const [{ data: turmas }, { data: materiais }, { data: topicos }] = await Promise.all([
    supabase
      .from("turmas")
      .select("id, nome, codigo_convite, alunos:profiles!profiles_turma_fk(id, nome)")
      .eq("professor_id", professor.id)
      .order("nome"),
    supabase
      .from("materiais")
      .select("id, titulo, tipo, turma:turmas(nome)")
      .eq("professor_id", professor.id)
      .order("created_at"),
    supabase
      .from("topicos")
      .select("id, nome, confirmado")
      .eq("professor_id", professor.id)
      .order("nome"),
  ]);

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <span>
          Logado como <strong>{professor.nome}</strong> · {email}
        </span>
        <span className="rounded bg-amber-200 px-2 py-0.5 text-xs font-medium dark:bg-amber-800">simulado</span>
      </header>

      <section>
        <h2 className="mb-3 font-medium">Turmas</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {turmas?.map((t) => (
            <div key={t.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold">{t.nome}</span>
                <code className="rounded bg-zinc-100 px-2 py-0.5 text-sm dark:bg-zinc-800">{t.codigo_convite}</code>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{t.alunos.length} alunos</p>
              <ul className="mt-2 space-y-0.5 text-sm">
                {t.alunos.map((a) => (
                  <li key={a.id}>{a.nome}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 font-medium">Materiais de apoio</h2>
          <ul className="space-y-2 text-sm">
            {materiais?.map((m) => (
              <li key={m.id} className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                {m.titulo}
                <span className="ml-2 text-zinc-500">
                  {m.tipo} · {m.turma?.nome}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-medium">Tópicos</h2>
          <ul className="flex flex-wrap gap-2 text-sm">
            {topicos?.map((t) => (
              <li key={t.id} className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                {t.nome}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
