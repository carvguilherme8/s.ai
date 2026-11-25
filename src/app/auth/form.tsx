"use client";

import { useActionState } from "react";
import { cadastrar, entrar } from "./actions";

const campo = "field";
const botao = "btn btn-primary w-full";

export function FormEntrar() {
  const [estado, acao, pendente] = useActionState(entrar, undefined);
  return (
    <form action={acao} className="space-y-3">
      <input name="email" type="email" required placeholder="E-mail" autoComplete="email" defaultValue={estado?.valores?.email} className={campo} />
      <input name="senha" type="password" required placeholder="Senha" autoComplete="current-password" className={campo} />
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
      <button disabled={pendente} className={botao}>{pendente ? "Entrando…" : "Entrar"}</button>
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao, pendente] = useActionState(cadastrar, undefined);
  return (
    <form action={acao} className="space-y-3">
      <input name="nome" required placeholder="Nome" autoComplete="name" defaultValue={estado?.valores?.nome} className={campo} />
      <input name="codigo" required placeholder="Código de convite da turma" defaultValue={estado?.valores?.codigo} className={`${campo} not-placeholder-shown:uppercase`} />
      <input name="email" type="email" required placeholder="E-mail" autoComplete="email" defaultValue={estado?.valores?.email} className={campo} />
      <input name="senha" type="password" required minLength={6} placeholder="Senha (mín. 6)" autoComplete="new-password" className={campo} />
      {estado?.erro && <p role="alert" className="text-sm text-danger">{estado.erro}</p>}
      <button disabled={pendente} className={botao}>{pendente ? "Criando conta…" : "Criar conta"}</button>
    </form>
  );
}
