"use client";

import Link from "next/link";
import { useState } from "react";
import type { ResultadosAtividade } from "@/lib/atividade-resultados";
import { Bolinhas } from "../../bolinhas";

const LIMIAR_LACUNA = 0.6;
import { IconeCheck } from "../../icones";
import { BotaoCorrigir } from "../../diagnostico/botao-corrigir";
import { FormNota } from "../../diagnostico/form-nota";
import { PilulasRevisao } from "../../diagnostico/pilulas-revisao";

const fmt10 = (d: number | null) =>
  d === null
    ? "—"
    : (Math.round(d * 100) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const pct = (d: number | null) => (d === null ? "—" : `${Math.round(d * 100)}%`);

export function PainelNotasProva({
  resultados,
  gabaritoNode,
}: {
  resultados: ResultadosAtividade;
  gabaritoNode: React.ReactNode;
}) {
  const temEntregas = resultados.resumo.totalEntregas > 0;
  const [aba, setAba] = useState<"questoes" | "alunos" | "gabarito">(temEntregas ? "questoes" : "gabarito");
  const { resumo, alunos, porQuestao } = resultados;

  return (
    <div className="space-y-6">
      {/* Resumo numérico da prova (média geral, objetivas e dissertativas) */}
      <section aria-label="Resumo de notas da prova" className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold text-muted">Entregas</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">
            {resumo.totalEntregas} <span className="text-base font-normal text-muted">de {resumo.totalAlunos}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            {resumo.pendentes > 0
              ? `${resumo.pendentes} dissertativa(s) pendente(s)`
              : resumo.naoLiberadas > 0
                ? `${resumo.naoLiberadas} aguardando liberação`
                : "Tudo corrigido"}
          </p>
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-muted">Nota média da prova</p>
          <p
            className={`mt-1 font-display text-2xl font-bold tabular-nums ${
              resumo.mediaGeral !== null && resumo.mediaGeral < LIMIAR_LACUNA ? "text-danger" : ""
            }`}
          >
            {fmt10(resumo.mediaGeral)}
            {resumo.mediaGeral !== null && <span className="text-sm font-normal text-muted">/10</span>}
          </p>
          {resumo.mediaGeral !== null ? (
            <div className="mt-1.5 flex items-center gap-2">
              <Bolinhas
                valor={resumo.mediaGeral}
                className={resumo.mediaGeral < LIMIAR_LACUNA ? "text-danger" : "text-ok"}
              />
              <span className="text-xs text-muted tabular-nums">{pct(resumo.mediaGeral)}</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted">Ainda sem entregas avaliadas</p>
          )}
        </div>

        <div className="card p-4">
          <p className="text-xs font-semibold text-muted">
            {resumo.totalDissertativas > 0 ? "Média das dissertativas" : "Média das objetivas"}
          </p>
          {resumo.totalDissertativas > 0 ? (
            <>
              <p
                className={`mt-1 font-display text-2xl font-bold tabular-nums ${
                  resumo.mediaDissertativas !== null && resumo.mediaDissertativas < LIMIAR_LACUNA ? "text-danger" : ""
                }`}
              >
                {fmt10(resumo.mediaDissertativas)}
                {resumo.mediaDissertativas !== null && <span className="text-sm font-normal text-muted">/10</span>}
              </p>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {resumo.totalObjetivas > 0
                  ? `Objetivas: ${fmt10(resumo.mediaObjetivas)}/10 (${pct(resumo.mediaObjetivas)})`
                  : `${pct(resumo.mediaDissertativas)} de domínio`}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 font-display text-2xl font-bold tabular-nums">
                {fmt10(resumo.mediaObjetivas)}
                {resumo.mediaObjetivas !== null && <span className="text-sm font-normal text-muted">/10</span>}
              </p>
              <p className="mt-1 text-xs text-muted tabular-nums">{pct(resumo.mediaObjetivas)} de acerto</p>
            </>
          )}
        </div>
      </section>

      {/* Abas de visualização */}
      <nav aria-label="Visualização da prova" className="flex flex-wrap gap-2">
        {(
          [
            { id: "questoes", rotulo: `Respostas por questão (${porQuestao.length})` },
            { id: "alunos", rotulo: `Notas por aluno (${resumo.totalEntregas}/${resumo.totalAlunos})` },
            { id: "gabarito", rotulo: "Gabarito e rubrica" },
          ] as const
        ).map((op) => {
          const ativa = aba === op.id;
          return (
            <button
              key={op.id}
              type="button"
              aria-pressed={ativa}
              onClick={() => setAba(op.id)}
              className={`inline-flex min-h-10 cursor-pointer items-center rounded-full border px-4 text-sm transition-colors ${
                ativa
                  ? "border-ink bg-hl font-semibold text-hl-ink"
                  : "border-line-strong bg-surface text-ink hover:bg-sunken"
              }`}
            >
              {op.rotulo}
            </button>
          );
        })}
      </nav>

      {/* ABA 1: Respostas de todos os alunos agrupadas por questão */}
      {aba === "questoes" && (
        <div className="space-y-6">
          {!temEntregas ? (
            <p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
              Nenhum aluno entregou esta prova ainda. Assim que as entregas chegarem, você verá todas as respostas
              agrupadas por questão aqui.
            </p>
          ) : (
            porQuestao.map((q, idx) => (
              <section key={q.questaoId} className="card space-y-4 p-5">
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted">
                      Questão {idx + 1} · {q.tipo === "dissertativa" ? "dissertativa" : "múltipla escolha"} ·{" "}
                      {q.topicoNome}
                    </p>
                    <p className="mt-1 text-[0.9375rem] font-medium whitespace-pre-wrap">{q.enunciado}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-muted">
                      {q.tipo === "dissertativa" ? "Média da questão" : "Taxa de acerto"}
                    </p>
                    <p
                      className={`font-display text-xl font-bold tabular-nums ${
                        q.mediaQuestao !== null && q.mediaQuestao < LIMIAR_LACUNA ? "text-danger" : ""
                      }`}
                    >
                      {q.tipo === "dissertativa" ? `${fmt10(q.mediaQuestao)}/10` : pct(q.mediaQuestao)}
                    </p>
                    <p className="text-xs text-muted">
                      {q.respondidas} {q.respondidas === 1 ? "resposta" : "respostas"}
                      {q.pendentes > 0 && ` · ${q.pendentes} pendente(s)`}
                    </p>
                  </div>
                </header>

                {q.tipo === "dissertativa" ? (
                  <ul className="space-y-3">
                    {q.respostas.map((r) => (
                      <li
                        key={r.respostaId}
                        className={`rounded-lg border p-3.5 ${
                          r.desconsiderada ? "border-danger/40 bg-sunken/50 opacity-80" : "border-line bg-surface"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/diagnostico/aluno/${r.alunoId}`}
                              className="font-semibold hover:text-link hover:underline"
                            >
                              {r.alunoNome}
                            </Link>
                            {r.pendente && <span className="badge badge-danger">pendente</span>}
                            {r.telemetria?.sinal_cola && <span className="badge badge-warn">texto colado</span>}
                            {r.correcaoV2?.teto_aplicado != null && (
                              <span className="badge badge-danger">teto {r.correcaoV2.teto_aplicado}%</span>
                            )}
                            {r.correcaoV2?.precisa_revisao && !r.revisadaEm && (
                              <span className="badge badge-warn">conferir</span>
                            )}
                            {r.revisadaEm && <span className="badge badge-ok">revisada</span>}
                            {r.desconsiderada && <span className="badge badge-danger">desconsiderada</span>}
                          </div>
                          <span
                            className={`font-display text-lg font-bold tabular-nums ${
                              r.nota !== null && r.nota < LIMIAR_LACUNA ? "text-danger" : ""
                            }`}
                          >
                            {r.pendente ? "—" : `${fmt10(r.nota)}/10`}
                          </span>
                        </div>

                        <p className="mt-2 rounded-lg bg-sunken p-3 text-sm whitespace-pre-wrap">{r.texto}</p>

                        {r.pendente ? (
                          <div className="mt-2">
                            <BotaoCorrigir respostaId={r.respostaId} />
                          </div>
                        ) : (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer font-medium text-link hover:underline">
                              Revisar pílulas / ajustar nota
                            </summary>
                            {r.correcaoV2 && q.rubrica ? (
                              <PilulasRevisao
                                respostaId={r.respostaId}
                                entregaId={r.entregaId}
                                rubrica={q.rubrica}
                                regrasGlobais={q.regrasGlobais}
                                correcaoV2={r.correcaoV2}
                                telemetria={r.telemetria}
                                revisadaEm={r.revisadaEm}
                                aguardandoLiberacao={r.aguardandoLiberacao}
                                desconsiderada={r.desconsiderada}
                              />
                            ) : (
                              <FormNota respostaId={r.respostaId} notaIa={r.notaIa} notaAjustada={r.notaAjustada} />
                            )}
                          </details>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {q.distribuicao.map((alt) => (
                      <li
                        key={alt.id}
                        className={`rounded-lg border px-3 py-2.5 ${
                          alt.correta ? "border-ok/40 bg-ok-soft/60" : "border-line bg-surface"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <span className={`bolha ${alt.correta ? "bolha-cheia" : ""}`}>{alt.letra}</span>
                            <div>
                              <span className={alt.correta ? "font-medium text-ok-ink" : ""}>{alt.texto}</span>
                              {!alt.correta && alt.equivoco && (
                                <span className="mt-0.5 block text-xs text-danger">Equívoco: {alt.equivoco}</span>
                              )}
                            </div>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-semibold tabular-nums text-muted">
                            {alt.correta && <IconeCheck className="text-ok" />}
                            {alt.alunos.length} {alt.alunos.length === 1 ? "aluno" : "alunos"}
                          </span>
                        </div>
                        {alt.alunos.length > 0 && (
                          <p className="mt-1.5 pl-8 text-xs text-muted">{alt.alunos.join(", ")}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))
          )}
        </div>
      )}

      {/* ABA 2: Tabela completa de notas por aluno (todos os alunos da turma) */}
      {aba === "alunos" && (
        <div className="card overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th scope="col" className="sticky left-0 bg-surface px-3 py-2.5 text-left font-semibold">
                  Aluno
                </th>
                <th scope="col" className="px-2 py-2.5 text-left font-semibold">
                  Status
                </th>
                {porQuestao.map((q, idx) => (
                  <th key={q.questaoId} scope="col" className="px-2 py-2.5 text-center font-semibold">
                    Q{idx + 1}
                    <span className="block text-[10px] font-normal">
                      {q.tipo === "dissertativa" ? "diss." : "obj."}
                    </span>
                  </th>
                ))}
                {resumo.totalDissertativas > 0 && (
                  <th scope="col" className="px-2 py-2.5 text-center font-semibold">
                    Dissertativas
                  </th>
                )}
                <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                  Nota final
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr className="bg-sunken/70 font-semibold">
                <th scope="row" className="sticky left-0 bg-sunken/70 px-3 py-2 text-left">
                  Turma (média)
                </th>
                <td className="px-2 py-2 text-xs text-muted">
                  {resumo.totalEntregas}/{resumo.totalAlunos}
                </td>
                {porQuestao.map((q) => (
                  <td key={q.questaoId} className="px-2 py-2 text-center tabular-nums">
                    {fmt10(q.mediaQuestao)}
                  </td>
                ))}
                {resumo.totalDissertativas > 0 && (
                  <td className="px-2 py-2 text-center tabular-nums">{fmt10(resumo.mediaDissertativas)}</td>
                )}
                <td className="px-3 py-2 text-right font-display tabular-nums">{fmt10(resumo.mediaGeral)}/10</td>
              </tr>

              {alunos.map((a) => (
                <tr key={a.alunoId} className={a.desconsiderada ? "opacity-60" : ""}>
                  <th scope="row" className="sticky left-0 bg-surface px-3 py-2 text-left font-normal whitespace-nowrap">
                    <Link href={`/diagnostico/aluno/${a.alunoId}`} className="hover:text-link hover:underline">
                      {a.nome}
                    </Link>
                  </th>
                  <td className="px-2 py-2">
                    {!a.entregou ? (
                      <span className="badge badge-neutral">não entregou</span>
                    ) : a.desconsiderada ? (
                      <span className="badge badge-danger">desconsiderada</span>
                    ) : a.temPendente ? (
                      <span className="badge badge-danger">pendente</span>
                    ) : a.aguardandoLiberacao ? (
                      <span className="badge badge-warn">retida</span>
                    ) : (
                      <span className="badge badge-ok">entregue</span>
                    )}
                  </td>
                  {porQuestao.map((q) => {
                    const cel = a.notasPorQuestao[q.questaoId];
                    return (
                      <td key={q.questaoId} className="px-2 py-2 text-center tabular-nums">
                        {!a.entregou ? (
                          <span className="text-muted">—</span>
                        ) : cel?.pendente ? (
                          <span className="text-xs text-danger">pend.</span>
                        ) : cel?.nota == null ? (
                          <span className="text-muted">—</span>
                        ) : (
                          <span className={cel.nota < LIMIAR_LACUNA ? "font-medium text-danger" : "text-ok-ink"}>
                            {fmt10(cel.nota)}
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {resumo.totalDissertativas > 0 && (
                    <td className="px-2 py-2 text-center tabular-nums">
                      {a.mediaDissertativas === null ? (
                        <span className="text-muted">—</span>
                      ) : (
                        <span className={a.mediaDissertativas < LIMIAR_LACUNA ? "font-semibold text-danger" : ""}>
                          {fmt10(a.mediaDissertativas)}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-display font-bold tabular-nums">
                    {a.notaFinal === null ? (
                      <span className="font-normal text-muted">—</span>
                    ) : (
                      <span className={a.notaFinal < LIMIAR_LACUNA ? "text-danger" : ""}>
                        {fmt10(a.notaFinal)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ABA 3: Gabarito e Rubrica */}
      {aba === "gabarito" && gabaritoNode}
    </div>
  );
}
