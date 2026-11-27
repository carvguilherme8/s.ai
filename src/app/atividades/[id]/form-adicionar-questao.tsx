"use client";

import { useActionState, useState } from "react";
import { adicionarQuestaoManual, type EstadoQuestao } from "../actions";

const LETRAS = ["A", "B", "C", "D"];

export function FormAdicionarQuestao({
  atividadeId,
  topicos,
}: {
  atividadeId: string;
  topicos: { id: string; nome: string }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<"multipla_escolha" | "dissertativa">("dissertativa");
  const [estado, acao, salvando] = useActionState<EstadoQuestao, FormData>(adicionarQuestaoManual, undefined);

  if (!topicos.length) return null;

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold">Adicionar questão manual</h2>
          <p className="text-xs text-muted">
            Inclua uma questão própria de múltipla escolha ou dissertativa (com pílulas editáveis).
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="btn btn-secondary btn-sm"
        >
          {aberto ? "Fechar" : "+ Nova questão"}
        </button>
      </div>

      {aberto && (
        <form action={acao} className="mt-4 space-y-3 border-t border-line pt-4">
          <input type="hidden" name="atividade_id" value={atividadeId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Tipo
              <select
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value === "multipla_escolha" ? "multipla_escolha" : "dissertativa")}
                className="field mt-1"
              >
                <option value="dissertativa">Dissertativa (com pílulas)</option>
                <option value="multipla_escolha">Múltipla escolha (4 alternativas)</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              Tópico no Diagnóstico
              <select name="topico_id" required className="field mt-1">
                {topicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-xs text-muted">
            Enunciado
            <textarea
              name="enunciado"
              rows={3}
              required
              placeholder="Escreva o enunciado da questão…"
              className="field mt-1"
            />
          </label>

          {tipo === "multipla_escolha" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted">Marque qual alternativa é a correta e informe o equívoco das erradas:</p>
              {LETRAS.map((letra, i) => (
                <div key={letra} className="grid grid-cols-[auto_1fr] items-start gap-2 text-sm">
                  <label className="flex items-center gap-1 pt-2">
                    <input type="radio" name="correta_idx" value={i} defaultChecked={i === 0} />
                    <span className="font-semibold">{letra}</span>
                  </label>
                  <div className="space-y-1">
                    <input
                      name={`alt_${i}`}
                      required
                      placeholder={`Texto da alternativa ${letra}`}
                      className="field text-xs"
                    />
                    <input
                      name={`eq_${i}`}
                      placeholder="Equívoco que este distrator indica (deixe vazio na correta)"
                      className="field text-xs text-muted"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg bg-sunken p-2.5 text-xs text-muted">
              A questão será criada com 2 critérios padrão (+50% / +50%) para você personalizar em blocos logo acima.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button disabled={salvando} className="btn btn-primary btn-sm">
              {salvando ? "Adicionando…" : "Adicionar questão"}
            </button>
            {estado?.erro && <span role="alert" className="text-xs text-danger">{estado.erro}</span>}
            {estado?.ok && <span role="status" className="text-xs text-ok">{estado.ok}</span>}
          </div>
        </form>
      )}
    </section>
  );
}
