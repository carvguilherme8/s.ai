"use client";

import { useActionState, useState } from "react";
import { ajustarNota, type EstadoNota } from "./actions";

const dez = (n: number) =>
  (Math.round(n * 100) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function FormNota({
  respostaId,
  notaIa,
  notaAjustada,
}: {
  respostaId: string;
  notaIa: number | null;
  notaAjustada: number | null;
}) {
  const [feedback, setFeedback] = useState<EstadoNota>(undefined);
  const [, acaoSalvar, salvando] = useActionState<EstadoNota, FormData>(async (prev, fd) => {
    const res = await ajustarNota(prev, fd);
    setFeedback(res);
    return res;
  }, undefined);
  const [, acaoRestaurar, restaurando] = useActionState<EstadoNota, FormData>(async (prev, fd) => {
    const res = await ajustarNota(prev, fd);
    setFeedback(res);
    return res;
  }, undefined);

  const atual = notaAjustada ?? notaIa;

  return (
    <div className="mt-4 space-y-2 border-t border-line pt-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <p className="text-sm">
          Nota da IA: <strong className="tabular-nums">{dez(notaIa ?? 0)}</strong>
          {notaAjustada !== null && (
            <>
              {" "}· ajustada por você: <strong className="tabular-nums text-ok">{dez(notaAjustada)}</strong>
            </>
          )}
        </p>
        <form action={acaoSalvar} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="resposta_id" value={respostaId} />
          <label className="text-xs text-muted">
            Nova nota (0 a 10)
            <input
              key={atual ?? "vazio"}
              name="nota"
              type="number"
              inputMode="decimal"
              min={0}
              max={10}
              step={0.5}
              defaultValue={atual === null ? "" : (Math.round(atual * 100) / 10).toString()}
              className="field mt-1 w-24"
            />
          </label>
          <label className="min-w-44 flex-1 text-xs text-muted">
            Comentário docente (opcional, atualiza o feedback do aluno)
            <input
              name="comentario_professor"
              placeholder="Ex.: Considerei o raciocínio correto no passo 2."
              className="field mt-1"
            />
          </label>
          <button disabled={salvando || restaurando} className="btn btn-primary btn-sm">
            {salvando ? "Salvando…" : "Salvar nota"}
          </button>
        </form>
        {notaAjustada !== null && (
          <form action={acaoRestaurar}>
            <input type="hidden" name="resposta_id" value={respostaId} />
            <input type="hidden" name="nota" value="" />
            <button disabled={salvando || restaurando} className="btn btn-secondary btn-sm">
              {restaurando ? "Restaurando…" : "Voltar à nota da IA"}
            </button>
          </form>
        )}
      </div>
      {feedback?.erro && <p role="alert" className="text-sm text-danger">{feedback.erro}</p>}
      {!feedback?.erro && feedback?.ok && <p role="status" className="text-sm text-ok">{feedback.ok}</p>}
    </div>
  );
}
