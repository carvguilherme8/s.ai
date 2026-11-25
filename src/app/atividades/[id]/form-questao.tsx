"use client";

import { useActionState } from "react";
import { removerQuestao, salvarQuestao, type EstadoQuestao } from "../actions";

const campo = "field";
const LETRAS = "ABCDEFGH";

type Alternativa = { id: string; texto: string; correta: boolean; equivoco: string | null };
type Criterio = { criterio: string; pontos: number };

export function FormQuestao({
  atividadeId,
  questaoId,
  tipo,
  enunciado,
  alternativas,
  rubrica,
}: {
  atividadeId: string;
  questaoId: string;
  tipo: "multipla_escolha" | "dissertativa";
  enunciado: string;
  alternativas: Alternativa[];
  rubrica: Criterio[];
}) {
  const [estado, acao, salvando] = useActionState<EstadoQuestao, FormData>(salvarQuestao, undefined);

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="atividade_id" value={atividadeId} />
      <input type="hidden" name="questao_id" value={questaoId} />
      <textarea name="enunciado" defaultValue={enunciado} rows={3} className={campo} aria-label="Enunciado" />
      {tipo === "multipla_escolha" ? (
        <ul className="space-y-2">
          {alternativas.map((a, j) => (
            <li key={a.id} className="grid grid-cols-[auto_1fr] items-start gap-2 text-sm">
              <label className="flex items-center gap-1 pt-1.5" title="Alternativa correta">
                <input type="radio" name="correta" value={a.id} defaultChecked={a.correta} />
                <span className="font-medium">{LETRAS[j]}</span>
              </label>
              <div className="space-y-1">
                <input name={`texto_${a.id}`} defaultValue={a.texto} className={campo} aria-label={`Alternativa ${LETRAS[j]}`} />
                <input
                  name={`equivoco_${a.id}`}
                  defaultValue={a.equivoco ?? ""}
                  placeholder="Equívoco que este distrator representa (só nas erradas)"
                  className={`${campo} text-muted`}
                  aria-label={`Equívoco da alternativa ${LETRAS[j]}`}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <label className="block text-sm text-muted">
          Rubrica — um critério por linha, no formato <code>critério | pontos</code>
          <textarea
            name="rubrica"
            rows={Math.max(3, rubrica.length + 1)}
            defaultValue={rubrica.map((r) => `${r.criterio} | ${r.pontos}`).join("\n")}
            className={`${campo} mt-1`}
          />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button disabled={salvando} className="btn btn-secondary btn-sm">
          {salvando ? "Salvando…" : "Salvar questão"}
        </button>
        <button formAction={removerQuestao} disabled={salvando} className="btn btn-danger btn-sm">
          Remover
        </button>
        {estado?.erro && <span role="alert" className="text-sm text-danger">{estado.erro}</span>}
        {!estado?.erro && estado?.ok && <span role="status" className="text-sm text-ok">{estado.ok}</span>}
      </div>
    </form>
  );
}
