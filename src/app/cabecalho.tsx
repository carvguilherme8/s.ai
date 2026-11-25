"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { sair } from "./auth/actions";
import { IconeGrade, IconeLista, IconeLivro, IconeMapa, IconeMenu, IconeSair, IconeTurmas, IconeX } from "./icones";

const ITENS = [
  { href: "/", rotulo: "Painel", exato: true, Icone: IconeGrade },
  { href: "/turmas", rotulo: "Turmas", exato: false, Icone: IconeTurmas },
  { href: "/materiais", rotulo: "Materiais", exato: false, Icone: IconeLivro },
  { href: "/atividades", rotulo: "Atividades", exato: false, Icone: IconeLista },
  { href: "/diagnostico", rotulo: "Diagnóstico", exato: false, Icone: IconeMapa },
];

export function Cabecalho() {
  const caminho = usePathname();
  const aluno = caminho.startsWith("/aluno");
  const auth = caminho === "/entrar" || caminho === "/cadastro";
  const professora = !aluno && !auth;
  const ativo = (item: (typeof ITENS)[number]) => (item.exato ? caminho === item.href : caminho.startsWith(item.href));

  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLElement>(null);

  // Fecha o dropdown ao tocar fora dele ou com Esc.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <header ref={raiz} className="sticky top-0 z-20 bg-bar text-bar-ink">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-x-6 px-4 py-1.5 sm:py-2.5">
        <Link
          href={aluno ? "/aluno" : "/"}
          className="inline-flex min-h-10 items-center font-display text-xl font-bold tracking-tight"
          aria-label="s.ai, início"
        >
          s<span className="grifo ml-1">.ai</span>
        </Link>

        {aluno && (
          <nav aria-label="Aluno" className="flex items-center gap-1">
            {[
              { href: "/aluno", rotulo: "Atividades", on: caminho === "/aluno" || caminho.startsWith("/aluno/atividades") || caminho.startsWith("/aluno/reforco") },
              { href: "/aluno/materiais", rotulo: "Materiais", on: caminho.startsWith("/aluno/materiais") },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.on ? "page" : undefined}
                className="rounded-lg px-2.5 py-1.5 text-sm font-medium whitespace-nowrap"
              >
                <span className={item.on ? "grifo" : "text-bar-ink/70 transition-colors hover:text-bar-ink"}>{item.rotulo}</span>
              </Link>
            ))}
          </nav>
        )}

        {/* Telas largas: links direto no topo */}
        {professora && (
          <nav aria-label="Principal" className="hidden min-w-0 flex-1 items-center gap-1 sm:flex">
            {ITENS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo(item) ? "page" : undefined}
                className="rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap"
              >
                <span className={ativo(item) ? "grifo" : "text-bar-ink/70 transition-colors hover:text-bar-ink"}>{item.rotulo}</span>
              </Link>
            ))}
          </nav>
        )}

        {professora && (
          <form action={sair} className="ml-auto hidden sm:block">
            <button className="inline-flex min-h-10 items-center rounded-lg px-2 text-sm text-bar-ink/70 transition-colors hover:text-bar-ink">Sair</button>
          </form>
        )}

        {/* Celular: botão que abre o dropdown */}
        {professora && (
          <button
            type="button"
            aria-expanded={aberto}
            aria-controls="menu-professora"
            onClick={() => setAberto((v) => !v)}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium sm:hidden"
          >
            {aberto ? <IconeX className="text-xl" /> : <IconeMenu className="text-xl" />}
            Menu
          </button>
        )}
      </div>

      {professora && (
        <div
          id="menu-professora"
          hidden={!aberto}
          className="absolute inset-x-0 top-full border-t border-bar-ink/15 bg-bar pb-2 shadow-[0_14px_28px_rgba(22,24,29,0.28)] sm:hidden"
        >
          <nav aria-label="Principal (celular)" className="mx-auto w-full max-w-5xl">
            <ul>
              {ITENS.map((item) => {
                const on = ativo(item);
                const Icone = item.Icone;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={on ? "page" : undefined}
                      onClick={() => setAberto(false)}
                      className="flex min-h-12 items-center gap-3 px-5 text-base font-medium"
                    >
                      <Icone className={`text-xl ${on ? "text-hl" : "text-bar-ink/70"}`} />
                      <span className={on ? "grifo" : "text-bar-ink"}>{item.rotulo}</span>
                    </Link>
                  </li>
                );
              })}
              <li className="mt-1 border-t border-bar-ink/15 pt-1">
                <form action={sair}>
                  <button className="flex min-h-12 w-full items-center gap-3 px-5 text-base font-medium text-bar-ink/80">
                    <IconeSair className="text-xl" />
                    Sair
                  </button>
                </form>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
