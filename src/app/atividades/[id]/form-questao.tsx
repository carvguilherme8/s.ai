"use client";

import { useActionState, useEffect, useState } from "react";
import {
  analisarComprimentoAlternativas,
  type RegrasGlobaisProva,
  type RubricaV2,
} from "@/lib/nota-rubrica";
import {
  regenerarQuestao,
  removerQuestao,
  salvarQuestao,
  type EstadoQuestao,
} from "../actions";
import { IconeAtualizar, IconeLivro } from "../../icones";
import { EditorPilulas } from "./editor-pilulas";

const campo = "field";
const LETRAS = "ABCDEFGH";

type Alternativa = { id: string; texto: string; correta: boolean; equivoco: string | null };

export function FormQuestao({
  atividadeId,
  questaoId,
  tipo,
  enunciado: enunciadoInicial,
  alternativas: altsIniciais,
  rubrica: rubricaInicial,
  regrasGlobais,
  trecho,
}: {
  atividadeId: string;
  questaoId: string;
  tipo: "multipla_escolha" | "dissertativa";
  enunciado: string;
  alternativas: Alternativa[];
  rubrica: RubricaV2 | null;
  regrasGlobais: RegrasGlobaisProva;
  trecho: { pagina: number | null; conteudo: string } | null;
}) {
  const [dirty, setDirty] = useState(false);
  const [enunciado, setEnunciado] = useState(enunciadoInicial);
  const [corretaId, setCorretaId] = useState(altsIniciais.find((a) => a.correta)?.id ?? "");
  const [textosAlts, setTextosAlts] = useState<Record<string, string>>(() =>
    Object.fromEntries(altsIniciais.map((a) => [a.id, a.texto])),
  );

  const [estado, acaoSalvar, salvando] = useActionState<EstadoQuestao, FormData>(async (prev, fd) => {
    const res = await salvarQuestao(prev, fd);
    if (res?.ok && !res.erro) setDirty(false);
    return res;
  }, undefined);

  const [estadoRegen, acaoRegen, regenerando] = useActionState<EstadoQuestao, FormData>(async (prev, fd) => {
    const res = await regenerarQuestao(prev, fd);
    if (res?.ok && !res.erro) setDirty(false);
    return res;
  }, undefined);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("sai:questao-dirty", { detail: { questaoId, dirty } }));
    return () => {
      window.dispatchEvent(new CustomEvent("sai:questao-dirty", { detail: { questaoId, dirty: false } }));
    };
  }, [questaoId, dirty]);

  const analiseComprimento =
    tipo === "multipla_escolha"
      ? analisarComprimentoAlternativas(
          altsIniciais.map((a) => ({ texto: textosAlts[a.id] ?? a.texto, correta: a.id === corretaId })),
        )
      : null;

  const ocupado = salvando || regenerando;

  return (
    <div className="space-y-3">
      {trecho && (
        <details className="rounded-lg bg-sunken/70 px-3 py-2 text-xs">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-muted hover:text-ink">
            <IconeLivro />
            Ver trecho-fonte{trecho.pagina ? ` (p. ${trecho.pagina})` : ""}
          </summary>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap border-t border-line pt-2 text-ink/90">
            {trecho.conteudo.replace(/^\s*\[página \d+\]\s*/, "")}
          </p>
        </details>
      )}

      <form action={acaoSalvar} className="space-y-3">
        <input type="hidden" name="atividade_id" value={atividadeId} />
        <input type="hidden" name="questao_id" value={questaoId} />

        <textarea
          name="enunciado"
          value={enunciado}
          onChange={(e) => {
            setEnunciado(e.target.value);
            setDirty(true);
          }}
          rows={3}
          className={campo}
          aria-label="Enunciado"
        />

        {tipo === "multipla_escolha" ? (
          <div className="space-y-2">
            {analiseComprimento?.alerta && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn-ink">
                <strong className="font-semibold">Alerta de viés de tamanho:</strong> a alternativa correta está{" "}
                <span className="font-mono font-semibold">{analiseComprimento.razao}×</span> mais longa que a média
                dos distratores ({analiseComprimento.tamCorreta} vs. {analiseComprimento.mediaDistratores} caracteres).
                Vale equilibrar os tamanhos para não entregar o gabarito.
              </p>
            )}
            <ul className="space-y-2">
              {altsIniciais.map((a, j) => (
                <li key={a.id} className="grid grid-cols-[auto_1fr] items-start gap-2 text-sm">
                  <label className="flex items-center gap-1 pt-1.5" title="Alternativa correta">
                    <input
                      type="radio"
                      name="correta"
                      value={a.id}
                      checked={corretaId === a.id}
                      onChange={() => {
                        setCorretaId(a.id);
                        setDirty(true);
                      }}
                    />
                    <span className="font-medium">{LETRAS[j]}</span>
                  </label>
                  <div className="space-y-1">
                    <input
                      name={`texto_${a.id}`}
                      value={textosAlts[a.id] ?? a.texto}
                      onChange={(e) => {
                        setTextosAlts((prev) => ({ ...prev, [a.id]: e.target.value }));
                        setDirty(true);
                      }}
                      className={campo}
                      aria-label={`Alternativa ${LETRAS[j]}`}
                    />
                    <input
                      name={`equivoco_${a.id}`}
                      defaultValue={a.equivoco ?? ""}
                      onChange={() => setDirty(true)}
                      placeholder="Equívoco que este distrator representa (só nas erradas)"
                      className={`${campo} text-muted`}
                      aria-label={`Equívoco da alternativa ${LETRAS[j]}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          rubricaInicial && (
            <EditorPilulas
              atividadeId={atividadeId}
              questaoId={questaoId}
              enunciadoAtual={enunciado}
              rubricaInicial={rubricaInicial}
              regrasGlobais={regrasGlobais}
              onDirty={() => setDirty(true)}
            />
          )
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button disabled={ocupado} className={dirty ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}>
            {salvando ? "Salvando…" : dirty ? "Salvar alterações" : "Salvar questão"}
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => {
              const fd = new FormData();
              fd.set("atividade_id", atividadeId);
              fd.set("questao_id", questaoId);
              acaoRegen(fd);
            }}
            className="btn btn-secondary btn-sm"
            title="Pede à IA outra questão diferente sobre o mesmo tópico"
          >
            <IconeAtualizar />
            {regenerando ? "Regenerando…" : "Regenerar só esta"}
          </button>
          <button formAction={removerQuestao} disabled={ocupado} className="btn btn-danger btn-sm">
            Remover
          </button>
          {dirty && !salvando && <span className="text-xs font-medium text-warn-ink">alterações não salvas</span>}
          {estado?.erro && <span role="alert" className="text-sm text-danger">{estado.erro}</span>}
          {!estado?.erro && estado?.ok && <span role="status" className="text-sm text-ok">{estado.ok}</span>}
          {estadoRegen?.erro && <span role="alert" className="text-sm text-danger">{estadoRegen.erro}</span>}
          {!estadoRegen?.erro && estadoRegen?.ok && (
            <span role="status" className="text-sm text-ok">{estadoRegen.ok}</span>
          )}
        </div>
      </form>
    </div>
  );
}
