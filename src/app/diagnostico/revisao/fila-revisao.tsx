"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  normalizarPesosPara100,
  somaPesosPositivos,
  type RubricaV2,
} from "@/lib/nota-rubrica";
import type { PadraoInesperado, QuestaoRevisao } from "@/lib/revisao-dissertativas";
import {
  analisarPadroesInesperados,
  aplicarPadraoInesperado,
  liberarEntregasAtividade,
  recalcularPesoQuestaoEmLote,
  recorrigirPendentesEmLote,
  type EstadoPadroes,
  type EstadoResumo,
} from "../actions";
import { BotaoCorrigir } from "../botao-corrigir";
import { FormNota } from "../form-nota";
import { PilulasRevisao } from "../pilulas-revisao";
import { IconeAtualizar, IconeFaisca } from "../../icones";

function CardQuestaoRevisao({ q }: { q: QuestaoRevisao }) {
  const [abrirPesos, setAbrirPesos] = useState(false);
  const [rubricaEdit, setRubricaEdit] = useState<RubricaV2>(q.rubrica);

  const [estadoPeso, acaoPeso, salvandoPeso] = useActionState<EstadoResumo, FormData>(
    recalcularPesoQuestaoEmLote,
    undefined,
  );
  const [estadoPadroes, acaoPadroes, analisandoPadroes] = useActionState<EstadoPadroes, FormData>(
    analisarPadroesInesperados,
    {},
  );
  const [estadoAplicar, acaoAplicar, aplicandoPadrao] = useActionState<EstadoResumo, FormData>(
    aplicarPadraoInesperado,
    undefined,
  );
  const [estadoLiberar, acaoLiberar, liberando] = useActionState<EstadoResumo, FormData>(
    liberarEntregasAtividade,
    undefined,
  );

  const pendentes = q.respostas.filter((r) => r.pendente).length;
  const sinalizadas = q.respostas.filter(
    (r) => !r.revisadaEm && (r.telemetria?.sinal_cola || r.correcaoV2?.precisa_revisao),
  ).length;
  const revisadas = q.respostas.filter((r) => Boolean(r.revisadaEm)).length;
  const soma = somaPesosPositivos(rubricaEdit.positivos);

  return (
    <section className="card space-y-5 p-5">
      <header className="space-y-2 border-b border-line pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted">
              {q.turmaNome} · {q.atividadeTitulo} · tópico: {q.topicoNome}
            </p>
            <p className="mt-1.5 text-[0.9375rem] font-medium whitespace-pre-wrap">{q.enunciado}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="badge badge-neutral">{q.respostas.length} respostas</span>
            {pendentes > 0 && <span className="badge badge-danger">{pendentes} pendente(s)</span>}
            {sinalizadas > 0 && <span className="badge badge-warn">{sinalizadas} sinalizada(s)</span>}
            <span className="badge badge-ok">{revisadas} revisada(s)</span>
          </div>
        </div>

        {/* Ferramentas rápidas da questão: Pesos em lote, Rubrica Reversa e Liberar turma */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setAbrirPesos((v) => !v)}
            className="btn btn-secondary btn-sm text-xs"
          >
            {abrirPesos ? "Fechar ajuste de pesos" : "Ajustar pesos e recalcular turma (sem IA)"}
          </button>

          {q.respostas.length >= 3 && (
            <form action={acaoPadroes}>
              <input type="hidden" name="questao_id" value={q.questaoId} />
              <button disabled={analisandoPadroes} className="btn btn-secondary btn-sm text-xs">
                <IconeFaisca />
                {analisandoPadroes ? "Analisando turma…" : "Detectar padrões inesperados (Rubrica Reversa)"}
              </button>
            </form>
          )}

          {q.revisarAntesLiberar && q.naoLiberadas > 0 && (
            <form action={acaoLiberar}>
              <input type="hidden" name="atividade_id" value={q.atividadeId} />
              <button disabled={liberando} className="btn btn-primary btn-sm text-xs">
                {liberando ? "Liberando…" : `Liberar notas para ${q.naoLiberadas} aluno(s)`}
              </button>
            </form>
          )}
        </div>

        {estadoLiberar?.ok && <p role="status" className="text-xs text-ok">{estadoLiberar.ok}</p>}
        {estadoPeso?.erro && <p role="alert" className="text-xs text-danger">{estadoPeso.erro}</p>}
        {estadoPeso?.ok && <p role="status" className="text-xs text-ok">{estadoPeso.ok}</p>}
        {estadoPadroes.erro && <p role="alert" className="text-xs text-danger">{estadoPadroes.erro}</p>}
        {estadoAplicar?.erro && <p role="alert" className="text-xs text-danger">{estadoAplicar.erro}</p>}
        {estadoAplicar?.ok && <p role="status" className="text-xs text-ok">{estadoAplicar.ok}</p>}
      </header>

      {/* Painel de recálculo dinâmico de pesos (estilo Gradescope) */}
      {abrirPesos && (
        <form action={acaoPeso} className="space-y-3 rounded-lg bg-sunken p-3 text-xs">
          <input type="hidden" name="questao_id" value={q.questaoId} />
          <input type="hidden" name="rubrica_json" value={JSON.stringify(rubricaEdit)} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-ink">Recálculo dinâmico de pesos (0 tokens de IA)</strong>
            <div className="flex items-center gap-2">
              <span className={Math.round(soma) === 100 ? "text-ok font-semibold" : "font-semibold"}>
                Soma positivos: {Math.round(soma)}%
              </span>
              {Math.round(soma) !== 100 && (
                <button
                  type="button"
                  onClick={() =>
                    setRubricaEdit((r) => ({ ...r, positivos: normalizarPesosPara100(r.positivos) }))
                  }
                  className="btn btn-secondary btn-sm text-xs"
                >
                  Normalizar 100%
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {rubricaEdit.positivos.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={c.peso}
                  onChange={(e) =>
                    setRubricaEdit((r) => ({
                      ...r,
                      positivos: r.positivos.map((x) =>
                        x.id === c.id ? { ...x, peso: Math.max(1, Number(e.target.value) || 0) } : x,
                      ),
                    }))
                  }
                  className="field w-16 py-1 font-mono text-xs tabular-nums"
                />
                <span className="flex-1 text-ink">+% — {c.texto}</span>
              </div>
            ))}
            {rubricaEdit.penalidades
              .filter((p) => p.ativa !== false)
              .map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={p.valor}
                    onChange={(e) =>
                      setRubricaEdit((r) => ({
                        ...r,
                        penalidades: r.penalidades.map((x) =>
                          x.id === p.id
                            ? { ...x, valor: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }
                            : x,
                        ),
                      }))
                    }
                    className="field w-16 py-1 font-mono text-xs tabular-nums"
                  />
                  <span className="flex-1 text-danger">
                    {p.modo === "teto" ? "Teto %" : "−%"} — {p.texto}
                  </span>
                </div>
              ))}
          </div>

          <button disabled={salvandoPeso} className="btn btn-primary btn-sm text-xs">
            {salvandoPeso ? "Recalculando turma…" : "Salvar pesos e recalcular todas as respostas"}
          </button>
        </form>
      )}

      {/* Alertas de Rubrica Reversa (padrões inesperados em >= 3 alunos) */}
      {estadoPadroes.analisado && (
        <div className="space-y-2">
          {!estadoPadroes.padroes?.length ? (
            <p className="rounded-lg bg-ok-soft px-3 py-2 text-xs text-ok-ink">
              Nenhum padrão inesperado recorrente (em 3 ou mais alunos) encontrado fora das pílulas atuais.
            </p>
          ) : (
            estadoPadroes.padroes.map((padrao: PadraoInesperado) => (
              <div
                key={padrao.descricao}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/30 bg-warn-soft/70 p-3 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-semibold text-ink">
                    <span className="grifo">
                      Padrão detectado em {padrao.resposta_ids.length} alunos:
                    </span>{" "}
                    {padrao.descricao}
                  </p>
                  <p className="text-muted">
                    Sugestão:{" "}
                    <strong>
                      {padrao.modo === "teto" ? `Teto ${padrao.valor}%` : `Desconto −${padrao.valor}%`}
                    </strong>{" "}
                    · Equívoco no Diagnóstico: {padrao.equivoco}
                  </p>
                </div>
                <form action={acaoAplicar}>
                  <input type="hidden" name="questao_id" value={q.questaoId} />
                  <input type="hidden" name="padrao_json" value={JSON.stringify(padrao)} />
                  <button disabled={aplicandoPadrao} className="btn btn-primary btn-sm text-xs">
                    {aplicandoPadrao ? "Aplicando…" : "Criar pílula e recalcular turma"}
                  </button>
                </form>
              </div>
            ))
          )}
        </div>
      )}

      {/* Fila de respostas priorizada */}
      {q.respostas.length === 0 ? (
        <p className="text-sm text-muted">Nenhum aluno entregou esta questão ainda.</p>
      ) : (
        <ul className="space-y-4">
          {q.respostas.map((r) => (
            <li
              key={r.respostaId}
              className={`rounded-xl border p-4 ${
                r.desconsiderarDiagnostico
                  ? "border-danger/40 bg-sunken/50 opacity-80"
                  : r.pendente || r.telemetria?.sinal_cola || (r.correcaoV2?.precisa_revisao && !r.revisadaEm)
                    ? "border-ink/40 bg-surface"
                    : "border-line bg-surface"
              }`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link
                  href={`/diagnostico/aluno/${r.alunoId}`}
                  className="font-semibold hover:text-link hover:underline"
                >
                  {r.alunoNome}
                </Link>
                {q.revisarAntesLiberar && !r.liberadaEm && (
                  <span className="badge badge-warn">Retida (não liberada ao aluno)</span>
                )}
              </div>

              <p className="mt-2 rounded-lg bg-sunken p-3 text-sm whitespace-pre-wrap">{r.texto}</p>

              {r.pendente ? (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <p className="text-xs text-muted">Correção por IA pendente.</p>
                  <BotaoCorrigir respostaId={r.respostaId} />
                </div>
              ) : r.correcaoV2 ? (
                <PilulasRevisao
                  respostaId={r.respostaId}
                  entregaId={r.entregaId}
                  rubrica={q.rubrica}
                  regrasGlobais={q.regrasGlobais}
                  correcaoV2={r.correcaoV2}
                  telemetria={r.telemetria}
                  revisadaEm={r.revisadaEm}
                  aguardandoLiberacao={q.revisarAntesLiberar && !r.liberadaEm}
                  desconsiderada={r.desconsiderarDiagnostico}
                />
              ) : (
                <FormNota respostaId={r.respostaId} notaIa={r.notaIa} notaAjustada={r.notaAjustada} />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FilaRevisao({
  atividades,
  atividadeSelecionada,
  questoes,
  totalPendentes,
}: {
  atividades: { id: string; titulo: string; turmaNome: string; naoLiberadas: number }[];
  atividadeSelecionada: string;
  questoes: QuestaoRevisao[];
  totalPendentes: number;
}) {
  const [estadoLote, acaoLote, corrigindoLote] = useActionState<EstadoResumo, FormData>(
    recorrigirPendentesEmLote,
    undefined,
  );

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Filtrar por atividade" className="flex flex-wrap items-center gap-2">
          <Link
            href="/diagnostico/revisao"
            className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs transition-colors ${
              !atividadeSelecionada
                ? "border-ink bg-hl font-semibold text-hl-ink"
                : "border-line-strong bg-surface hover:bg-sunken"
            }`}
          >
            Todas ({atividades.length})
          </Link>
          {atividades.map((a) => (
            <Link
              key={a.id}
              href={`/diagnostico/revisao?atividade=${a.id}`}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs transition-colors ${
                atividadeSelecionada === a.id
                  ? "border-ink bg-hl font-semibold text-hl-ink"
                  : "border-line-strong bg-surface hover:bg-sunken"
              }`}
            >
              <span>
                {a.turmaNome} · {a.titulo}
              </span>
              {a.naoLiberadas > 0 && <span className="badge badge-warn">{a.naoLiberadas}</span>}
            </Link>
          ))}
        </nav>

        {totalPendentes > 0 && (
          <form action={acaoLote}>
            <input type="hidden" name="atividade_id" value={atividadeSelecionada} />
            <button disabled={corrigindoLote} className="btn btn-primary btn-sm text-xs">
              <IconeAtualizar />
              {corrigindoLote ? "Corrigindo pendentes…" : `Re-corrigir ${totalPendentes} pendente(s) em lote`}
            </button>
          </form>
        )}
      </div>

      {estadoLote?.erro && <p role="alert" className="text-sm text-danger">{estadoLote.erro}</p>}
      {estadoLote?.ok && <p role="status" className="text-sm text-ok">{estadoLote.ok}</p>}

      {questoes.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
          Nenhuma questão dissertativa publicada para revisar ainda.
        </p>
      ) : (
        <div className="space-y-8">
          {questoes.map((q) => (
            <CardQuestaoRevisao key={q.questaoId} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}
