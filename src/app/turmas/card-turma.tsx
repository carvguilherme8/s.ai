"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CopiarCodigo } from "../copiar-codigo";
import { IconeAtualizar } from "../icones";
import { excluirTurma, regenerarCodigo, renomearTurma, type EstadoAcao } from "./actions";

export type TurmaResumo = {
  id: string;
  nome: string;
  codigo_convite: string;
  alunos: { id: string; nome: string }[];
  totalMateriais: number;
  totalAtividades: number;
};

export function CardTurma({ turma }: { turma: TurmaResumo }) {
  const [feedback, setFeedback] = useState<EstadoAcao>(undefined);
  const [editando, setEditando] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [confirmandoCodigo, setConfirmandoCodigo] = useState(false);

  const [, acaoNome, salvandoNome] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await renomearTurma(prev, fd);
    setFeedback(res);
    if (res?.ok) setEditando(false);
    return res;
  }, undefined);

  const [, acaoCodigo, gerandoCodigo] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await regenerarCodigo(prev, fd);
    setFeedback(res);
    if (res?.ok) setConfirmandoCodigo(false);
    return res;
  }, undefined);

  const [, acaoExcluir, excluindo] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await excluirTurma(prev, fd);
    setFeedback(res);
    if (res?.erro) setConfirmandoExclusao(false);
    return res;
  }, undefined);

  const temAlunos = turma.alunos.length > 0;

  return (
    <li className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editando ? (
            <form action={acaoNome} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="turma_id" value={turma.id} />
              <input
                name="nome"
                defaultValue={turma.nome}
                maxLength={60}
                required
                autoFocus
                aria-label={`Novo nome para ${turma.nome}`}
                className="field max-w-xs py-1.5"
              />
              <button disabled={salvandoNome} className="btn btn-secondary btn-sm">
                {salvandoNome ? "Salvando…" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="btn btn-secondary btn-sm text-muted"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <h2 className="text-xl font-bold">{turma.nome}</h2>
          )}
          <p className="mt-1 text-sm text-muted">
            {turma.alunos.length} {turma.alunos.length === 1 ? "aluno" : "alunos"}
            {" · "}
            {turma.totalMateriais} {turma.totalMateriais === 1 ? "material" : "materiais"}
            {" · "}
            {turma.totalAtividades} {turma.totalAtividades === 1 ? "atividade" : "atividades"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <CopiarCodigo codigo={turma.codigo_convite} />
          {!confirmandoCodigo ? (
            <button
              type="button"
              onClick={() => {
                setConfirmandoCodigo(true);
                setConfirmandoExclusao(false);
              }}
              title="Gerar novo código de convite"
              className="btn btn-secondary btn-sm"
            >
              <IconeAtualizar className="text-muted" />
              Novo código
            </button>
          ) : (
            <form action={acaoCodigo} className="flex items-center gap-1.5">
              <input type="hidden" name="turma_id" value={turma.id} />
              <button disabled={gerandoCodigo} className="btn btn-secondary btn-sm">
                {gerandoCodigo ? "Gerando…" : "Confirmar novo código"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmandoCodigo(false)}
                className="btn btn-secondary btn-sm text-muted"
              >
                Cancelar
              </button>
            </form>
          )}
        </div>
      </div>

      {confirmandoCodigo && (
        <p className="rounded-lg bg-sunken px-3 py-2 text-xs text-muted">
          O código antigo deixará de funcionar para novos cadastros. Alunos que já estão na turma continuam normalmente.
        </p>
      )}

      {feedback?.erro && (
        <p role="alert" className="text-sm text-danger">{feedback.erro}</p>
      )}
      {!feedback?.erro && feedback?.ok && (
        <p role="status" className="text-sm text-ok">{feedback.ok}</p>
      )}

      {turma.alunos.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted hover:text-ink">
            Ver alunos ({turma.alunos.length})
          </summary>
          <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {turma.alunos.map((a) => (
              <li key={a.id} className="truncate">
                <Link
                  href={`/diagnostico/aluno/${a.id}`}
                  className="text-ink underline-offset-4 hover:text-link hover:underline"
                >
                  {a.nome.replace(" (fictício)", "")}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {!editando && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="btn btn-secondary btn-sm"
            >
              Renomear
            </button>
          )}
          <Link href={`/diagnostico?turma=${turma.id}`} className="btn btn-secondary btn-sm">
            Ver diagnóstico
          </Link>
        </div>

        {temAlunos ? (
          <p className="text-xs text-muted">
            Turmas com alunos cadastrados não podem ser excluídas.
          </p>
        ) : confirmandoExclusao ? (
          <form action={acaoExcluir} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="turma_id" value={turma.id} />
            <span className="text-xs text-danger">
              {turma.totalMateriais > 0 || turma.totalAtividades > 0
                ? "Isso também remove os materiais e atividades desta turma."
                : "Excluir esta turma permanentemente?"}
            </span>
            <button disabled={excluindo} className="btn btn-danger btn-sm">
              {excluindo ? "Excluindo…" : "Confirmar exclusão"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoExclusao(false)}
              className="btn btn-secondary btn-sm text-muted"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirmandoExclusao(true);
              setConfirmandoCodigo(false);
            }}
            className="btn btn-danger btn-sm"
          >
            Excluir turma
          </button>
        )}
      </div>
    </li>
  );
}
