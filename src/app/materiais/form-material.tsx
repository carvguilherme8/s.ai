"use client";

import { useActionState } from "react";
import { NOMES_DISCIPLINAS } from "@/lib/disciplinas";
import { criarMaterial, type EstadoForm } from "./actions";

const campo = "field";

export function FormMaterial({ turmas }: { turmas: { id: string; nome: string }[] }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(criarMaterial, undefined);

  return (
    <form action={acao} className="card space-y-3 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <input name="titulo" placeholder="Título (ex.: Funções do 2º grau)" required className={campo} />
        <select name="turma_id" required className={campo}>
          {turmas.map((t) => (
            <option key={t.id} value={t.id}>{t.nome}</option>
          ))}
        </select>
      </div>
      <label className="block text-sm text-muted">
        Disciplina
        <select name="disciplina" defaultValue="" className={`${campo} mt-1 sm:max-w-xs`}>
          <option value="">A IA sugere (você pode trocar depois)</option>
          {NOMES_DISCIPLINAS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>
      <textarea name="texto" rows={6} placeholder="Cole o texto do material aqui…" className={campo} />
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="text-muted">
          …ou envie um PDF com texto:{" "}
          <input type="file" name="pdf" accept="application/pdf" />
        </label>
        <button
          disabled={pendente}
          className="btn btn-primary w-full sm:ml-auto sm:w-auto"
        >
          {pendente ? "Processando…" : "Enviar e extrair tópicos"}
        </button>
      </div>
      {pendente && <p className="text-sm text-muted">A IA está lendo o material; pode levar até um minuto.</p>}
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
    </form>
  );
}
