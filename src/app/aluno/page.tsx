import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { sair } from "../auth/actions";
import { IconeSair } from "../icones";

export const metadata = { title: "Minhas atividades — s.ai" };

export default function AlunoPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
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
          <p className="text-sm text-muted">Turma {turma?.nome}</p>
        </div>
        <form action={sair}>
          <button className="btn btn-secondary btn-sm">Sair <IconeSair /></button>
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
                className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken"
              >
                <span>
                  <span className="font-medium">{a.titulo}</span>
                  {a.prazo && (
                    <span className="ml-2 text-sm text-muted">prazo {new Date(a.prazo).toLocaleDateString("pt-BR")}</span>
                  )}
                </span>
                <span className={`badge ${feita ? "badge-ok" : encerrada ? "badge-neutral" : "badge-warn"}`}>
                  {feita ? "entregue" : encerrada ? "encerrada" : "a fazer"}
                </span>
              </Link>
            </li>
          );
        })}
        {atividades?.length === 0 && (
          <li className="text-sm text-muted">Nenhuma atividade publicada para sua turma ainda.</li>
        )}
      </ul>
    </>
  );
}
