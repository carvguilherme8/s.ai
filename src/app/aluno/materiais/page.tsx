import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { areaDaDisciplina, ordemDaDisciplina, SEM_DISCIPLINA } from "@/lib/disciplinas";
import { getSessao } from "@/lib/supabase/server";
import { IconeLivro } from "../../icones";

export const metadata = { title: "Materiais — s.ai" };

export default function MateriaisAlunoPage() {
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

  // O RLS já limita aos materiais da turma do aluno.
  const { data: materiais } = await sessao.supabase
    .from("materiais")
    .select("id, titulo, tipo, disciplina, created_at")
    .order("created_at", { ascending: false });

  const grupos = new Map<string, NonNullable<typeof materiais>>();
  for (const m of materiais ?? []) {
    const chave = m.disciplina ?? SEM_DISCIPLINA;
    (grupos.get(chave) ?? grupos.set(chave, []).get(chave)!).push(m);
  }
  const ordenados = [...grupos.entries()].sort(
    ([a], [b]) => ordemDaDisciplina(a === SEM_DISCIPLINA ? null : a) - ordemDaDisciplina(b === SEM_DISCIPLINA ? null : b),
  );

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Materiais da turma</h1>
      <p className="mt-1 mb-8 text-sm text-muted">
        Os textos e PDFs que o professor enviou, separados por disciplina, para você revisar quando quiser.
      </p>

      {ordenados.length === 0 && (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
          O professor ainda não enviou materiais para a sua turma.
        </p>
      )}

      <div className="space-y-9">
        {ordenados.map(([disciplina, lista]) => {
          const area = areaDaDisciplina(disciplina === SEM_DISCIPLINA ? null : disciplina);
          return (
            <section key={disciplina} aria-label={disciplina}>
              <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 font-display text-xl font-bold">
                {disciplina}
                {area && <span className="font-sans text-xs font-normal text-muted">{area}</span>}
              </h2>
              <ul className="space-y-2">
                {lista.map((m) => (
                  <li key={m.id}>
                    <Link
                      href={`/aluno/materiais/${m.id}`}
                      className="card flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-sunken"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <IconeLivro className="text-xl text-muted" />
                        <span className="truncate font-medium">{m.titulo}</span>
                      </span>
                      <span className="badge badge-neutral">{m.tipo === "pdf" ? "PDF" : "texto"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
