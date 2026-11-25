import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { confirmarTodos, confirmarTopico, removerTopico } from "./actions";
import { IconeCheck, IconeX } from "../icones";
import { FormMaterial } from "./form-material";

export const metadata = { title: "Materiais — s.ai" };

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
      .select("id, titulo, tipo, created_at, turma:turmas(nome), topicos(id, nome, descricao, confirmado)")
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{m.titulo}</span>
                  <span className="ml-2 text-sm text-muted">{m.tipo === "pdf" ? "PDF" : "texto"} · {m.turma?.nome}</span>
                </div>
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
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <form action={confirmarTopico} className="flex flex-1 flex-wrap items-start gap-2">
                      <input type="hidden" name="id" value={t.id} />
                      <input type="hidden" name="confirmado" value="true" />
                      <input
                        name="nome"
                        defaultValue={t.nome}
                        aria-label="Nome do tópico"
                        className="min-w-48 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 transition-colors hover:border-line-strong focus:border-link focus:outline-none"
                      />
                      <button className={`btn btn-sm ${t.confirmado ? "btn-secondary" : "btn-primary"}`} title={t.confirmado ? "Salvar o nome" : "Confirmar tópico"}>
                        {t.confirmado ? <><IconeCheck className="text-ok" /> Confirmado</> : "Confirmar"}
                      </button>
                    </form>
                    <form action={removerTopico}>
                      <input type="hidden" name="id" value={t.id} />
                      <button aria-label={`Remover ${t.nome}`} className="btn btn-sm min-h-8 px-2 text-muted hover:text-danger"><IconeX /></button>
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
