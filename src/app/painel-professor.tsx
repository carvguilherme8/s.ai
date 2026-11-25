import Link from "next/link";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { diagnosticosDoProfessor, lacunasDaTurma } from "@/lib/diagnostico";
import { CopiarCodigo } from "./copiar-codigo";
import { IconeLacuna, IconeSeta } from "./icones";

const pct = (d: number | null) => `${Math.round((d ?? 0) * 100)}%`;

export async function PainelProfessor() {
  await connection();
  const { supabase, professor, email } = await getProfessorAtual();

  const [{ data: turmas }, { data: materiais }, { data: topicos }, diagnosticos] = await Promise.all([
    supabase
      .from("turmas")
      .select("id, nome, codigo_convite, alunos:profiles!profiles_turma_fk(id, nome)")
      .eq("professor_id", professor.id)
      .order("nome"),
    supabase
      .from("materiais")
      .select("id, titulo, tipo, turma:turmas(nome)")
      .eq("professor_id", professor.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("topicos")
      .select("id, nome, confirmado")
      .eq("professor_id", professor.id)
      .order("nome"),
    diagnosticosDoProfessor(professor.id),
  ]);
  const diagPorTurma = new Map(diagnosticos.map((d) => [d.turma.id, d]));

  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Olá, {professor.nome}</h1>
        <p className="mt-1.5 max-w-prose text-muted">
          Descubra em segundos onde sua turma está travando — e o que revisar.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link href="/diagnostico" className="btn btn-primary">
            Ver diagnóstico <IconeSeta />
          </Link>
          <Link href="/materiais" className="btn btn-secondary">Enviar material</Link>
          <Link href="/atividades" className="btn btn-secondary">Nova atividade</Link>
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span className="badge badge-warn">login simulado</span>
          {email}
        </p>
      </header>

      <section aria-labelledby="h-turmas">
        <h2 id="h-turmas" className="mb-4 text-lg font-semibold">Turmas</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {turmas?.map((t) => {
            const diag = diagPorTurma.get(t.id);
            const lacunas = diag ? lacunasDaTurma(diag) : [];
            const principal = lacunas[0];
            const entregaram = diag?.alunos.filter((a) => a.entregou).length ?? 0;
            return (
              <article key={t.id} className="card flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{t.nome}</h3>
                    <p className="mt-0.5 text-sm text-muted">
                      {t.alunos.length} alunos{diag && diag.totalEntregas > 0 && ` · ${entregaram} entregaram`}
                    </p>
                  </div>
                  <CopiarCodigo codigo={t.codigo_convite} />
                </div>

                <div className="mt-4 flex-1">
                  {principal ? (
                    <Link
                      href={`/diagnostico?turma=${t.id}`}
                      className="group flex items-start gap-3 rounded-lg bg-danger-soft p-3"
                    >
                      <IconeLacuna className="mt-1 text-danger" />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block text-muted">Trava em</span>
                        <span className="block font-medium">{principal.nome}</span>
                      </span>
                      <span className="text-xl leading-none font-semibold text-danger tabular-nums">{pct(principal.dominio)}</span>
                    </Link>
                  ) : diag && diag.totalEntregas > 0 ? (
                    <p className="rounded-lg bg-accent-soft p-3 text-sm text-accent-soft-ink">Sem lacunas nos tópicos avaliados.</p>
                  ) : (
                    <p className="rounded-lg bg-sunken p-3 text-sm text-muted">Ainda sem entregas para diagnosticar.</p>
                  )}
                </div>

                {t.alunos.length > 0 && (
                  <details className="mt-4 text-sm">
                    <summary className="cursor-pointer text-muted hover:text-ink">Ver alunos</summary>
                    <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {t.alunos.map((a) => (
                        <li key={a.id} className="truncate">{a.nome.replace(" (fictício)", "")}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-10 sm:grid-cols-2">
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Materiais de apoio</h2>
            <Link href="/materiais" className="text-sm text-accent hover:underline">Gerenciar</Link>
          </div>
          {materiais?.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line bg-surface text-sm">
              {materiais.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                  <span className="min-w-0 truncate">{m.titulo}</span>
                  <span className="shrink-0 text-xs text-muted">{m.tipo === "pdf" ? "PDF" : "texto"} · {m.turma?.nome}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nenhum material ainda.</p>
          )}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-semibold">Tópicos</h2>
          {topicos?.length ? (
            <ul className="flex flex-wrap gap-2 text-sm">
              {topicos.slice(0, 10).map((t) => (
                <li key={t.id} className={`badge ${t.confirmado ? "badge-ok" : "badge-neutral"}`}>{t.nome}</li>
              ))}
              {topicos.length > 10 && (
                <li className="badge badge-neutral">+{topicos.length - 10} tópicos</li>
              )}
            </ul>
          ) : (
            <p className="text-sm text-muted">Os tópicos aparecem aqui depois do primeiro material.</p>
          )}
        </div>
      </section>
    </div>
  );
}
