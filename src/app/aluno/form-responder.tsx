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
          <li key={q.questao_id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="mb-2 text-xs text-zinc-500">Questão {i + 1} · {q.topico}</p>
            <p className="whitespace-pre-wrap text-sm">{q.enunciado}</p>
            {q.tipo === "multipla_escolha" ? (
              <div className="mt-3 space-y-1.5" role="radiogroup" aria-label={`Questão ${i + 1}`}>
                {q.alternativas.map((a, j) => (
                  <label key={a.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                    <input type="radio" name={`q_${q.questao_id}`} value={a.id} required className="mt-1" />
                    <span><strong>{LETRAS[j]})</strong> {a.texto}</span>
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
                className="mt-3 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
              />
            )}
          </li>
        ))}
      </ol>
      {estado?.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
      <div className="flex items-center gap-3">
        <button
          disabled={pendente}
          className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pendente ? "Corrigindo…" : "Enviar respostas"}
        </button>
        <p className="text-xs text-zinc-500">
          {pendente ? "A correção e o feedback levam alguns segundos." : "Você só pode enviar uma vez; o feedback aparece depois."}
        </p>
      </div>
    </form>
  );
}
