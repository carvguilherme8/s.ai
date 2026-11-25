import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { CardMaterial } from "./card-material";
import { FormMaterial } from "./form-material";

export const metadata = { title: "Materiais — s.ai" };

// Ações de IA nesta página demoram; permite até 120s no servidor (ver docs/DEPLOY.md).
export const maxDuration = 120;

export default function MateriaisPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Materiais de apoio</h1>
      <p className="mt-1 max-w-prose text-muted">
        Envie um material; a IA sugere os Tópicos e você confirma, edita ou adiciona os que valem.
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
      .select(
        `id, titulo, tipo, disciplina, turma_id, created_at,
         turma:turmas(nome),
         atividades(id),
         topicos(id, nome, descricao, confirmado, created_at, questoes(id))`,
      )
      .eq("professor_id", professor.id)
      .order("created_at", { ascending: false }),
  ]);

  const listaTurmas = turmas ?? [];

  return (
    <div className="mt-8 max-w-3xl space-y-8">
      <FormMaterial turmas={listaTurmas} />

      {materiais?.length ? (
        <ul className="space-y-4">
          {materiais.map((m) => (
            <CardMaterial
              key={m.id}
              turmas={listaTurmas}
              material={{
                id: m.id,
                titulo: m.titulo,
                tipo: m.tipo,
                disciplina: m.disciplina,
                turmaId: m.turma_id,
                turmaNome: m.turma?.nome ?? null,
                totalAtividades: m.atividades.length,
                topicos: [...m.topicos]
                  .sort((a, b) => a.created_at.localeCompare(b.created_at))
                  .map((t) => ({
                    id: t.id,
                    nome: t.nome,
                    descricao: t.descricao,
                    confirmado: t.confirmado,
                    totalQuestoes: t.questoes.length,
                  })),
              }}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
          Nenhum material enviado ainda. Cole um texto ou envie um PDF acima para começar.
        </p>
      )}
    </div>
  );
}
