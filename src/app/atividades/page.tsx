import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { FormGerar } from "./form-gerar";

export const metadata = { title: "Atividades — s.ai" };

export default function AtividadesPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Atividades</h1>
      <p className="mt-1 max-w-prose text-muted">
        A IA gera as questões a partir de um material; você revisa e só então publica para a turma.
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

  const [{ data: turmas }, { data: materiais }, { data: atividades }] = await Promise.all([
    supabase.from("turmas").select("id, nome").eq("professor_id", professor.id).order("nome"),
    supabase.from("materiais").select("id, titulo, turma_id, topicos(confirmado)")
      .eq("professor_id", professor.id).order("created_at", { ascending: false }),
    supabase.from("atividades")
      .select("id, titulo, status, prazo, turma:turmas(nome), questoes(id)")
      .eq("professor_id", professor.id).order("created_at", { ascending: false }),
  ]);

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      <FormGerar
        turmas={turmas ?? []}
        materiais={(materiais ?? []).map((m) => ({
          id: m.id, titulo: m.titulo, turma_id: m.turma_id, confirmados: m.topicos.filter((t) => t.confirmado).length,
        }))}
      />
      <ul className="space-y-2">
        {atividades?.map((a) => (
          <li key={a.id}>
            <Link
              href={`/atividades/${a.id}`}
              className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken"
            >
              <span>
                <span className="font-medium">{a.titulo}</span>
                <span className="ml-2 text-sm text-muted">{a.turma?.nome} · {a.questoes.length} questões</span>
              </span>
              <span className={`badge ${a.status === "publicada" ? "badge-ok" : "badge-neutral"}`}>
                {a.status === "publicada" ? "publicada" : "rascunho"}
              </span>
            </Link>
          </li>
        ))}
        {atividades?.length === 0 && <li className="text-sm text-muted">Nenhuma atividade ainda.</li>}
      </ul>
    </div>
  );
}
