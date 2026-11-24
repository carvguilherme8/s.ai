import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { confirmarTodos, confirmarTopico, removerTopico } from "./actions";
import { FormMaterial } from "./form-material";

export const metadata = { title: "Materiais — s.ai" };

export default function MateriaisPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">← Painel</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Materiais de apoio</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Envie um material; a IA sugere os Tópicos e você confirma os que valem.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Carregando…</p>}>
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
    <div className="mt-6 space-y-8">
      <FormMaterial turmas={turmas ?? []} />

      <ul className="space-y-4">
        {materiais?.map((m) => {
          const pendentes = m.topicos.filter((t) => !t.confirmado).length;
          return (
            <li key={m.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium">{m.titulo}</span>
                  <span className="ml-2 text-sm text-zinc-500">{m.tipo} · {m.turma?.nome}</span>
                </div>
                {pendentes > 0 && (
                  <form action={confirmarTodos}>
                    <input type="hidden" name="material_id" value={m.id} />
                    <button className="rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700">
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
                        className="min-w-48 flex-1 rounded border border-transparent bg-transparent px-2 py-1 hover:border-zinc-300 dark:hover:border-zinc-700"
                      />
                      <button className="rounded-full bg-zinc-100 px-3 py-1 dark:bg-zinc-800">
                        {t.confirmado ? "✓ confirmado — salvar" : "Confirmar"}
                      </button>
                    </form>
                    <form action={removerTopico}>
                      <input type="hidden" name="id" value={t.id} />
                      <button aria-label={`Remover ${t.nome}`} className="px-2 py-1 text-zinc-500 hover:text-red-600">✕</button>
                    </form>
                  </li>
                ))}
                {m.topicos.length === 0 && <li className="text-sm text-zinc-500">Nenhum tópico.</li>}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
