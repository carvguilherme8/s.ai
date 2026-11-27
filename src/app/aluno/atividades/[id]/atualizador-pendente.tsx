"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Remove o rascunho do localStorage somente depois que a entrega foi confirmada no servidor. */
export function LimparRascunhoLocal({ chave }: { chave: string }) {
  useEffect(() => {
    try {
      window.localStorage.removeItem(chave);
    } catch {
      // Ignora se bloqueado
    }
  }, [chave]);
  return null;
}

/** Atualiza a página discretamente enquanto houver dissertativas sendo corrigidas em background. */
export function AtualizadorPendente({ ativo }: { ativo: boolean }) {
  const router = useRouter();
  const [tentativas, setTentativas] = useState(0);

  useEffect(() => {
    if (!ativo || tentativas >= 15) return;
    const timer = setTimeout(() => {
      setTentativas((t) => t + 1);
      router.refresh();
    }, 3000);
    return () => clearTimeout(timer);
  }, [ativo, tentativas, router]);

  if (!ativo) return null;
  return (
    <div role="status" className="card flex flex-wrap items-center justify-between gap-2 bg-sunken px-4 py-3 text-sm">
      <span>
        <span className="grifo font-medium">Corrigindo suas respostas dissertativas…</span>{" "}
        <span className="text-muted">Esta página atualiza sozinha em alguns segundos.</span>
      </span>
      <button type="button" onClick={() => router.refresh()} className="btn btn-secondary btn-sm text-xs">
        Atualizar agora
      </button>
    </div>
  );
}
