"use client";

import { useActionState } from "react";
import { corrigirPendente, type EstadoResumo } from "./actions";

/** Refaz a correção por IA de uma dissertativa que ficou pendente. */
export function BotaoCorrigir({ respostaId }: { respostaId: string }) {
  const [estado, acao, pendente] = useActionState<EstadoResumo, FormData>(corrigirPendente, undefined);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="resposta_id" value={respostaId} />
      <button disabled={pendente} className="btn btn-primary btn-sm">
        {pendente ? "Corrigindo…" : "Corrigir agora com IA"}
      </button>
      {estado?.erro && <p role="alert" className="text-xs text-danger">{estado.erro}</p>}
    </form>
  );
}
