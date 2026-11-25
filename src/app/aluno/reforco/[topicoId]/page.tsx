import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";
import { Bolinhas } from "../../../bolinhas";
import { IconeVoltar } from "../../../icones";
import { PraticaReforco } from "./pratica-reforco";

export const metadata = { title: "Reforço — s.ai" };

// A geração de questões e feedback com IA pode demorar.
export const maxDuration = 120;

const pct = (d: number) => `${Math.round(d * 100)}%`;

export default function ReforcoPage({ params }: PageProps<"/aluno/reforco/[topicoId]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <Link href="/aluno" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconeVoltar /> Minhas atividades
      </Link>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params }: { params: PageProps<"/aluno/reforco/[topicoId]">["params"] }) {
  await connection();
  const { topicoId } = await params;
  const sessao = await getSessao();
  if (!sessao) redirect("/entrar");
  if (sessao.profile.papel !== "aluno") redirect("/");
  const { supabase } = sessao;

  const [{ data: topico }, { data: respostas }] = await Promise.all([
    supabase
      .from("topicos")
      .select("id, nome, descricao, material:materiais(id, titulo, disciplina)")
      .eq("id", topicoId)
      .maybeSingle(),
    supabase
      .from("respostas")
      .select(
        "nota_ia, nota_ajustada, questao:questoes(topico_id, trecho:material_trechos(pagina)), alternativa:alternativas(correta, equivoco)",
      ),
  ]);
  if (!topico) notFound();

  const notas: number[] = [];
  const paginasErradas = new Map<number, number>();
  const equivocos = new Map<string, number>();

  for (const r of respostas ?? []) {
    if (r.questao?.topico_id !== topico.id) continue;
    const nota = r.nota_ajustada ?? r.nota_ia;
    if (nota !== null) {
      notas.push(Number(nota));
      const pg = r.questao?.trecho?.pagina;
      if (Number(nota) < 1 && pg) paginasErradas.set(pg, (paginasErradas.get(pg) ?? 0) + 1);
    }
    const eq = r.alternativa && !r.alternativa.correta ? r.alternativa.equivoco : null;
    if (eq) equivocos.set(eq, (equivocos.get(eq) ?? 0) + 1);
  }

  const dominio = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  const lacuna = notas.length >= MIN_QUESTOES && dominio !== null && dominio < LIMIAR_LACUNA;
  const pagina = [...paginasErradas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const principaisEquivocos = [...equivocos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const linkMaterial = topico.material?.id
    ? `/aluno/materiais/${topico.material.id}${pagina ? `?p=${pagina}#p${pagina}` : ""}`
    : null;

  return (
    <div className="mt-2 space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-neutral">Modo prática</span>
          {topico.material?.disciplina && <span className="badge badge-neutral">{topico.material.disciplina}</span>}
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Reforço: {lacuna ? <span className="grifo">{topico.nome}</span> : topico.nome}
        </h1>
        <p className="text-sm text-muted">
          Questões extras para você praticar no seu ritmo. Não entram no seu Domínio nem no Diagnóstico.
        </p>
      </header>

      {(dominio !== null || linkMaterial || principaisEquivocos.length > 0) && (
        <section className="rounded-xl bg-sunken p-4 text-sm space-y-3">
          {dominio !== null && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Seu domínio atual neste tópico</p>
                <p className="text-xs text-muted">
                  {notas.filter((n) => n >= 1).length} de {notas.length} {notas.length === 1 ? "certa" : "certas"}
                  {lacuna ? " · abaixo da meta" : ""}
                </p>
              </div>
              <div className="text-right">
                <p className={`font-display text-xl font-bold tabular-nums ${lacuna ? "text-danger" : ""}`}>
                  {pct(dominio)}
                </p>
                <Bolinhas valor={dominio} className={`mt-1 ${lacuna ? "text-danger" : "text-ok"}`} />
              </div>
            </div>
          )}

          {principaisEquivocos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted">Pontos de atenção das suas entregas anteriores:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink">
                {principaisEquivocos.map(([eq]) => (
                  <li key={eq}>{eq}</li>
                ))}
              </ul>
            </div>
          )}

          {linkMaterial && (
            <Link href={linkMaterial} className="inline-flex min-h-9 items-center text-sm font-medium text-link hover:underline">
              Revisar no material ({topico.material?.titulo}{pagina ? `, p. ${pagina}` : ""})
            </Link>
          )}
        </section>
      )}

      <PraticaReforco topicoId={topico.id} />
    </div>
  );
}
