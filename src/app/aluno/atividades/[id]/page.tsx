import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { FormResponder, type QuestaoParaResponder } from "../../form-responder";
import { IconeCheck, IconeLivro, IconeVoltar, IconeX } from "../../../icones";

export const metadata = { title: "Atividade — s.ai" };

// Ações de IA nesta página demoram; permite até 300s no servidor (ver docs/DEPLOY.md).
export const maxDuration = 300;

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
      <Link href="/aluno" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconeVoltar /> Minhas atividades
      </Link>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Carregando…</p>}>
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
          <h1 className="text-3xl font-bold tracking-tight">{atividade.titulo}</h1>
          <p className="mt-1 text-sm text-muted">
            {questoes.length} questões
            {atividade.prazo && ` · prazo ${new Date(atividade.prazo).toLocaleDateString("pt-BR")}`}
          </p>
        </header>
        {encerrada ? (
          <p className="card p-4 text-sm">O prazo desta atividade terminou.</p>
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
        <h1 className="text-3xl font-bold tracking-tight">{atividade.titulo}</h1>
        <p className="mt-1 text-sm text-muted">
          Entregue em {new Date(entrega.enviada_em).toLocaleDateString("pt-BR")} · você fez{" "}
          <strong className="text-ink">{pontos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de {total}</strong>
        </p>
      </header>

      {feedback.resumo && (
        <section className="card p-5">
          <h2 className="mb-2 text-lg font-bold"><span className="grifo">O que revisar</span></h2>
          <p className="max-w-prose">{feedback.resumo}</p>
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
          const cor = status === "certa" ? "border-ok/40" : status === "errada" ? "border-danger/40" : "border-line-strong";
          const selo = status === "certa" ? "badge-ok" : status === "errada" ? "badge-danger" : status === "parcial" ? "badge-warn" : "badge-neutral";
          return (
            <li key={q.id} className={`card p-5 ${cor}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-xs text-muted">Questão {i + 1} · {q.topico?.nome}</p>
                <span className={`badge gap-1 ${selo}`}>
                  {status === "certa" && <IconeCheck />}
                  {status === "errada" && <IconeX />}
                  {status}
                </span>
              </div>
              <p className="text-[0.9375rem] whitespace-pre-wrap">{q.enunciado}</p>

              {q.tipo === "multipla_escolha" ? (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {alts.map((a, j) => {
                    const escolhida = a.id === r?.alternativa_id;
                    const tom = a.correta ? "bg-ok-soft text-ok-ink" : escolhida ? "bg-danger-soft text-danger" : "text-muted";
                    return (
                      <li key={a.id} className={`flex items-start gap-3 rounded-lg px-3 py-2 ${tom}`}>
                        <span className={`bolha ${escolhida ? "bolha-cheia" : ""}`}>{LETRAS[j]}</span>
                        <span className="flex-1">{a.texto}</span>
                        {escolhida && <span className="shrink-0 text-xs font-medium">sua resposta</span>}
                        {a.correta && <IconeCheck className="mt-0.5" aria-label="resposta correta" />}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="mt-3 space-y-2 text-sm">
                  <p className="rounded-lg bg-sunken p-3 whitespace-pre-wrap">{r?.texto}</p>
                  {correcao?.criterios && (
                    <ul className="space-y-0.5 text-muted">
                      {correcao.criterios.map((c) => (
                        <li key={c.criterio}>
                          <strong>{c.obtidos}/{c.pontos}</strong> — {c.criterio}
                          {c.comentario && <span className="text-muted"> ({c.comentario})</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {correcao?.comentario && !item?.explicacao && <p>{correcao.comentario}</p>}
                  {correcao?.pendente && <p className="text-muted">A correção desta resposta ainda não ficou pronta.</p>}
                </div>
              )}

              {item?.explicacao && <p className="mt-4 max-w-prose text-sm">{item.explicacao}</p>}
              {item?.revisar && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-sunken p-3 text-xs leading-[1.95] text-muted">
                  <IconeLivro className="mt-0.5 text-base" />
                  <span>
                    <strong className="text-ink">Revise no material, p. {item.revisar.pagina}:</strong> <span className="grifo">{item.revisar.trecho}{item.revisar.trecho && item.revisar.trecho.length >= 280 ? "…" : ""}</span>
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
