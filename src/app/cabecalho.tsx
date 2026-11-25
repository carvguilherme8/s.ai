"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITENS = [
  { href: "/", rotulo: "Painel", exato: true },
  { href: "/materiais", rotulo: "Materiais" },
  { href: "/atividades", rotulo: "Atividades" },
  { href: "/diagnostico", rotulo: "Diagnóstico" },
];

export function Cabecalho() {
  const caminho = usePathname();
  const aluno = caminho.startsWith("/aluno");
  const auth = caminho === "/entrar" || caminho === "/cadastro";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:gap-x-6">
        <Link href={aluno ? "/aluno" : "/"} className="text-lg font-semibold tracking-tight" aria-label="s.ai, início">
          s<span className="text-accent">.ai</span>
        </Link>

        {aluno && <span className="text-sm text-muted">Área do aluno</span>}

        {!aluno && !auth && (
          <nav aria-label="Principal" className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {ITENS.map((item) => {
              const ativo = item.exato ? caminho === item.href : caminho.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`rounded-lg px-2 py-1.5 text-sm whitespace-nowrap transition-colors sm:px-3 ${
                    ativo ? "bg-sunken font-medium text-ink" : "text-muted hover:bg-sunken hover:text-ink"
                  }`}
                >
                  {item.rotulo}
                </Link>
              );
            })}
          </nav>
        )}

        {!aluno && !auth && (
          <Link href="/entrar" className="ml-auto hidden text-sm text-muted hover:text-ink sm:block">
            Área do aluno
          </Link>
        )}
      </div>
    </header>
  );
}
