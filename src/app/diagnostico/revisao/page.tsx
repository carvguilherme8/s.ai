import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { carregarMesaRevisao } from "@/lib/revisao-dissertativas";
import { IconeVoltar } from "../../icones";
import { FilaRevisao } from "./fila-revisao";

export const metadata = { title: "Mesa de revisão — s.ai" };

// Re-correção em lote e Rubrica Reversa podem acionar o Gemini.
export const maxDuration = 120;

export default function MesaRevisaoPage({ searchParams }: PageProps<"/diagnostico/revisao">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link href="/diagnostico" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconeVoltar /> Diagnóstico da turma
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Mesa de revisão por questão</h1>
      <p className="mt-1 max-w-prose text-sm text-muted">
        Respostas dissertativas agrupadas por questão e priorizadas por baixa confiança, erro em cascata (ECF) e sinais
        de cola. Clique nas pílulas para recalcular na hora sem chamar a IA.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Carregando fila de revisão…</p>}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/diagnostico/revisao">["searchParams"] }) {
  await connection();
  const { atividade } = await searchParams;
  const atividadeId = typeof atividade === "string" ? atividade : "";
  const { professor } = await getProfessorAtual();
  const { atividades, questoes, resumo } = await carregarMesaRevisao(professor.id, atividadeId || undefined);

  return (
    <FilaRevisao
      atividades={atividades}
      atividadeSelecionada={atividadeId}
      questoes={questoes}
      totalPendentes={resumo.pendentes}
    />
  );
}
