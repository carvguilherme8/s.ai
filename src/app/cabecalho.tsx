"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { sair } from "./auth/actions";

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
    <header className="sticky top-0 z-20 bg-bar text-bar-ink">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:gap-x-6">
        <Link href={aluno ? "/aluno" : "/"} className="font-display text-xl font-bold tracking-tight" aria-label="s.ai, início">
          s<span className="grifo ml-1">.ai</span>
        </Link>

        {aluno && <span className="text-sm text-bar-ink/70">Área do aluno</span>}

        {!aluno && !auth && (
          <nav aria-label="Principal" className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {ITENS.map((item) => {
              const ativo = item.exato ? caminho === item.href : caminho.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className="rounded-lg px-1.5 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap sm:px-3 sm:text-sm"
                >
                  <span className={ativo ? "grifo" : "text-bar-ink/70 transition-colors hover:text-bar-ink"}>{item.rotulo}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {!aluno && !auth && (
          <form action={sair} className="ml-auto">
            <button className="rounded-lg px-2 py-1.5 text-sm text-bar-ink/70 transition-colors hover:text-bar-ink">Sair</button>
          </form>
        )}
      </div>
    </header>
  );
}
