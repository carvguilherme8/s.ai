import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { CardTurma } from "./card-turma";
import { FormCriarTurma } from "./form-criar";

export const metadata = { title: "Turmas — s.ai" };

export default function TurmasPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Turmas</h1>
      <p className="mt-1 max-w-prose text-muted">
        Crie turmas e compartilhe o código de convite para que os alunos entrem na sala certa.
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

  const { data: turmas } = await supabase
    .from("turmas")
    .select(
      `id, nome, codigo_convite,
       alunos:profiles!profiles_turma_fk(id, nome),
       materiais(id),
       atividades(id)`,
    )
    .eq("professor_id", professor.id)
    .order("nome");

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      <FormCriarTurma />

      {turmas?.length ? (
        <ul className="space-y-4">
          {turmas.map((t) => (
            <CardTurma
              key={t.id}
              turma={{
                id: t.id,
                nome: t.nome,
                codigo_convite: t.codigo_convite,
                alunos: [...t.alunos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
                totalMateriais: t.materiais.length,
                totalAtividades: t.atividades.length,
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
          Você ainda não tem nenhuma turma. Crie a primeira acima para gerar um código de convite.
        </p>
      )}
    </div>
  );
}
