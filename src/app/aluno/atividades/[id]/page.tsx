import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { chaveRascunhoLocal, FormResponder, type QuestaoParaResponder } from "../../form-responder";
import { IconeCheck, IconeLivro, IconeVoltar, IconeX } from "../../../icones";
import { AtualizadorPendente, LimparRascunhoLocal } from "./atualizador-pendente";

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
type CorrecaoJson = {
  criterios?: CriterioCorrecao[];
  comentario?: string;
  pendente?: boolean;
  overrides_professor?: { comentario_professor?: string | null };
};

export default function Page({ params }: PageProps<"/aluno/atividades/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/aluno" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
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
  const { supabase, user } = sessao;

  const { data: atividade } = await supabase
    .from("atividades")
    .select("id, titulo, prazo, material_id, revisar_antes_liberar")
    .eq("id", id)
    .eq("status", "publicada")
    .maybeSingle();
  if (!atividade) notFound();

  const { data: entrega } = await supabase
    .from("entregas")
    .select("id, enviada_em, liberada_em, feedback")
    .eq("atividade_id", id)
    .maybeSingle();

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
          <FormResponder atividadeId={id} alunoId={user.id} questoes={questoes} />
        )}
      </div>
    );
  }

  // ---------- Já entregou: resultado e feedback (RLS libera gabarito após a entrega) ----------
  const [{ data: questoes }, { data: respostas }] = await Promise.all([
    supabase
      .from("questoes")
      .select("id, tipo, ordem, enunciado, topico:topicos(nome), alternativas(id, ordem, texto, correta, equivoco)")
      .eq("atividade_id", id)
      .order("ordem"),
    supabase
      .from("respostas")
      .select("questao_id, alternativa_id, texto, nota_ia, nota_ajustada, correcao, revisada_em")
      .eq("entrega_id", entrega.id),
  ]);

  const aguardandoRevisao = Boolean(atividade.revisar_antes_liberar && !entrega.liberada_em);
  const feedback = (entrega.feedback ?? { resumo: null, itens: [] }) as unknown as Feedback;
  const porQuestao = new Map(respostas?.map((r) => [r.questao_id, r]));
  const itemDe = new Map(feedback.itens.map((i) => [i.questao_id, i]));

  const notaVisivelDe = (qid: string, tipo: "multipla_escolha" | "dissertativa") => {
    if (tipo === "dissertativa" && aguardandoRevisao) return null;
    const r = porQuestao.get(qid);
    return r ? (r.nota_ajustada ?? r.nota_ia) : null;
  };

  const temPendente =
    !aguardandoRevisao &&
    (questoes ?? []).some((q) => {
      if (q.tipo !== "dissertativa") return false;
      const r = porQuestao.get(q.id);
      const corr = r?.correcao as CorrecaoJson | null;
      return r?.nota_ia === null && r?.nota_ajustada === null && Boolean(corr?.pendente);
    });

  const avaliadas = (questoes ?? []).filter((q) => notaVisivelDe(q.id, q.tipo) !== null);
  const pontos = avaliadas.reduce((s, q) => s + (notaVisivelDe(q.id, q.tipo) ?? 0), 0);

  return (
    <div className="mt-2 space-y-6">
      <LimparRascunhoLocal chave={chaveRascunhoLocal(id, user.id)} />

      <header>
        <h1 className="text-3xl font-bold tracking-tight">{atividade.titulo}</h1>
        <p className="mt-1 text-sm text-muted">
          Entregue em {new Date(entrega.enviada_em).toLocaleDateString("pt-BR")}
          {avaliadas.length > 0 && (
            <>
              {" · "}você fez{" "}
              <strong className="text-ink">
                {pontos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} de {avaliadas.length}
              </strong>
              {avaliadas.length < (questoes?.length ?? 0) && " (dissertativas em revisão)"}
            </>
          )}
        </p>
      </header>

      {aguardandoRevisao && (
        <section className="card bg-sunken p-4 text-sm">
          <p className="font-semibold text-ink">
            <span className="grifo">Dissertativas aguardando revisão da professora</span>
          </p>
          <p className="mt-1 text-muted">
            Suas questões objetivas já estão corrigidas abaixo. A nota e o retorno das dissertativas aparecerão assim
            que a professora concluir a revisão.
          </p>
        </section>
      )}

      <AtualizadorPendente ativo={temPendente} />

      {feedback.resumo && (
        <section className="card p-5">
          <h2 className="mb-2 text-lg font-bold">
            <span className="grifo">O que revisar</span>
          </h2>
          <p className="max-w-prose">{feedback.resumo}</p>
        </section>
      )}

      <ol className="space-y-4">
        {questoes?.map((q, i) => {
          const r = porQuestao.get(q.id);
          const ocultaPorTrava = q.tipo === "dissertativa" && aguardandoRevisao;
          const nota = notaVisivelDe(q.id, q.tipo);
          const item = ocultaPorTrava ? undefined : itemDe.get(q.id);
          const alts = [...q.alternativas].sort((a, b) => a.ordem - b.ordem);
          const correcao = r?.correcao as CorrecaoJson | null;
          const comentarioProfessor = correcao?.overrides_professor?.comentario_professor?.trim() || null;

          const status = ocultaPorTrava
            ? "aguardando revisão"
            : nota === null
              ? "em correção"
              : nota >= 1
                ? "certa"
                : nota > 0
                  ? "parcial"
                  : "errada";
          const cor =
            status === "certa" ? "border-ok/40" : status === "errada" ? "border-danger/40" : "border-line-strong";
          const selo =
            status === "certa"
              ? "badge-ok"
              : status === "errada"
                ? "badge-danger"
                : status === "parcial"
                  ? "badge-warn"
                  : "badge-neutral";

          return (
            <li key={q.id} className={`card p-5 ${cor}`}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <p className="text-xs text-muted">
                  Questão {i + 1} · {q.topico?.nome}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {r?.revisada_em && !ocultaPorTrava && (
                    <span className="badge badge-ok">revisada pela professora</span>
                  )}
                  <span className={`badge gap-1 ${selo}`}>
                    {status === "certa" && <IconeCheck />}
                    {status === "errada" && <IconeX />}
                    {status}
                  </span>
                </div>
              </div>
              <p className="text-[0.9375rem] whitespace-pre-wrap">{q.enunciado}</p>

              {q.tipo === "multipla_escolha" ? (
                <ul className="mt-4 space-y-1.5 text-sm">
                  {alts.map((a, j) => {
                    const escolhida = a.id === r?.alternativa_id;
                    const tom = a.correta
                      ? "bg-ok-soft text-ok-ink"
                      : escolhida
                        ? "bg-danger-soft text-danger"
                        : "text-muted";
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
                  {ocultaPorTrava ? (
                    <p className="text-xs text-muted">
                      Sua resposta foi registrada e aguarda revisão da professora.
                    </p>
                  ) : (
                    <>
                      {correcao?.criterios && correcao.criterios.length > 0 && (
                        <ul className="space-y-1 text-muted">
                          {correcao.criterios.map((c) => (
                            <li key={c.criterio}>
                              <strong className="tabular-nums text-ink">
                                {c.obtidos}/{c.pontos}
                              </strong>{" "}
                              — {c.criterio}
                              {c.comentario && <span className="text-muted"> ({c.comentario})</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {comentarioProfessor && (
                        <p className="rounded-lg bg-ok-soft/60 px-3 py-2 text-ok-ink">
                          <strong>Comentário da professora:</strong> {comentarioProfessor}
                        </p>
                      )}
                      {!comentarioProfessor && correcao?.comentario && !item?.explicacao && (
                        <p>{correcao.comentario}</p>
                      )}
                      {correcao?.pendente && (
                        <p className="text-muted">A correção desta resposta está sendo processada.</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {!comentarioProfessor && item?.explicacao && (
                <p className="mt-4 max-w-prose text-sm">{item.explicacao}</p>
              )}
              {item?.revisar && (
                <p className="mt-3 flex items-start gap-2 rounded-lg bg-sunken p-3 text-xs leading-[1.95] text-muted">
                  <IconeLivro className="mt-0.5 text-base" />
                  <span>
                    <strong className="text-ink">Revise no material, p. {item.revisar.pagina}:</strong>{" "}
                    <span className="grifo">
                      {item.revisar.trecho}
                      {item.revisar.trecho && item.revisar.trecho.length >= 280 ? "…" : ""}
                    </span>
                  </span>
                </p>
              )}
              {item?.revisar && atividade.material_id && (
                <Link
                  href={`/aluno/materiais/${atividade.material_id}?p=${item.revisar.pagina}#p${item.revisar.pagina}`}
                  className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-link hover:underline"
                >
                  Abrir a página {item.revisar.pagina} do material
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
