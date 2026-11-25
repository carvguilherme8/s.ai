"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { IconeCheck, IconeFaisca, IconeLivro, IconeX } from "../../../icones";
import {
  corrigirReforcoIndividual,
  gerarReforcoIndividual,
  type EstadoCorrecao,
  type EstadoGeracao,
  type ResultadoReforco,
  type SessaoReforco,
} from "../actions";

const LETRAS = "ABCDEFGH";

export function PraticaReforco({ topicoId }: { topicoId: string }) {
  const [sessao, setSessao] = useState<SessaoReforco | null>(null);
  const [resultado, setResultado] = useState<ResultadoReforco | null>(null);
  const [escolhas, setEscolhas] = useState<Record<string, string>>({});

  const [estadoGerar, acaoGerar, gerando] = useActionState<EstadoGeracao, FormData>(async (prev, fd) => {
    const res = await gerarReforcoIndividual(prev, fd);
    if (res?.sessao) {
      setSessao(res.sessao);
      setResultado(null);
      setEscolhas({});
    }
    return res;
  }, undefined);

  const [estadoCorrigir, acaoCorrigir, corrigindo] = useActionState<EstadoCorrecao, FormData>(async (prev, fd) => {
    const res = await corrigirReforcoIndividual(prev, fd);
    if (res?.resultado) {
      setResultado(res.resultado);
    }
    return res;
  }, undefined);

  // Estado inicial (ainda não gerou questões)
  if (!sessao) {
    return (
      <section className="card space-y-4 p-5">
        <p className="max-w-prose text-sm text-muted">
          A IA vai criar <strong>3 questões inéditas</strong> mirando os pontos em que você mais errou neste tópico.
          Você confere as explicações assim que responder todas.
        </p>
        <form action={acaoGerar} className="space-y-3">
          <input type="hidden" name="topico_id" value={topicoId} />
          <button disabled={gerando} className="btn btn-primary w-full sm:w-auto">
            <IconeFaisca />
            {gerando ? "Gerando questões de prática…" : "Gerar 3 questões de reforço"}
          </button>
          {gerando && <p className="text-sm text-muted">Elaborando suas questões; pode levar alguns segundos.</p>}
          {estadoGerar?.erro && <p role="alert" className="text-sm text-danger">{estadoGerar.erro}</p>}
        </form>
      </section>
    );
  }

  // Resultado após responder todas
  if (resultado) {
    return (
      <div className="space-y-6">
        <section className="card space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold"><span className="grifo">Resultado da prática</span></h2>
            <p className="font-display text-xl font-bold tabular-nums">
              {resultado.acertos} de {resultado.total}
            </p>
          </div>
          <p className="max-w-prose text-sm">{resultado.resumo}</p>
          <p className="text-xs text-muted">
            Este treino serve apenas para você revisar e não altera sua nota nem o Diagnóstico.
          </p>
        </section>

        <ol className="space-y-4">
          {resultado.itens.map((q, i) => {
            const cor = q.acertou ? "border-ok/40" : "border-danger/40";
            const selo = q.acertou ? "badge-ok" : "badge-danger";
            return (
              <li key={q.id} className={`card p-5 ${cor}`}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <p className="text-xs text-muted">Questão {i + 1} · prática</p>
                  <span className={`badge gap-1 ${selo}`}>
                    {q.acertou ? <IconeCheck /> : <IconeX />}
                    {q.acertou ? "certa" : "errada"}
                  </span>
                </div>
                <p className="text-[0.9375rem] whitespace-pre-wrap">{q.enunciado}</p>

                <ul className="mt-4 space-y-1.5 text-sm">
                  {q.alternativas.map((a, j) => {
                    const escolhida = a.id === q.escolhidaId;
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

                {q.explicacao && <p className="mt-4 max-w-prose text-sm">{q.explicacao}</p>}

                {q.revisar && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-sunken p-3 text-xs leading-[1.95] text-muted">
                    <IconeLivro className="mt-0.5 text-base" />
                    <span>
                      <strong className="text-ink">Revise no material, p. {q.revisar.pagina}:</strong>{" "}
                      <span className="grifo">
                        {q.revisar.trecho}
                        {q.revisar.trecho && q.revisar.trecho.length >= 280 ? "…" : ""}
                      </span>
                    </span>
                  </p>
                )}
                {q.revisar && resultado.materialId && (
                  <Link
                    href={`/aluno/materiais/${resultado.materialId}?p=${q.revisar.pagina}#p${q.revisar.pagina}`}
                    className="mt-2 inline-flex min-h-10 items-center text-sm font-medium text-link hover:underline"
                  >
                    Abrir a página {q.revisar.pagina} do material
                  </Link>
                )}
              </li>
            );
          })}
        </ol>

        <form action={acaoGerar} className="space-y-2">
          <input type="hidden" name="topico_id" value={topicoId} />
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={gerando} className="btn btn-primary w-full sm:w-auto">
              <IconeFaisca />
              {gerando ? "Gerando novas questões…" : "Praticar mais 3 questões"}
            </button>
            <Link href="/aluno" className="btn btn-secondary w-full sm:w-auto">
              Voltar para minhas atividades
            </Link>
          </div>
          {estadoGerar?.erro && <p role="alert" className="text-sm text-danger">{estadoGerar.erro}</p>}
        </form>
      </div>
    );
  }

  // Formulário para responder as 3 questões geradas
  const respondidas = sessao.questoes.filter((q) => Boolean(escolhas[q.id])).length;
  const completo = respondidas === sessao.questoes.length;

  return (
    <form action={acaoCorrigir} className="space-y-5">
      <input type="hidden" name="token" value={sessao.token} />

      <ol className="space-y-5">
        {sessao.questoes.map((q, i) => (
          <li key={q.id} className="card p-5">
            <p className="mb-2 text-xs text-muted">Questão {i + 1} de {sessao.questoes.length} · prática</p>
            <p className="mb-4 text-[0.9375rem] whitespace-pre-wrap">{q.enunciado}</p>
            <div className="space-y-2">
              {q.alternativas.map((a, j) => {
                const marcada = escolhas[q.id] === a.id;
                return (
                  <label
                    key={a.id}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                      marcada ? "border-ink bg-sunken font-medium" : "border-line hover:bg-sunken/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`r_${q.id}`}
                      value={a.id}
                      checked={marcada}
                      onChange={() => setEscolhas((prev) => ({ ...prev, [q.id]: a.id }))}
                      className="sr-only"
                    />
                    <span className={`bolha mt-0.5 ${marcada ? "bolha-cheia" : ""}`}>{LETRAS[j]}</span>
                    <span className="flex-1">{a.texto}</span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ol>

      {estadoCorrigir?.erro && <p role="alert" className="text-sm text-danger">{estadoCorrigir.erro}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {respondidas} de {sessao.questoes.length} respondidas
        </p>
        <button disabled={corrigindo || !completo} className="btn btn-primary w-full sm:w-auto">
          {corrigindo ? "Corrigindo e preparando feedback…" : "Conferir respostas"}
        </button>
      </div>
    </form>
  );
}
