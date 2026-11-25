"use client";

import { useState } from "react";
import { IconeCheck, IconeCopiar } from "./icones";

/** Mostra o código de convite e copia com um clique. */
export function CopiarCodigo({ codigo }: { codigo: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sem permissão de área de transferência: o código continua visível para copiar à mão.
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      title="Copiar código de convite"
      className="btn btn-secondary btn-sm font-mono tracking-wider"
    >
      {codigo}
      {copiado ? <IconeCheck className="text-accent" /> : <IconeCopiar className="text-muted" />}
      <span role="status" className="sr-only">{copiado ? "Código copiado" : ""}</span>
    </button>
  );
}
