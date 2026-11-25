import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { diagnosticosDoProfessor, lacunasDaTurma, LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";
import type { ResumoDiagnostico } from "@/lib/diagnostico-ia";
import { Bolinhas } from "../bolinhas";
import { IconeLacuna } from "../icones";
import { AcoesRelatorio } from "./acoes-relatorio";
import { BotaoReforco } from "./botao-reforco";
import { BotaoResumo } from "./botao-resumo";

export const metadata = { title: "Diagnóstico — s.ai" };

// Ações de IA nesta página demoram; permite até 120s no servidor (ver docs/DEPLOY.md).
export const maxDuration = 120;

const pct = (d: number) => `${Math.round(d * 100)}%`;

/** Cor da célula: divergente em torno do limiar. Abaixo = vermelho, acima = azul, no limite = cinza. */
function corCelula(d: number) {
  const t = d < LIMIAR_LACUNA ? (LIMIAR_LACUNA - d) / LIMIAR_LACUNA : (d - LIMIAR_LACUNA) / (1 - LIMIAR_LACUNA);
  const polo = d < LIMIAR_LACUNA ? "var(--hm-baixo)" : "var(--hm-alto)";
  return `color-mix(in oklab, var(--hm-neutro), ${polo} ${Math.round(t * 55)}%)`;
}

export default function DiagnosticoPage({ searchParams }: PageProps<"/diagnostico">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Diagnóstico da turma</h1>
      <p className="mt-1 text-sm text-muted">
        Onde a turma está travando e o que revisar. Lacuna = domínio abaixo de {pct(LIMIAR_LACUNA)} em um tópico com
        pelo menos {MIN_QUESTOES} questões respondidas.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Calculando…</p>}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ searchParams }: { searchParams: PageProps<"/diagnostico">["searchParams"] }) {
  await connection();
  const { turma: turmaParam } = await searchParams;
  const { supabase, professor } = await getProfessorAtual();
  const todas = await diagnosticosDoProfessor(professor.id);
  const comDados = todas.filter((d) => d.totalEntregas > 0);

  if (!comDados.length) {
    return (
      <p className="mt-8 rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
        Ainda não há entregas. Publique uma atividade e peça aos alunos que respondam, ou rode{" "}
        <code>npm run seed:diagnostico</code> para carregar dados fictícios.
      </p>
    );
  }

  const d = comDados.find((x) => x.turma.id === turmaParam) ?? comDados[0];
  const lacunas = lacunasDaTurma(d);
  // No mapa, os tópicos com menor domínio vêm primeiro: a lacuna aparece sem precisar rolar (principalmente no celular).
  const topicosMapa = [...d.topicos].sort((a, b) => (d.turmaCelulas[a.id]?.dominio ?? 2) - (d.turmaCelulas[b.id]?.dominio ?? 2));

  const { data: resumoRow } = await supabase
    .from("diagnostico_resumos").select("conteudo, gerado_em").eq("turma_id", d.turma.id).maybeSingle();
  const resumo = resumoRow?.conteudo as unknown as ResumoDiagnostico | undefined;
  const desatualizado = !!(resumoRow && d.ultimaEntrega && d.ultimaEntrega > resumoRow.gerado_em);

  const alunosEmLacuna = (tid: string) => d.alunos.filter((a) => a.celulas[tid]?.lacuna).length;

  // Texto pronto para colar no WhatsApp (negrito com *asteriscos*).
  const entregaram = d.alunos.filter((a) => a.entregou).length;
  const relatorio = [
    `*Diagnóstico ${d.turma.nome}* — ${new Date().toLocaleDateString("pt-BR")}`,
    `${entregaram} de ${d.totalAlunos} alunos entregaram.`,
    "",
    ...(lacunas.length
      ? [
          "*Onde a turma está travando:*",
          ...lacunas.flatMap((l) => [
            `• ${l.nome}: ${pct(l.dominio ?? 0)} (${alunosEmLacuna(l.id)} de ${l.alunosComDados} alunos abaixo da meta)`,
            ...d.equivocos.filter((e) => e.topicoId === l.id).slice(0, 2).map((e) => `   - ${e.equivoco}`),
            ...(l.paginas.length ? [`   Revisar: p. ${l.paginas.join(", ")} do material`] : []),
          ]),
        ]
      : [`Nenhum tópico abaixo de ${pct(LIMIAR_LACUNA)}.`]),
    ...(resumo ? ["", "*Resumo:*", resumo.resumo] : []),
    "",
    "Gerado pelo s.ai",
  ].join("\n");

  return (
    <div className="mt-6 space-y-10">
      {/* Turmas */}
      <nav aria-label="Turmas" className="no-print flex flex-wrap items-center gap-2">
        {comDados.map((t) => (
          <Link
            key={t.turma.id}
            href={`/diagnostico?turma=${t.turma.id}`}
            aria-current={t.turma.id === d.turma.id ? "page" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors ${t.turma.id === d.turma.id ? "border-ink bg-hl font-semibold text-hl-ink" : "border-line-strong bg-surface hover:bg-sunken"}`}
          >
            {t.turma.nome}
          </Link>
        ))}
        <span className="ml-auto text-sm text-muted">
          {d.alunos.filter((a) => a.entregou).length} de {d.totalAlunos} alunos entregaram
        </span>
      </nav>
      <AcoesRelatorio texto={relatorio} />

      {/* Onde a turma está travando */}
      <section aria-labelledby="h-lacunas">
        <h2 id="h-lacunas" className="mb-3 text-xl font-bold">Onde a {d.turma.nome} está travando</h2>
        {lacunas.length === 0 ? (
          <p className="rounded-xl bg-sunken p-4 text-sm">
            Nenhum tópico abaixo de {pct(LIMIAR_LACUNA)}. A turma está bem nos conteúdos avaliados.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {lacunas.map((l) => {
              const eqs = d.equivocos.filter((e) => e.topicoId === l.id).slice(0, 2);
              return (
                <li key={l.id} className="rounded-xl border border-danger/40 bg-surface p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-lg leading-snug font-semibold"><span className="grifo">{l.nome}</span></h3>
                    <span className="font-display text-2xl leading-none font-bold text-danger tabular-nums">{pct(l.dominio ?? 0)}</span>
                  </div>
                  <Bolinhas valor={l.dominio ?? 0} className="mt-3 text-danger" />
                  <p className="mt-2 text-sm text-muted">
                    {alunosEmLacuna(l.id)} de {l.alunosComDados} alunos abaixo da meta
                    {l.paginas.length > 0 && ` · revisar: p. ${l.paginas.join(", ")} do material`}
                  </p>
                  {eqs.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {eqs.map((e) => (
                        <li key={e.equivoco}>{e.equivoco} <span className="text-muted">({e.vezes}×)</span></li>
                      ))}
                    </ul>
                  )}
                  <BotaoReforco turmaId={d.turma.id} topicoId={l.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Resumo IA */}
      <section aria-labelledby="h-resumo" className="rounded-xl bg-sunken p-5">
        <h2 id="h-resumo" className="mb-2 text-xl font-bold">Resumo da IA</h2>
        {resumo ? (
          <div className="space-y-3 text-sm">
            <p>{resumo.resumo}</p>
            {resumo.focos.length > 0 && (
              <ul className="space-y-2">
                {resumo.focos.map((f) => (
                  <li key={f.topico}>
                    <strong>Foque em {f.topico}:</strong> {f.porque} <em className="not-italic text-muted">Revise: {f.revisar}</em>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted">
              Gerado em {new Date(resumoRow!.gerado_em).toLocaleString("pt-BR")}
              {desatualizado && " · há entregas novas desde então"}
            </p>
          </div>
        ) : (
          <p className="mb-1 text-sm text-muted">
            A IA transforma os números abaixo em um plano de revisão. Gerado sob demanda e guardado.
          </p>
        )}
        <div className="no-print mt-3">
          <BotaoResumo turmaId={d.turma.id} rotulo={resumo ? "Atualizar resumo" : "Gerar resumo com IA"} />
        </div>
      </section>

      {/* Mapa de calor */}
      <section aria-labelledby="h-mapa">
        <h2 id="h-mapa" className="mb-1 text-xl font-bold">Mapa de domínio — tópico × aluno</h2>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          <span>Alunos e tópicos com menor domínio primeiro.</span>
          <span className="flex items-center gap-1.5" aria-label="Legenda de cores">
            0%
            <span
              className="inline-block h-3 w-36 rounded"
              style={{ background: `linear-gradient(to right, ${corCelula(0)}, ${corCelula(LIMIAR_LACUNA)} ${LIMIAR_LACUNA * 100}%, ${corCelula(1)})` }}
            />
            100% <span>(meta {pct(LIMIAR_LACUNA)} no cinza)</span>
          </span>
          <span className="inline-flex items-center gap-1"><IconeLacuna className="text-danger" /> lacuna · — dados insuficientes (&lt; {MIN_QUESTOES} questões)</span>
        </div>
        <p className="mb-2 text-xs text-muted sm:hidden">Deslize a tabela para o lado para ver os outros tópicos.</p>
        <div className="relative">
          <div className="card overflow-x-auto">
          <table className="w-full border-separate border-spacing-0.5 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-background px-2 sm:px-3 py-2 text-left font-medium">Aluno</th>
                {topicosMapa.map((t) => (
                  <th key={t.id} scope="col" className="min-w-[4.5rem] sm:min-w-28 px-1 sm:px-2 py-2 text-center text-xs font-medium">{t.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="sticky left-0 bg-background px-2 sm:px-3 py-2 text-left font-semibold">Turma (média)</th>
                {topicosMapa.map((t) => {
                  const c = d.turmaCelulas[t.id];
                  return c?.dominio == null ? (
                    <td key={t.id} className="rounded text-center text-muted">—</td>
                  ) : (
                    <td
                      key={t.id}
                      style={{ background: corCelula(c.dominio) }}
                      title={`${t.nome}: ${pct(c.dominio)} (média de ${c.alunosComDados} alunos)`}
                      className="rounded px-1 sm:px-2 py-2 text-center font-semibold tabular-nums"
                    >
                      {c.lacuna && <IconeLacuna className="mr-1 inline text-[0.7em]" />}{pct(c.dominio)}
                    </td>
                  );
                })}
              </tr>
              {d.alunos.map((a) => (
                <tr key={a.id}>
                  <th scope="row" className="sticky left-0 bg-background px-2 sm:px-3 py-1.5 text-left font-normal whitespace-nowrap">
                    <Link
                      href={`/diagnostico/aluno/${a.id}`}
                      title={`Ver o detalhe de ${a.nome.replace(" (fictício)", "")}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {a.nome.replace(" (fictício)", "")}
                    </Link>
                    {!a.entregou && <span className="ml-2 text-xs text-muted">sem entrega</span>}
                  </th>
                  {topicosMapa.map((t) => {
                    const c = a.celulas[t.id];
                    if (!c || c.dominio === null) {
                      return (
                        <td key={t.id} title={`${t.nome}: dados insuficientes`} className="rounded border border-dashed border-line-strong text-center text-muted">—</td>
                      );
                    }
                    return (
                      <td
                        key={t.id}
                        style={{ background: corCelula(c.dominio) }}
                        title={`${a.nome} · ${t.nome}: ${pct(c.dominio)} (${c.acertos} de ${c.respondidas} certas)`}
                        className="rounded px-1 sm:px-2 py-1.5 text-center tabular-nums"
                      >
                        {c.lacuna && <IconeLacuna className="mr-1 inline text-[0.7em]" />}{pct(c.dominio)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          <div aria-hidden className="pointer-events-none absolute inset-y-px right-px w-8 rounded-r-xl bg-gradient-to-l from-surface to-transparent sm:hidden" />
        </div>
      </section>

      {/* Evolução por atividade */}
      <section aria-labelledby="h-evo">
        <h2 id="h-evo" className="mb-1 text-xl font-bold">Evolução por atividade</h2>
        {d.evolucao.atividades.length < 2 || d.evolucao.linhas.length === 0 ? (
          <p className="rounded-xl bg-sunken p-4 text-sm text-muted">
            Aplique outra atividade, por exemplo um reforço, para acompanhar o domínio da turma ao longo do tempo.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              Domínio da turma em cada atividade, da mais antiga para a mais recente. Mostra se um reforço fechou a lacuna.
            </p>
            <div className="card overflow-x-auto">
              <table className="w-full border-separate border-spacing-0.5 text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 bg-background px-2 py-2 text-left font-medium sm:px-3">Tópico</th>
                    {d.evolucao.atividades.map((a) => (
                      <th key={a.id} scope="col" className="min-w-28 px-2 py-2 text-center text-xs font-medium">
                        <span className="block">{a.titulo.replace(" (demo)", "")}</span>
                        <span className="mt-0.5 block font-normal text-muted">
                          {new Date(a.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          {a.reforco && " · reforço"}
                        </span>
                      </th>
                    ))}
                    <th scope="col" className="min-w-20 px-2 py-2 text-center text-xs font-medium">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {d.evolucao.linhas.map((l) => {
                    const validos = l.valores.filter((v): v is number => v !== null);
                    const delta = validos.length >= 2 ? validos[validos.length - 1] - validos[0] : null;
                    return (
                      <tr key={l.topicoId}>
                        <th scope="row" className="sticky left-0 bg-background px-2 py-1.5 text-left font-normal sm:px-3">{l.nome}</th>
                        {l.valores.map((v, i) =>
                          v === null ? (
                            <td key={i} className="rounded border border-dashed border-line-strong text-center text-muted">—</td>
                          ) : (
                            <td key={i} style={{ background: corCelula(v) }} className="rounded px-2 py-1.5 text-center tabular-nums">
                              {v < LIMIAR_LACUNA && <IconeLacuna className="mr-1 inline text-[0.7em]" />}{pct(v)}
                            </td>
                          ),
                        )}
                        <td className="px-2 text-center font-semibold tabular-nums">
                          {delta === null ? (
                            <span className="text-muted">—</span>
                          ) : (
                            <span className={delta >= 0 ? "text-ok" : "text-danger"}>
                              {delta >= 0 ? "+" : "−"}{Math.abs(Math.round(delta * 100))} pp
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Comparação entre turmas */}
      {comDados.length > 1 && (
        <section aria-labelledby="h-comp">
          <h2 id="h-comp" className="mb-3 text-xl font-bold">Comparação entre turmas</h2>
          <div className="card overflow-x-auto">
            <table className="w-full border-separate border-spacing-0.5 text-sm">
              <thead>
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">Tópico</th>
                  {comDados.map((t) => (
                    <th key={t.turma.id} scope="col" className="px-3 py-2 text-center font-medium">{t.turma.nome}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...new Map(comDados.flatMap((t) => t.topicos.map((x) => [x.nome, x] as const))).values()].map((top) => (
                  <tr key={top.nome}>
                    <th scope="row" className="px-3 py-1.5 text-left font-normal">{top.nome}</th>
                    {comDados.map((t) => {
                      const tp = t.topicos.find((x) => x.nome === top.nome);
                      const c = tp ? t.turmaCelulas[tp.id] : undefined;
                      return c?.dominio == null ? (
                        <td key={t.turma.id} className="text-center text-muted">—</td>
                      ) : (
                        <td key={t.turma.id} style={{ background: corCelula(c.dominio) }} className="rounded px-3 py-1.5 text-center tabular-nums">
                          {c.lacuna && <IconeLacuna className="mr-1 inline text-[0.7em]" />}{pct(c.dominio)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Equívocos */}
      {d.equivocos.length > 0 && (
        <section aria-labelledby="h-eq">
          <h2 id="h-eq" className="mb-3 text-xl font-bold">Equívocos mais frequentes</h2>
          <ol className="space-y-1.5 text-sm">
            {d.equivocos.slice(0, 6).map((e, i) => (
              <li key={`${e.topicoId}-${e.equivoco}`} className="flex items-baseline gap-3">
                <span className="w-5 text-right text-muted tabular-nums">{i + 1}.</span>
                <span className="flex-1">{e.equivoco} <span className="text-muted">— {e.topico}</span></span>
                <span className="tabular-nums text-muted">{e.vezes} alunos</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
