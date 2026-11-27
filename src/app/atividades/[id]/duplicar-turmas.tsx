"use client";

import { useActionState, useState } from "react";
import { duplicarAtividadeParaTurmas, type EstadoQuestao } from "../actions";

export function DuplicarTurmas({
  atividadeId,
  outrasTurmas,
}: {
  atividadeId: string;
  outrasTurmas: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [publicarAgora, setPublicarAgora] = useState(false);
  const [estado, acao, pendente] = useActionState<EstadoQuestao, FormData>(duplicarAtividadeParaTurmas, undefined);

  if (!outrasTurmas.length) return null;

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold">Aplicar em outras turmas</h2>
          <p className="text-xs text-muted">
            Duplica exatamente estas questões e rubricas para turmas paralelas (garante comparação justa no Diagnóstico).
          </p>
        </div>
        <button type="button" onClick={() => setAberto((v) => !v)} className="btn btn-secondary btn-sm">
          {aberto ? "Fechar" : "Escolher turmas"}
        </button>
      </div>

      {aberto && (
        <form action={acao} className="mt-3 space-y-3 border-t border-line pt-3 text-sm">
          <input type="hidden" name="atividade_id" value={atividadeId} />
          <input type="hidden" name="publicar_agora" value={String(publicarAgora)} />

          <div className="flex flex-wrap gap-2">
            {outrasTurmas.map((t) => (
              <label
                key={t.id}
                className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1 text-xs font-medium hover:bg-sunken"
              >
                <input type="checkbox" name="turma_ids" value={t.id} />
                {t.nome}
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className="inline-flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={publicarAgora}
                onChange={(e) => setPublicarAgora(e.target.checked)}
              />
              Publicar imediatamente nas turmas selecionadas
            </label>
            {publicarAgora && (
              <label className="inline-flex items-center gap-1.5 text-muted">
                Prazo (opcional):
                <input type="date" name="prazo" className="field w-auto py-1 text-xs" />
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button disabled={pendente} className="btn btn-primary btn-sm">
              {pendente ? "Aplicando…" : publicarAgora ? "Duplicar e publicar" : "Duplicar como rascunho"}
            </button>
            {estado?.erro && <span role="alert" className="text-xs text-danger">{estado.erro}</span>}
            {estado?.ok && <span role="status" className="text-xs text-ok">{estado.ok}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
