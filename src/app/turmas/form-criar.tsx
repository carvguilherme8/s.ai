"use client";

import { useActionState, useEffect, useRef } from "react";
import { criarTurma, type EstadoAcao } from "./actions";

export function FormCriarTurma() {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(criarTurma, undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (estado?.ok && inputRef.current) {
      inputRef.current.value = "";
    }
  }, [estado]);

  return (
    <form action={acao} className="card space-y-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm text-muted">
          Nova turma
          <input
            ref={inputRef}
            name="nome"
            placeholder="Ex.: 1ºC ou 2ºB — Manhã"
            maxLength={60}
            required
            className="field mt-1"
          />
        </label>
        <button disabled={pendente} className="btn btn-primary w-full sm:w-auto">
          {pendente ? "Criando…" : "Criar turma"}
        </button>
      </div>
      <p className="text-xs text-muted">
        O código de convite é gerado automaticamente para você compartilhar com os alunos.
      </p>
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
      {estado?.ok && <p role="status" className="text-sm text-ok">{estado.ok}</p>}
    </form>
  );
}
