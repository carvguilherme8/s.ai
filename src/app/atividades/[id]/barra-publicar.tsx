"use client";

import { useEffect, useState } from "react";
import { publicarAtividade } from "../actions";

export function BarraPublicar({
  atividadeId,
  turmaNome,
  totalQuestoes,
}: {
  atividadeId: string;
  turmaNome: string;
  totalQuestoes: number;
}) {
  const [sujas, setSujas] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    function aoMudar(e: Event) {
      const { questaoId, dirty } = (e as CustomEvent<{ questaoId: string; dirty: boolean }>).detail;
      setSujas((prev) => {
        const next = new Set(prev);
        if (dirty) next.add(questaoId);
        else next.delete(questaoId);
        return next;
      });
    }
    window.addEventListener("sai:questao-dirty", aoMudar);
    return () => window.removeEventListener("sai:questao-dirty", aoMudar);
  }, []);

  const qtdSujas = sujas.size;

  return (
    <form
      action={publicarAtividade}
      onSubmit={(e) => {
        if (
          qtdSujas > 0 &&
          !window.confirm(
            `Há ${qtdSujas} ${qtdSujas === 1 ? "questão" : "questões"} com alterações não salvas. Se publicar agora, essas edições serão perdidas. Deseja publicar mesmo assim?`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="flex flex-wrap items-end gap-3 rounded-xl bg-sunken p-4"
    >
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <label className="text-sm text-muted">
        Prazo (opcional)
        <input type="date" name="prazo" className="field mt-1" />
      </label>
      <button disabled={totalQuestoes === 0} className="btn btn-primary">
        Publicar para {turmaNome}
      </button>
      {qtdSujas > 0 ? (
        <p role="alert" className="basis-full text-xs font-medium text-ink">
          <span className="grifo">
            Atenção: {qtdSujas} {qtdSujas === 1 ? "questão editada" : "questões editadas"} ainda sem salvar.
          </span>{" "}
          Clique em &ldquo;Salvar questão&rdquo; antes de publicar para não perder suas alterações.
        </p>
      ) : (
        <p className="basis-full text-xs text-muted">
          Revise e edite as questões abaixo. Depois de publicada, o enunciado não pode mais ser editado.
        </p>
      )}
    </form>
  );
}
