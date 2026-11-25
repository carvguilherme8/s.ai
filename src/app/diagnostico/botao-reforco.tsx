"use client";

import { useActionState } from "react";
import { gerarReforco, type EstadoResumo } from "./actions";

/** Cria um rascunho de atividade de reforço para a lacuna (a professora revisa antes de publicar). */
export function BotaoReforco({ turmaId, topicoId }: { turmaId: string; topicoId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoResumo, FormData>(gerarReforco, undefined);
  return (
    <form action={acao} className="no-print mt-4">
      <input type="hidden" name="turma_id" value={turmaId} />
      <input type="hidden" name="topico_id" value={topicoId} />
      <button disabled={pendente} className="btn btn-secondary btn-sm w-full sm:w-auto">
        {pendente ? "Gerando reforço…" : "Gerar atividade de reforço"}
      </button>
      {pendente && <p className="mt-2 text-xs text-muted">A IA está elaborando 5 questões sobre esses equívocos; leva cerca de 20 segundos.</p>}
      {estado?.erro && <p role="alert" className="mt-2 text-xs text-danger">{estado.erro}</p>}
    </form>
  );
}
