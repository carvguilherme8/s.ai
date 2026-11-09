import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessao } from "@/lib/supabase/server";
import { sair } from "../auth/actions";
import { criarTurma } from "./actions";

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Carregando…</p>}>
        <Painel />
      </Suspense>
    </main>
  );
}

async function Painel() {
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  const { supabase, profile } = sessao;

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome, codigo_convite")
    .order("created_at");

  return (
    <>
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">{profile.papel === "professor" ? "Professor" : "Aluno"}</p>
          <h1 className="text-2xl font-semibold">Olá, {profile.nome}</h1>
        </div>
        <form action={sair}>
          <button className="text-sm underline">Sair</button>
        </form>
      </header>

      {profile.papel === "professor" ? (
        <section className="space-y-4">
          <h2 className="font-medium">Suas Turmas</h2>
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {turmas?.length ? (
              turmas.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-4 py-3">
                  <span>{t.nome}</span>
                  <code className="rounded bg-zinc-100 px-2 py-0.5 text-sm dark:bg-zinc-800">{t.codigo_convite}</code>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-sm text-zinc-500">Nenhuma Turma ainda.</li>
            )}
          </ul>
          <form action={criarTurma} className="flex gap-2">
            <input
              name="nome"
              required
              placeholder="Nome da Turma (ex.: 2ºA)"
              className="flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">
              Criar
            </button>
          </form>
        </section>
      ) : (
        <section>
          <p>
            Sua Turma: <strong>{turmas?.[0]?.nome ?? "—"}</strong>
          </p>
        </section>
      )}
    </>
  );
}
