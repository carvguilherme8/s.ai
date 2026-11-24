"use client";

import { useActionState } from "react";
import { gerarAtividade, type EstadoForm } from "./actions";

const campo = "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

type Material = { id: string; titulo: string; turma_id: string; confirmados: number };

export function FormGerar({ materiais, turmas }: { materiais: Material[]; turmas: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(gerarAtividade, undefined);
  const prontos = materiais.filter((m) => m.confirmados > 0);

  if (!prontos.length) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700">
        Para gerar questões, envie um material e confirme ao menos um tópico em{" "}
        <a href="/materiais" className="underline">Materiais</a>.
      </p>
    );
  }

  return (
    <form action={acao} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <input name="titulo" placeholder="Título da atividade (ex.: Lista 1 — Leis de Newton)" required className={campo} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-zinc-500">
          Material
          <select name="material_id" required className={`${campo} mt-1`}>
            {prontos.map((m) => (
              <option key={m.id} value={m.id}>{m.titulo} ({m.confirmados} tópicos)</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-500">
          Turma
          <select name="turma_id" required className={`${campo} mt-1`}>
            {turmas.map((t) => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-zinc-500">
          Múltipla escolha por tópico
          <input type="number" name="mc_por_topico" min={0} max={5} defaultValue={3} className={`${campo} mt-1`} />
        </label>
        <label className="text-sm text-zinc-500">
          Dissertativas (no total)
          <input type="number" name="dissertativas" min={0} max={3} defaultValue={1} className={`${campo} mt-1`} />
        </label>
      </div>
      <button
        disabled={pendente}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pendente ? "Gerando questões…" : "Gerar questões com IA"}
      </button>
      {pendente && <p className="text-sm text-zinc-500">A IA está elaborando as questões; pode levar um ou dois minutos.</p>}
      {estado?.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
    </form>
  );
}
