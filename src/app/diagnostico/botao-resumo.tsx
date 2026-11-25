"use client";

import { useActionState } from "react";
import { gerarResumo, type EstadoResumo } from "./actions";

export function BotaoResumo({ turmaId, rotulo }: { turmaId: string; rotulo: string }) {
  const [estado, acao, pendente] = useActionState<EstadoResumo, FormData>(gerarResumo, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="turma_id" value={turmaId} />
      <button
        disabled={pendente}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pendente ? "Analisando…" : rotulo}
      </button>
      {estado?.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
    </form>
  );
}
