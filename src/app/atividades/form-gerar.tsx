"use client";

import { useActionState } from "react";
import { gerarAtividade, type EstadoForm } from "./actions";

const campo = "field";

type Material = { id: string; titulo: string; turma_id: string; confirmados: number };

export function FormGerar({ materiais, turmas }: { materiais: Material[]; turmas: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(gerarAtividade, undefined);
  const prontos = materiais.filter((m) => m.confirmados > 0);

  if (!prontos.length) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong p-4 text-sm text-muted">
        Para gerar questões, envie um material e confirme ao menos um tópico em{" "}
        <a href="/materiais" className="underline">Materiais</a>.
      </p>
    );
  }

  return (
    <form action={acao} className="card space-y-3 p-4">
      <input name="titulo" placeholder="Título da atividade (ex.: Lista 1 — Leis de Newton)" required className={campo} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">
          Material
          <select name="material_id" required className={`${campo} mt-1`}>
            {prontos.map((m) => (
              <option key={m.id} value={m.id}>{m.titulo} ({m.confirmados} tópicos)</option>
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
      <button
        disabled={pendente}
        className="btn btn-primary"
      >
        {pendente ? "Gerando questões…" : "Gerar questões com IA"}
      </button>
      {pendente && <p className="text-sm text-muted">A IA está elaborando as questões; pode levar um ou dois minutos.</p>}
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
    </form>
  );
}
