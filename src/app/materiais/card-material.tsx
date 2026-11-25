"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { NOMES_DISCIPLINAS } from "@/lib/disciplinas";
import { IconeCheck, IconeX } from "../icones";
import {
  confirmarTodos,
  confirmarTopico,
  criarTopico,
  editarMaterial,
  excluirMaterial,
  removerTopico,
  type EstadoAcao,
} from "./actions";

export type TopicoItem = {
  id: string;
  nome: string;
  descricao: string | null;
  confirmado: boolean;
  totalQuestoes: number;
};

export type MaterialItem = {
  id: string;
  titulo: string;
  tipo: "pdf" | "texto";
  disciplina: string | null;
  turmaId: string;
  turmaNome: string | null;
  totalAtividades: number;
  topicos: TopicoItem[];
};

export function CardMaterial({
  material,
  turmas,
}: {
  material: MaterialItem;
  turmas: { id: string; nome: string }[];
}) {
  const [feedback, setFeedback] = useState<EstadoAcao>(undefined);
  const [editando, setEditando] = useState(false);
  const [adicionandoTopico, setAdicionandoTopico] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const formNovoTopicoRef = useRef<HTMLFormElement>(null);

  const [, acaoEditar, salvandoEdicao] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await editarMaterial(prev, fd);
    setFeedback(res);
    if (res?.ok) setEditando(false);
    return res;
  }, undefined);

  const [, acaoExcluir, excluindo] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await excluirMaterial(prev, fd);
    setFeedback(res);
    if (res?.erro) setConfirmandoExclusao(false);
    return res;
  }, undefined);

  const [, acaoConfirmarTodos, confirmandoTodos] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await confirmarTodos(prev, fd);
    setFeedback(res);
    return res;
  }, undefined);

  const [, acaoCriarTopico, criandoTopico] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await criarTopico(prev, fd);
    setFeedback(res);
    if (res?.ok) {
      formNovoTopicoRef.current?.reset();
      setAdicionandoTopico(false);
    }
    return res;
  }, undefined);

  const [, acaoSalvarTopico, salvandoTopico] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await confirmarTopico(prev, fd);
    setFeedback(res);
    return res;
  }, undefined);

  const [, acaoRemoverTopico, removendoTopico] = useActionState<EstadoAcao, FormData>(async (prev, fd) => {
    const res = await removerTopico(prev, fd);
    setFeedback(res);
    return res;
  }, undefined);

  const pendentes = material.topicos.filter((t) => !t.confirmado).length;

  return (
    <li className="card space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/materiais/${material.id}`}
              className="font-display text-lg font-bold tracking-tight hover:text-link hover:underline"
            >
              {material.titulo}
            </Link>
            {material.disciplina && <span className="badge badge-neutral">{material.disciplina}</span>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {material.tipo === "pdf" ? "PDF" : "Texto"}
            {material.turmaNome && ` · ${material.turmaNome}`}
            {" · "}
            {material.topicos.length} {material.topicos.length === 1 ? "tópico" : "tópicos"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/materiais/${material.id}`} className="btn btn-secondary btn-sm">
            Ler material
          </Link>
          <button
            type="button"
            onClick={() => {
              setEditando((v) => !v);
              setConfirmandoExclusao(false);
            }}
            className="btn btn-secondary btn-sm"
          >
            {editando ? "Fechar edição" : "Editar"}
          </button>
          {pendentes > 0 && (
            <form action={acaoConfirmarTodos}>
              <input type="hidden" name="material_id" value={material.id} />
              <button disabled={confirmandoTodos} className="btn btn-secondary btn-sm">
                {confirmandoTodos ? "Confirmando…" : `Confirmar todos (${pendentes})`}
              </button>
            </form>
          )}
        </div>
      </div>

      {editando && (
        <form action={acaoEditar} className="space-y-3 rounded-lg bg-sunken p-4">
          <input type="hidden" name="material_id" value={material.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-muted sm:col-span-2">
              Título
              <input
                name="titulo"
                defaultValue={material.titulo}
                maxLength={120}
                required
                className="field mt-1"
              />
            </label>
            <label className="text-sm text-muted">
              Turma
              <select name="turma_id" defaultValue={material.turmaId} required className="field mt-1">
                {turmas.map((t) => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-muted">
              Disciplina
              <select name="disciplina" defaultValue={material.disciplina ?? ""} className="field mt-1">
                <option value="">Sem disciplina</option>
                {NOMES_DISCIPLINAS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={salvandoEdicao} className="btn btn-primary btn-sm">
              {salvandoEdicao ? "Salvando…" : "Salvar alterações"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="btn btn-secondary btn-sm text-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {feedback?.erro && <p role="alert" className="text-sm text-danger">{feedback.erro}</p>}
      {!feedback?.erro && feedback?.ok && <p role="status" className="text-sm text-ok">{feedback.ok}</p>}

      <ul className="space-y-2">
        {material.topicos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-start gap-2 text-sm">
            <form action={acaoSalvarTopico} className="contents">
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="confirmado" value="true" />
              <textarea
                name="nome"
                rows={1}
                defaultValue={t.nome}
                aria-label="Nome do tópico"
                className="campo-nome w-full rounded-lg border border-transparent bg-transparent px-2 py-2 transition-colors hover:border-line-strong focus:border-link focus:outline-none sm:w-auto sm:min-w-48 sm:flex-1 sm:py-1.5"
              />
              <button
                disabled={salvandoTopico}
                className={`btn btn-sm ${t.confirmado ? "btn-secondary" : "btn-primary"}`}
                title={t.confirmado ? "Salvar o nome" : "Confirmar tópico"}
              >
                {t.confirmado ? <><IconeCheck className="text-ok" /> Confirmado</> : "Confirmar"}
              </button>
            </form>
            <form action={acaoRemoverTopico} className="ml-auto sm:ml-0">
              <input type="hidden" name="id" value={t.id} />
              <button
                disabled={removendoTopico || t.totalQuestoes > 0}
                aria-label={`Remover ${t.nome}`}
                title={
                  t.totalQuestoes > 0
                    ? "Tópico em uso por questões de atividades não pode ser removido"
                    : `Remover ${t.nome}`
                }
                className="btn btn-sm min-w-11 px-3 text-muted hover:text-danger sm:min-w-0 sm:px-2"
              >
                <IconeX />
              </button>
            </form>
          </li>
        ))}
        {material.topicos.length === 0 && (
          <li className="text-sm text-muted">Nenhum tópico ainda. Adicione um tópico abaixo.</li>
        )}
      </ul>

      {adicionandoTopico && (
        <form
          ref={formNovoTopicoRef}
          action={acaoCriarTopico}
          className="space-y-2.5 rounded-lg bg-sunken p-3.5"
        >
          <input type="hidden" name="material_id" value={material.id} />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="text-xs text-muted">
              Nome do tópico
              <input
                name="nome"
                placeholder="Ex.: Lei da Inércia"
                maxLength={100}
                required
                autoFocus
                className="field mt-1"
              />
            </label>
            <label className="text-xs text-muted">
              Descrição curta (opcional)
              <input
                name="descricao"
                placeholder="Ajuda a IA a focar nas questões"
                maxLength={240}
                className="field mt-1"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button disabled={criandoTopico} className="btn btn-primary btn-sm">
              {criandoTopico ? "Adicionando…" : "Adicionar tópico"}
            </button>
            <button
              type="button"
              onClick={() => setAdicionandoTopico(false)}
              className="btn btn-secondary btn-sm text-muted"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        {!adicionandoTopico ? (
          <button
            type="button"
            onClick={() => setAdicionandoTopico(true)}
            className="btn btn-secondary btn-sm"
          >
            + Adicionar tópico
          </button>
        ) : (
          <span />
        )}

        {confirmandoExclusao ? (
          <form action={acaoExcluir} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="material_id" value={material.id} />
            <span className="text-xs text-danger">
              {material.totalAtividades > 0
                ? `Usado em ${material.totalAtividades} ${material.totalAtividades === 1 ? "atividade" : "atividades"} (elas continuam no diagnóstico, mas sem link para o material).`
                : "Excluir este material permanentemente?"}
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
              setEditando(false);
            }}
            className="btn btn-danger btn-sm"
          >
            Excluir material
          </button>
        )}
      </div>
    </li>
  );
}
