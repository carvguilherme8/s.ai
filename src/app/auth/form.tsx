"use client";

import { useActionState, useState } from "react";
import { cadastrar, entrar } from "./actions";

const campo =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const botao =
  "w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export function FormEntrar() {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="space-y-3">
      <input name="email" type="email" required placeholder="E-mail" className={campo} />
      <input name="senha" type="password" required placeholder="Senha" className={campo} />
      {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      <button disabled={pendente} className={botao}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao, pendente] = useActionState(cadastrar, undefined);
  const [papel, setPapel] = useState<"aluno" | "professor">("aluno");
  return (
    <form action={acao} className="space-y-3">
      <div className="flex gap-2 text-sm">
        {(["aluno", "professor"] as const).map((p) => (
          <label
            key={p}
            className="flex-1 cursor-pointer rounded-md border border-zinc-300 px-3 py-2 text-center has-checked:border-zinc-900 has-checked:font-medium dark:border-zinc-700 dark:has-checked:border-zinc-100"
          >
            <input
              type="radio"
              name="papel"
              value={p}
              checked={papel === p}
              onChange={() => setPapel(p)}
              className="sr-only"
            />
            {p === "aluno" ? "Sou aluno" : "Sou professor"}
          </label>
        ))}
      </div>
      <input name="nome" required placeholder="Nome" className={campo} />
      {papel === "aluno" && (
        <input name="codigo" required placeholder="Código de convite da turma" className={`${campo} uppercase`} />
      )}
      <input name="email" type="email" required placeholder="E-mail" className={campo} />
      <input name="senha" type="password" required minLength={6} placeholder="Senha (mín. 6)" className={campo} />
      {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
      <button disabled={pendente} className={botao}>
        {pendente ? "Criando conta…" : "Criar conta"}
      </button>
    </form>
  );
}
