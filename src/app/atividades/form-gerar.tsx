"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { gerarAtividade, type EstadoForm } from "./actions";

const campo = "field";

type Material = {
  id: string;
  titulo: string;
  turma_id: string;
  topicos: { id: string; nome: string }[];
};

export function FormGerar({ materiais, turmas }: { materiais: Material[]; turmas: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(gerarAtividade, undefined);
  const prontos = materiais.filter((m) => m.topicos.length > 0);

  const [materialId, setMaterialId] = useState(prontos[0]?.id ?? "");
  const materialAtual = prontos.find((m) => m.id === materialId) ?? prontos[0];
  const [selecionados, setSelecionados] = useState<string[]>(() => materialAtual?.topicos.map((t) => t.id) ?? []);

  if (!turmas.length) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
        Antes de gerar uma atividade, crie pelo menos uma turma em{" "}
        <Link href="/turmas" className="underline">Turmas</Link>.
      </p>
    );
  }

  if (!prontos.length || !materialAtual) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
        Para gerar questões, envie um material e confirme ao menos um tópico em{" "}
        <Link href="/materiais" className="underline">Materiais</Link>.
      </p>
    );
  }

  const idsAtuais = new Set(materialAtual.topicos.map((t) => t.id));
  const ativos = selecionados.filter((id) => idsAtuais.has(id));
  const todosMarcados = ativos.length === materialAtual.topicos.length;

  function trocarMaterial(novoId: string) {
    setMaterialId(novoId);
    const mat = prontos.find((m) => m.id === novoId);
    setSelecionados(mat ? mat.topicos.map((t) => t.id) : []);
  }

  function alternarTopico(id: string) {
    setSelecionados((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }

  return (
    <form action={acao} className="card space-y-4 p-4">
      <input name="titulo" placeholder="Título da atividade (ex.: Lista 1 — Leis de Newton)" required className={campo} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          Material
          <select
            name="material_id"
            value={materialAtual.id}
            onChange={(e) => trocarMaterial(e.target.value)}
            required
            className={`${campo} mt-1`}
          >
            {prontos.map((m) => (
              <option key={m.id} value={m.id}>{m.titulo} ({m.topicos.length} {m.topicos.length === 1 ? "tópico" : "tópicos"})</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          Turma
          <select name="turma_id" required className={`${campo} mt-1`}>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-muted">
          Múltipla escolha por tópico
          <input type="number" name="mc_por_topico" min={0} max={5} defaultValue={3} className={`${campo} mt-1`} />
        </label>
        <label className="text-sm text-muted">
          Dissertativas (no total)
          <input type="number" name="dissertativas" min={0} max={3} defaultValue={1} className={`${campo} mt-1`} />
        </label>
      </div>

      <fieldset className="space-y-2 rounded-lg bg-sunken p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-xs font-semibold text-muted">
            Tópicos incluídos ({ativos.length} de {materialAtual.topicos.length})
          </legend>
          {materialAtual.topicos.length > 1 && (
            <button
              type="button"
              onClick={() => setSelecionados(todosMarcados ? [] : materialAtual.topicos.map((t) => t.id))}
              className="text-xs font-medium text-link hover:underline"
            >
              {todosMarcados ? "Desmarcar todos" : "Selecionar todos"}
            </button>
          )}
        </div>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {materialAtual.topicos.map((t) => {
            const marcado = ativos.includes(t.id);
            return (
              <li key={t.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-surface">
                  <input
                    type="checkbox"
                    name="topico_ids"
                    value={t.id}
                    checked={marcado}
                    onChange={() => alternarTopico(t.id)}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 truncate">{t.nome}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <button
        disabled={pendente || ativos.length === 0}
        className="btn btn-primary"
      >
        {pendente ? "Gerando questões…" : "Gerar questões com IA"}
      </button>
      {pendente && <p className="text-sm text-muted">A IA está elaborando as questões; pode levar um ou dois minutos.</p>}
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
    </form>
  );
}
