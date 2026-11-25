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
        className="btn btn-primary"
      >
        {pendente ? "Analisando…" : rotulo}
      </button>
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
    </form>
  );
}
