import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { sair } from "../auth/actions";

export const metadata = { title: "Minhas atividades — s.ai" };

export default function AlunoPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-zinc-500">Carregando…</p>}>
        <Conteudo />
      </Suspense>
    </main>
  );
}

async function Conteudo() {
  await connection();
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.profile.papel !== "aluno") redirect("/");
  const { supabase, profile } = sessao;

  const [{ data: turma }, { data: atividades }, { data: entregas }] = await Promise.all([
    supabase.from("turmas").select("nome").eq("id", profile.turma_id!).maybeSingle(),
    supabase.from("atividades").select("id, titulo, prazo, publicada_em").eq("status", "publicada")
      .order("publicada_em", { ascending: false }),
    supabase.from("entregas").select("atividade_id, enviada_em"),
  ]);
  const entregues = new Set(entregas?.map((e) => e.atividade_id));

  return (
    <>
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {profile.nome}</h1>
          <p className="text-sm text-zinc-500">Turma {turma?.nome}</p>
        </div>
        <form action={sair}>
          <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700">Sair</button>
        </form>
      </header>

      <h2 className="mb-3 font-medium">Atividades</h2>
      <ul className="space-y-2">
        {atividades?.map((a) => {
          const feita = entregues.has(a.id);
          const encerrada = !feita && a.prazo && new Date(a.prazo) < new Date();
          return (
            <li key={a.id}>
              <Link
                href={`/aluno/atividades/${a.id}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <span>
                  <span className="font-medium">{a.titulo}</span>
                  {a.prazo && (
                    <span className="ml-2 text-sm text-zinc-500">prazo {new Date(a.prazo).toLocaleDateString("pt-BR")}</span>
                  )}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${feita ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : encerrada ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800" : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>
                  {feita ? "entregue" : encerrada ? "encerrada" : "a fazer"}
                </span>
              </Link>
            </li>
          );
        })}
        {atividades?.length === 0 && (
          <li className="text-sm text-zinc-500">Nenhuma atividade publicada para sua turma ainda.</li>
        )}
      </ul>
    </>
  );
}
