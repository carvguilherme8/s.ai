"use client";

import { useActionState } from "react";
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

export function FormResponder({ atividadeId, questoes }: { atividadeId: string; questoes: QuestaoParaResponder[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(enviarEntrega, undefined);

  return (
    <form action={acao} className="space-y-6">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <ol className="space-y-5">
        {questoes.map((q, i) => (
          <li key={q.questao_id} className="card p-5">
            <p className="mb-3 text-xs text-muted">Questão {i + 1} · {q.topico}</p>
            <p className="text-[0.9375rem] whitespace-pre-wrap">{q.enunciado}</p>
            {q.tipo === "multipla_escolha" ? (
              <div className="mt-4 space-y-2" role="radiogroup" aria-label={`Questão ${i + 1}`}>
                {q.alternativas.map((a, j) => (
                  <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line px-3 py-2.5 text-sm transition-colors hover:bg-sunken has-checked:border-ink has-checked:bg-warn-soft">
                    <input type="radio" name={`q_${q.questao_id}`} value={a.id} required className="mt-0.5" />
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
                placeholder="Escreva sua resposta…"
                className="field mt-4"
              />
            )}
          </li>
        ))}
      </ol>
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={pendente}
          className="btn btn-primary"
        >
          {pendente ? "Corrigindo…" : "Enviar respostas"}
        </button>
        <p className="text-xs text-muted">
          {pendente ? "A correção e o feedback levam alguns segundos." : "Você só pode enviar uma vez; o feedback aparece depois."}
        </p>
      </div>
    </form>
  );
}
