"use client";

import { useActionState } from "react";
import { cadastrar, entrar } from "./actions";

const campo =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const botao =
  "w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";

export function FormEntrar() {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="space-y-3">
      <input name="email" type="email" required placeholder="E-mail" autoComplete="email" defaultValue={estado?.valores?.email} className={campo} />
      <input name="senha" type="password" required placeholder="Senha" autoComplete="current-password" className={campo} />
      {estado?.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
      <button disabled={pendente} className={botao}>{pendente ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao, pendente] = useActionState(cadastrar, undefined);
  return (
    <form action={acao} className="space-y-3">
      <input name="nome" required placeholder="Nome" autoComplete="name" defaultValue={estado?.valores?.nome} className={campo} />
      <input name="codigo" required placeholder="Código de convite da turma" defaultValue={estado?.valores?.codigo} className={`${campo} uppercase`} />
      <input name="email" type="email" required placeholder="E-mail" autoComplete="email" defaultValue={estado?.valores?.email} className={campo} />
      <input name="senha" type="password" required minLength={6} placeholder="Senha (mín. 6)" autoComplete="new-password" className={campo} />
      {estado?.erro && <p role="alert" className="text-sm text-red-600">{estado.erro}</p>}
      <button disabled={pendente} className={botao}>{pendente ? "Criando conta…" : "Criar conta"}</button>
    </form>
  );
}
