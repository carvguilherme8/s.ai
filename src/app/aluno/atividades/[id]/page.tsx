import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { FormResponder, type QuestaoParaResponder } from "../../form-responder";

export const metadata = { title: "Atividade — s.ai" };

const LETRAS = "ABCDEFGH";

type ItemFeedback = {
  questao_id: string;
  nota: number | null;
  explicacao: string | null;
  revisar: { pagina: number; trecho: string | null } | null;
};
type Feedback = { resumo: string | null; itens: ItemFeedback[] };
type CriterioCorrecao = { criterio: string; pontos: number; obtidos: number; comentario: string };

export default function Page({ params }: PageProps<"/aluno/atividades/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/aluno" className="text-sm text-zinc-500 hover:underline">← Minhas atividades</Link>
      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params }: { params: PageProps<"/aluno/atividades/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  const { supabase } = sessao;

  const { data: atividade } = await supabase
    .from("atividades").select("id, titulo, prazo").eq("id", id).eq("status", "publicada").maybeSingle();
  if (!atividade) notFound();

  const { data: entrega } = await supabase
    .from("entregas").select("id, enviada_em, feedback").eq("atividade_id", id).maybeSingle();

  // ---------- Ainda não entregou: mostra só as questões, sem gabarito ----------
  if (!entrega) {
    const encerrada = atividade.prazo && new Date(atividade.prazo) < new Date();
    const { data } = await supabase.rpc("questoes_para_responder", { p_atividade: id });
    const questoes = (data ?? []) as unknown as QuestaoParaResponder[];
    return (
      <div className="mt-2 space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{atividade.titulo}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {questoes.length} questões
            {atividade.prazo && ` · prazo ${new Date(atividade.prazo).toLocaleDateString("pt-BR")}`}
          </p>
        </header>
        {encerrada ? (
          <p className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">O prazo desta atividade terminou.</p>
        ) : (
          <FormResponder atividadeId={id} questoes={questoes} />
        )}
      </div>
    );
  }

  // ---------- Já entregou: resultado e feedback (RLS libera gabarito após a entrega) ----------
  const [{ data: questoes }, { data: respostas }] = await Promise.all([
    supabase
      .from("questoes")
      .select("id, tipo, ordem, enunciado, topico:topicos(nome), alternativas(id, ordem, texto, correta, equivoco)")
      .eq("atividade_id", id).order("ordem"),
    supabase.from("respostas").select("questao_id, alternativa_id, texto, nota_ia, nota_ajustada, correcao")
      .eq("entrega_id", entrega.id),
  ]);
  const feedback = (entrega.feedback ?? { resumo: null, itens: [] }) as unknown as Feedback;
  const porQuestao = new Map(respostas?.map((r) => [r.questao_id, r]));
  const itemDe = new Map(feedback.itens.map((i) => [i.questao_id, i]));

  const notaDe = (qid: string) => {
    const r = porQuestao.get(qid);
    return r ? (r.nota_ajustada ?? r.nota_ia) : null;
  };
  const total = questoes?.length ?? 0;
  const pontos = questoes?.reduce((s, q) => s + (notaDe(q.id) ?? 0), 0) ?? 0;

  return (
    <div className="mt-2 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{atividade.titulo}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Entregue em {new Date(entrega.enviada_em).toLocaleDateString("pt-BR")} · você fez{" "}
          <strong className="text-zinc-900 dark:text-zinc-100">{pontos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de {total}</strong>
        </p>
      </header>

      {feedback.resumo && (
        <section className="rounded-lg bg-emerald-50 p-4 text-sm dark:bg-emerald-950/40">
          <h2 className="mb-1 font-medium">O que revisar</h2>
          <p>{feedback.resumo}</p>
        </section>
      )}

      <ol className="space-y-4">
        {questoes?.map((q, i) => {
          const r = porQuestao.get(q.id);
          const nota = notaDe(q.id);
          const item = itemDe.get(q.id);
          const alts = [...q.alternativas].sort((a, b) => a.ordem - b.ordem);
          const correcao = r?.correcao as { criterios?: CriterioCorrecao[]; comentario?: string; pendente?: boolean } | null;
          const status = nota === null ? "em correção" : nota >= 1 ? "certa" : nota > 0 ? "parcial" : "errada";
          const cor = status === "certa" ? "border-emerald-300 dark:border-emerald-800"
            : status === "errada" ? "border-red-300 dark:border-red-900" : "border-amber-300 dark:border-amber-800";
          return (
            <li key={q.id} className={`rounded-lg border p-4 ${cor}`}>
              <p className="mb-2 flex justify-between text-xs text-zinc-500">
                <span>Questão {i + 1} · {q.topico?.nome}</span>
                <span className="font-medium">{status}</span>
              </p>
              <p className="whitespace-pre-wrap text-sm">{q.enunciado}</p>

              {q.tipo === "multipla_escolha" ? (
                <ul className="mt-3 space-y-1 text-sm">
                  {alts.map((a, j) => {
                    const escolhida = a.id === r?.alternativa_id;
                    return (
                      <li key={a.id} className={a.correta ? "font-medium text-emerald-700 dark:text-emerald-400" : escolhida ? "text-red-600" : "text-zinc-500"}>
                        {LETRAS[j]}) {a.texto}
                        {escolhida && " ← sua resposta"}
                        {a.correta && " ✓"}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="rounded-md bg-zinc-50 p-3 whitespace-pre-wrap dark:bg-zinc-900">{r?.texto}</p>
                  {correcao?.criterios && (
                    <ul className="space-y-0.5 text-zinc-600 dark:text-zinc-400">
                      {correcao.criterios.map((c) => (
                        <li key={c.criterio}>
                          <strong>{c.obtidos}/{c.pontos}</strong> — {c.criterio}
                          {c.comentario && <span className="text-zinc-500"> ({c.comentario})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {correcao?.comentario && !item?.explicacao && <p>{correcao.comentario}</p>}
                  {correcao?.pendente &&<p className="text-zinc-500">A correção desta resposta ainda não ficou pronta.</p>}
                </div>
              )}

              {item?.explicacao && <p className="mt-3 text-sm">{item.explicacao}</p>}
              {item?.revisar && (
                <p className="mt-2 rounded-md bg-zinc-50 p-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                  <strong>Revise no material, p. {item.revisar.pagina}:</strong> {item.revisar.trecho}
                  {item.revisar.trecho && item.revisar.trecho.length >= 280 ? "…" : ""}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
