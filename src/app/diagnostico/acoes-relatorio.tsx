"use client";

import { useState } from "react";
import { IconeCheck, IconeCopiar } from "../icones";

/** Leva o diagnóstico para fora do site: copia um texto pronto para o WhatsApp ou imprime/salva em PDF. */
export function AcoesRelatorio({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      // Sem permissão de área de transferência: abre o texto para copiar à mão.
      window.prompt("Copie o resumo:", texto);
    }
  }

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button type="button" onClick={copiar} className="btn btn-secondary btn-sm">
        {copiado ? <IconeCheck className="text-ok" /> : <IconeCopiar className="text-muted" />}
        {copiado ? "Resumo copiado" : "Copiar resumo"}
      </button>
      <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-sm">
        Imprimir ou salvar em PDF
      </button>
      <span role="status" className="sr-only">{copiado ? "Resumo copiado para a área de transferência" : ""}</span>
    </div>
  );
}
