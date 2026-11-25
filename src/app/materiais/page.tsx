import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { NOMES_DISCIPLINAS } from "@/lib/disciplinas";
import { confirmarTodos, confirmarTopico, definirDisciplina, removerTopico } from "./actions";
import { IconeCheck, IconeX } from "../icones";
import { FormMaterial } from "./form-material";

export const metadata = { title: "Materiais — s.ai" };

// Ações de IA nesta página demoram; permite até 120s no servidor (ver docs/DEPLOY.md).
export const maxDuration = 120;

export default function MateriaisPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Materiais de apoio</h1>
      <p className="mt-1 max-w-prose text-muted">
        Envie um material; a IA sugere os Tópicos e você confirma os que valem.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}

async function Conteudo() {
  await connection();
  const { supabase, professor } = await getProfessorAtual();

  const [{ data: turmas }, { data: materiais }] = await Promise.all([
    supabase.from("turmas").select("id, nome").eq("professor_id", professor.id).order("nome"),
    supabase
      .from("materiais")
      .select("id, titulo, tipo, disciplina, created_at, turma:turmas(nome), topicos(id, nome, descricao, confirmado)")
      .eq("professor_id", professor.id)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      <FormMaterial turmas={turmas ?? []} />

      <ul className="space-y-4">
        {materiais?.map((m) => {
          const pendentes = m.topicos.filter((t) => !t.confirmado).length;
          return (
            <li key={m.id} className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div>
                  <span className="font-medium">{m.titulo}</span>
                  <span className="ml-2 text-sm text-muted">{m.tipo === "pdf" ? "PDF" : "texto"} · {m.turma?.nome}</span>
                </div>
                <form action={definirDisciplina} className="flex items-center gap-2">
                  <input type="hidden" name="material_id" value={m.id} />
                  <select
                    name="disciplina"
                    defaultValue={m.disciplina ?? ""}
                    aria-label={`Disciplina de ${m.titulo}`}
                    className="field w-auto py-1.5 text-[0.8125rem]"
                  >
                    <option value="">Sem disciplina</option>
                    {NOMES_DISCIPLINAS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <button className="btn btn-secondary btn-sm">Salvar</button>
                </form>
                {pendentes > 0 && (
                  <form action={confirmarTodos}>
                    <input type="hidden" name="material_id" value={m.id} />
                    <button className="btn btn-secondary btn-sm">
                      Confirmar todos ({pendentes})
                    </button>
                  </form>
                )}
              </div>

              <ul className="mt-3 space-y-2">
                {m.topicos.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-start gap-2 text-sm">
                    <form action={confirmarTopico} className="contents">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="confirmado" value="true" />
                      <textarea
                        name="nome"
                        rows={1}
                        defaultValue={t.nome}
                        aria-label="Nome do tópico"
                        className="campo-nome w-full rounded-lg border border-transparent bg-transparent px-2 py-2 transition-colors hover:border-line-strong focus:border-link focus:outline-none sm:w-auto sm:min-w-48 sm:flex-1 sm:py-1.5"
                      />
                      <button className={`btn btn-sm ${t.confirmado ? "btn-secondary" : "btn-primary"}`} title={t.confirmado ? "Salvar o nome" : "Confirmar tópico"}>
                        {t.confirmado ? <><IconeCheck className="text-ok" /> Confirmado</> : "Confirmar"}
                      </button>
                    </form>
                    <form action={removerTopico} className="ml-auto sm:ml-0">
                      <input type="hidden" name="id" value={t.id} />
                      <button aria-label={`Remover ${t.nome}`} className="btn btn-sm min-w-11 px-3 text-muted hover:text-danger sm:min-w-0 sm:px-2"><IconeX /></button>
                    </form>
                  </li>
                ))}
                {m.topicos.length === 0 && <li className="text-sm text-muted">Nenhum tópico.</li>}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
