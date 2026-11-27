"use client";

import { useActionState, useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { enviarEntrega, type EstadoForm } from "./actions";

export type QuestaoParaResponder = {
  questao_id: string;
  ordem: number;
  tipo: "multipla_escolha" | "dissertativa";
  enunciado: string;
  topico: string;
  alternativas: { id: string; texto: string }[];
};

const LETRAS = "ABCDEFGH";
const EVENTO_RASCUNHO = "sai:rascunho-sync";

type TelemetriaLocal = {
  paste_events: number;
  paste_chars: number;
  iniciado_em: number | null;
};

export function chaveRascunhoLocal(atividadeId: string, alunoId: string) {
  return `sai:rascunho:${atividadeId}:${alunoId}`;
}

function assinarRascunho(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENTO_RASCUNHO, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENTO_RASCUNHO, callback);
  };
}

function registrarFoco(mapa: Record<string, TelemetriaLocal>, qid: string) {
  const atual = mapa[qid];
  if (!atual?.iniciado_em) {
    mapa[qid] = {
      paste_events: atual?.paste_events ?? 0,
      paste_chars: atual?.paste_chars ?? 0,
      iniciado_em: Date.now(),
    };
  }
}

function registrarCola(mapa: Record<string, TelemetriaLocal>, qid: string, textoColado: string) {
  registrarFoco(mapa, qid);
  const atual = mapa[qid];
  mapa[qid] = {
    ...atual,
    paste_events: atual.paste_events + 1,
    paste_chars: atual.paste_chars + textoColado.length,
  };
}

export function FormResponder({
  atividadeId,
  alunoId,
  questoes,
}: {
  atividadeId: string;
  alunoId: string;
  questoes: QuestaoParaResponder[];
}) {
  const chave = chaveRascunhoLocal(atividadeId, alunoId);
  const [fallbackMemoria, setFallbackMemoria] = useState<Record<string, string>>({});
  const telemetriaRef = useRef<Record<string, TelemetriaLocal>>({});

  const getSnapshot = useCallback(() => {
    try {
      return window.localStorage.getItem(chave) ?? "";
    } catch {
      return "";
    }
  }, [chave]);

  const brutoLocal = useSyncExternalStore(assinarRascunho, getSnapshot, () => "");

  const respostas = useMemo<Record<string, string>>(() => {
    if (!brutoLocal) return fallbackMemoria;
    try {
      const parsed = JSON.parse(brutoLocal) as Record<string, string>;
      return parsed && typeof parsed === "object" ? { ...parsed, ...fallbackMemoria } : fallbackMemoria;
    } catch {
      return fallbackMemoria;
    }
  }, [brutoLocal, fallbackMemoria]);

  const salvoLocal = Object.keys(respostas).length > 0;

  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(async (prev, formData) => {
    const agora = Date.now();
    for (const q of questoes) {
      if (q.tipo !== "dissertativa") continue;
      const t = telemetriaRef.current[q.questao_id];
      const tempoSegundos = t?.iniciado_em ? Math.max(0, Math.round((agora - t.iniciado_em) / 1000)) : 0;
      formData.set(
        `telemetria_${q.questao_id}`,
        JSON.stringify({
          paste_events: t?.paste_events ?? 0,
          paste_chars: t?.paste_chars ?? 0,
          tempo_segundos: tempoSegundos,
        }),
      );
    }
    return enviarEntrega(prev, formData);
  }, undefined);

  function atualizarResposta(qid: string, valor: string) {
    const proximo = { ...respostas, [qid]: valor };
    setFallbackMemoria(proximo);
    try {
      window.localStorage.setItem(chave, JSON.stringify(proximo));
      window.dispatchEvent(new Event(EVENTO_RASCUNHO));
    } catch {
      // Modo privado / storage bloqueado: mantém em memória
    }
  }

  return (
    <form action={acao} className="space-y-6">
      <input type="hidden" name="atividade_id" value={atividadeId} />

      {salvoLocal && (
        <p className="text-xs text-muted">
          <span className="badge badge-neutral">Rascunho salvo no aparelho</span>{" "}
          Se a internet oscilar, suas respostas continuam guardadas aqui.
        </p>
      )}

      <ol className="space-y-5">
        {questoes.map((q, i) => (
          <li key={q.questao_id} className="card p-5">
            <p className="mb-3 text-xs text-muted">Questão {i + 1} · {q.topico}</p>
            <p className="text-[0.9375rem] whitespace-pre-wrap">{q.enunciado}</p>
            {q.tipo === "multipla_escolha" ? (
              <div className="mt-4 space-y-2" role="radiogroup" aria-label={`Questão ${i + 1}`}>
                {q.alternativas.map((a, j) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm transition-colors hover:bg-sunken has-checked:border-ink has-checked:bg-warn-soft"
                  >
                    <input
                      type="radio"
                      name={`q_${q.questao_id}`}
                      value={a.id}
                      checked={respostas[q.questao_id] === a.id}
                      onChange={() => atualizarResposta(q.questao_id, a.id)}
                      required
                      className="mt-0.5"
                    />
                    <span className="w-4 shrink-0 font-semibold">{LETRAS[j]}</span>
                    <span className="flex-1">{a.texto}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea
                name={`q_${q.questao_id}`}
                rows={5}
                required
                minLength={10}
                value={respostas[q.questao_id] ?? ""}
                onFocus={() => registrarFoco(telemetriaRef.current, q.questao_id)}
                onChange={(e) => {
                  registrarFoco(telemetriaRef.current, q.questao_id);
                  atualizarResposta(q.questao_id, e.target.value);
                }}
                onPaste={(e) => registrarCola(telemetriaRef.current, q.questao_id, e.clipboardData.getData("text"))}
                placeholder="Escreva sua resposta com suas palavras…"
                className="field mt-4"
              />
            )}
          </li>
        ))}
      </ol>

      {estado?.erro && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {estado.erro}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pendente} className="btn btn-primary">
          {pendente ? "Enviando…" : "Enviar respostas"}
        </button>
        <p className="text-xs text-muted">
          {pendente
            ? "Salvando sua entrega…"
            : "Você só pode enviar uma vez; o resultado das objetivas sai na hora."}
        </p>
      </div>
    </form>
  );
}
