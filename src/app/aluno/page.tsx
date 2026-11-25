import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";
import { areaDaDisciplina, ordemDaDisciplina, SEM_DISCIPLINA } from "@/lib/disciplinas";
import { sair } from "../auth/actions";
import { Bolinhas } from "../bolinhas";
import { IconeSair } from "../icones";

const pct = (d: number) => `${Math.round(d * 100)}%`;

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

  const [{ data: turma }, { data: atividades }, { data: entregas }, { data: respostas }] = await Promise.all([
    supabase.from("turmas").select("nome").eq("id", profile.turma_id!).maybeSingle(),
    supabase.from("atividades").select("id, titulo, prazo, publicada_em").eq("status", "publicada")
      .order("publicada_em", { ascending: false }),
    supabase.from("entregas").select("atividade_id, enviada_em"),
    // O RLS já limita às respostas deste aluno.
    supabase.from("respostas").select(
      "nota_ia, nota_ajustada, questao:questoes(trecho:material_trechos(pagina), topico:topicos(id, nome, material:materiais(id, disciplina)))",
    ),
  ]);
  const entregues = new Set(entregas?.map((e) => e.atividade_id));

  // Domínio do próprio aluno por tópico (mesma regra do Diagnóstico da professora).
  type TopicoAluno = {
    nome: string;
    disciplina: string | null;
    materialId: string | null;
    notas: number[];
    paginasErradas: Map<number, number>;
  };
  const porTopico = new Map<string, TopicoAluno>();
  for (const r of respostas ?? []) {
    const t = r.questao?.topico;
    const nota = r.nota_ajustada ?? r.nota_ia;
    if (!t || nota === null) continue;
    const acc =
      porTopico.get(t.id) ??
      porTopico
        .set(t.id, { nome: t.nome, disciplina: t.material?.disciplina ?? null, materialId: t.material?.id ?? null, notas: [], paginasErradas: new Map() })
        .get(t.id)!;
    acc.notas.push(Number(nota));
    const pagina = r.questao?.trecho?.pagina;
    if (Number(nota) < 1 && pagina) acc.paginasErradas.set(pagina, (acc.paginasErradas.get(pagina) ?? 0) + 1);
  }
  const dominio = [...porTopico.entries()]
    .map(([id, t]) => {
      const dom = t.notas.reduce((a, b) => a + b, 0) / t.notas.length;
      // a página do material onde ele mais errou: é o melhor ponto de partida para revisar
      const pagina = [...t.paginasErradas.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        id, nome: t.nome, disciplina: t.disciplina, materialId: t.materialId, pagina,
        dominio: dom, respondidas: t.notas.length, acertos: t.notas.filter((n) => n >= 1).length,
        lacuna: t.notas.length >= MIN_QUESTOES && dom < LIMIAR_LACUNA,
      };
    })
    .sort((a, b) => a.dominio - b.dominio);
  type TopicoDominio = (typeof dominio)[number];

  const linkMaterial = (t: TopicoDominio) =>
    t.materialId ? `/aluno/materiais/${t.materialId}${t.pagina ? `?p=${t.pagina}#p${t.pagina}` : ""}` : null;

  // "Revise primeiro": os 3 tópicos mais fracos entre os que estão abaixo da meta.
  const plano = dominio.filter((t) => t.lacuna).slice(0, 3);

  // Domínio agrupado por disciplina (ordem do ENEM); dentro de cada uma, o mais fraco primeiro.
  const porDisciplina = new Map<string, TopicoDominio[]>();
  for (const t of dominio) {
    const chave = t.disciplina ?? SEM_DISCIPLINA;
    (porDisciplina.get(chave) ?? porDisciplina.set(chave, []).get(chave)!).push(t);
  }
  const grupos = [...porDisciplina.entries()].sort(
    ([a], [b]) => ordemDaDisciplina(a === SEM_DISCIPLINA ? null : a) - ordemDaDisciplina(b === SEM_DISCIPLINA ? null : b),
  );

  return (
    <>
      <header className="mb-8 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Olá, {profile.nome}</h1>
          <p className="text-sm text-muted">Turma {turma?.nome}</p>
        </div>
        <form action={sair}>
          <button className="btn btn-secondary btn-sm">Sair <IconeSair /></button>
        </form>
      </header>

      <h2 className="mb-3 font-display text-xl font-bold">Atividades</h2>
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

      {plano.length > 0 && (
        <section aria-labelledby="h-plano" className="mt-12">
          <h2 id="h-plano" className="mb-1 font-display text-xl font-bold">Revise primeiro</h2>
          <p className="mb-4 text-sm text-muted">Os tópicos em que você mais precisa de reforço, com o trecho do material para estudar.</p>
          <ol className="space-y-2">
            {plano.map((t) => {
              const href = linkMaterial(t);
              return (
                <li key={t.id} className="card flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium"><span className="grifo">{t.nome}</span></p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.disciplina ?? SEM_DISCIPLINA} · {t.acertos} de {t.respondidas} certas · <span className="font-medium text-danger">{pct(t.dominio)}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/aluno/reforco/${t.id}`} className="btn btn-primary btn-sm">
                      Praticar reforço
                    </Link>
                    {href && (
                      <Link href={href} className="btn btn-secondary btn-sm">
                        Abrir no material{t.pagina ? `, p. ${t.pagina}` : ""}
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {dominio.length > 0 && (
        <section aria-labelledby="h-dominio" className="mt-12">
          <h2 id="h-dominio" className="mb-1 font-display text-xl font-bold">Seu domínio por disciplina</h2>
          <p className="mb-5 text-sm text-muted">
            Onde você já vai bem e o que vale revisar. Abaixo de {pct(LIMIAR_LACUNA)} é o sinal para revisar.
          </p>
          <div className="space-y-8">
            {grupos.map(([disciplina, lista]) => {
              const media = lista.reduce((a, t) => a + t.dominio, 0) / lista.length;
              const area = areaDaDisciplina(disciplina === SEM_DISCIPLINA ? null : disciplina);
              return (
                <div key={disciplina}>
                  <h3 className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <span className="font-display text-lg font-bold">
                      {disciplina}
                      {area && area !== disciplina && <span className="ml-2 font-sans text-xs font-normal text-muted">{area}</span>}
                    </span>
                    <span className="text-xs text-muted">média <span className="font-semibold tabular-nums text-ink">{pct(media)}</span></span>
                  </h3>
                  <ul className="space-y-2">
                    {lista.map((t) => {
                      const href = t.lacuna ? linkMaterial(t) : null;
                      return (
                        <li key={t.id} className="card flex items-center justify-between gap-4 px-4 py-3">
                          <div className="min-w-0">
                            <p className="font-medium">{t.lacuna ? <span className="grifo">{t.nome}</span> : t.nome}</p>
                            <p className="mt-0.5 text-xs text-muted">
                              {t.acertos} de {t.respondidas} {t.respondidas === 1 ? "certa" : "certas"}
                              {t.lacuna && (
                                <>
                                  {" · "}
                                  <Link href={`/aluno/reforco/${t.id}`} className="font-medium text-link hover:underline">
                                    praticar reforço
                                  </Link>
                                </>
                              )}
                              {href && (
                                <>
                                  {" · "}
                                  <Link href={href} className="font-medium text-link hover:underline">abrir no material</Link>
                                </>
                              )}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className={`font-display text-xl font-bold tabular-nums ${t.lacuna ? "text-danger" : ""}`}>{pct(t.dominio)}</p>
                            <Bolinhas valor={t.dominio} className={`mt-1 ${t.lacuna ? "text-danger" : "text-ok"}`} />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
