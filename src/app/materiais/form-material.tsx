"use client";

import { useActionState } from "react";
import { criarMaterial, type EstadoForm } from "./actions";

const campo =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

export function FormMaterial({ turmas }: { turmas: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(criarMaterial, undefined);

  return (
    <form action={acao} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <input name="titulo" placeholder="Título (ex.: Funções do 2º grau)" required className={campo} />
        <select name="turma_id" required className={campo}>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
      </div>
      <textarea name="texto" rows={6} placeholder="Cole o texto do material aqui…" className={campo} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="text-zinc-500">
          …ou envie um PDF com texto:{" "}
          <input type="file" name="pdf" accept="application/pdf" />
        </label>
        <button
          disabled={pendente}
          className="ml-auto rounded-md bg-zinc-900 px-4 py-2 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pendente ? "Processando…" : "Enviar e extrair tópicos"}
        </button>
      </div>
      {pendente && <p className="text-sm text-zinc-500">A IA está lendo o material; pode levar até um minuto.</p>}
      {estado?.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
    </form>
  );
}
