"use client";

import { sair } from "../auth/actions";
import { IconeSair } from "../icones";

/** Limpa rascunhos locais (`sai:rascunho:*`) antes de sair para proteger celulares compartilhados. */
export function BotaoSairAluno() {
  function limparRascunhos() {
    try {
      const remover: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k?.startsWith("sai:rascunho:")) remover.push(k);
      }
      remover.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // Ignora se localStorage estiver bloqueado
    }
  }

  return (
    <form action={sair} onSubmit={limparRascunhos}>
      <button className="btn btn-secondary btn-sm">
        Sair <IconeSair />
      </button>
    </form>
  );
}
