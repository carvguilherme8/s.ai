"use client";

import { useState } from "react";
import { IconeCheck, IconeCopiar } from "../icones";

/** Leva o diagnóstico para fora do site: WhatsApp, PDF/impressão e planilha CSV para Diário de Classe. */
export function AcoesRelatorio({
  texto,
  turmaId,
  disciplina,
}: {
  texto: string;
  turmaId: string;
  disciplina?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch {
      window.prompt("Copie o resumo:", texto);
    }
  }

  const csvUrl = `/api/diagnostico/csv?turma=${encodeURIComponent(turmaId)}${
    disciplina ? `&disc=${encodeURIComponent(disciplina)}` : ""
  }`;

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button type="button" onClick={copiar} className="btn btn-secondary btn-sm">
        {copiado ? <IconeCheck className="text-ok" /> : <IconeCopiar className="text-muted" />}
        {copiado ? "Resumo copiado" : "Copiar resumo"}
      </button>
      <a href={csvUrl} download className="btn btn-secondary btn-sm">
        Baixar planilha (CSV)
      </a>
      <button type="button" onClick={() => window.print()} className="btn btn-secondary btn-sm">
        Imprimir ou salvar em PDF
      </button>
      <span role="status" className="sr-only">
        {copiado ? "Resumo copiado para a área de transferência" : ""}
      </span>
    </div>
  );
}
