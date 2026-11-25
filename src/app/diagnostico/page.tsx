import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { diagnosticosDoProfessor, lacunasDaTurma, LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";
import type { ResumoDiagnostico } from "@/lib/diagnostico-ia";
import { BotaoResumo } from "./botao-resumo";

export const metadata = { title: "Diagnóstico — s.ai" };

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
      <Link href="/" className="text-sm text-zinc-500 hover:underline">← Painel</Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Diagnóstico da turma</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Onde a turma está travando e o que revisar. Lacuna = domínio abaixo de {pct(LIMIAR_LACUNA)} em um tópico com
        pelo menos {MIN_QUESTOES} questões respondidas.
      </p>
      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Calculando…</p>}>
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
      <p className="mt-8 rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-500 dark:border-zinc-700">
        Ainda não há entregas. Publique uma atividade e peça aos alunos que respondam, ou rode{" "}
        <code>npm run seed:diagnostico</code> para carregar dados fictícios.
      </p>
    );
  }

  const d = comDados.find((x) => x.turma.id === turmaParam) ?? comDados[0];
  const lacunas = lacunasDaTurma(d);

  const { data: resumoRow } = await supabase
    .from("diagnostico_resumos").select("conteudo, gerado_em").eq("turma_id", d.turma.id).maybeSingle();
  const resumo = resumoRow?.conteudo as unknown as ResumoDiagnostico | undefined;
  const desatualizado = !!(resumoRow && d.ultimaEntrega && d.ultimaEntrega > resumoRow.gerado_em);

  const alunosEmLacuna = (tid: string) => d.alunos.filter((a) => a.celulas[tid]?.lacuna).length;

  return (
    <div className="mt-6 space-y-10">
      {/* Turmas */}
      <nav aria-label="Turmas" className="flex flex-wrap items-center gap-2">
        {comDados.map((t) => (
          <Link
            key={t.turma.id}
            href={`/diagnostico?turma=${t.turma.id}`}
            aria-current={t.turma.id === d.turma.id ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${t.turma.id === d.turma.id ? "border-zinc-900 bg-zinc-900 font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {t.turma.nome}
          </Link>
        ))}
        <span className="ml-auto text-sm text-zinc-500">
          {d.alunos.filter((a) => a.entregou).length} de {d.totalAlunos} alunos entregaram
        </span>
      </nav>

      {/* Onde a turma está travando */}
      <section aria-labelledby="h-lacunas">
        <h2 id="h-lacunas" className="mb-3 text-lg font-semibold">Onde a {d.turma.nome} está travando</h2>
        {lacunas.length === 0 ? (
          <p className="rounded-lg bg-zinc-50 p-4 text-sm dark:bg-zinc-900">
            Nenhum tópico abaixo de {pct(LIMIAR_LACUNA)}. A turma está bem nos conteúdos avaliados.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {lacunas.map((l) => {
              const eqs = d.equivocos.filter((e) => e.topicoId === l.id).slice(0, 2);
              return (
                <li key={l.id} className="rounded-lg border border-red-300 p-4 dark:border-red-900">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-medium"><span aria-hidden>▼ </span>{l.nome}</h3>
                    <span className="text-2xl font-semibold tabular-nums">{pct(l.dominio ?? 0)}</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {alunosEmLacuna(l.id)} de {l.alunosComDados} alunos abaixo da meta
                    {l.paginas.length > 0 && ` · revisar: p. ${l.paginas.join(", ")} do material`}
                  </p>
                  {eqs.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-sm">
                      {eqs.map((e) => (
                        <li key={e.equivoco}>{e.equivoco} <span className="text-zinc-500">({e.vezes}×)</span></li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Resumo IA */}
      <section aria-labelledby="h-resumo" className="rounded-lg bg-zinc-50 p-5 dark:bg-zinc-900">
        <h2 id="h-resumo" className="mb-2 text-lg font-semibold">Resumo da IA</h2>
        {resumo ? (
          <div className="space-y-3 text-sm">
            <p>{resumo.resumo}</p>
            {resumo.focos.length > 0 && (
              <ul className="space-y-2">
                {resumo.focos.map((f) => (
                  <li key={f.topico}>
                    <strong>Foque em {f.topico}:</strong> {f.porque} <em className="not-italic text-zinc-600 dark:text-zinc-400">Revise: {f.revisar}</em>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-zinc-500">
              Gerado em {new Date(resumoRow!.gerado_em).toLocaleString("pt-BR")}
              {desatualizado && " · há entregas novas desde então"}
            </p>
          </div>
        ) : (
          <p className="mb-1 text-sm text-zinc-500">
            A IA transforma os números abaixo em um plano de revisão. Gerado sob demanda e guardado.
          </p>
        )}
        <div className="mt-3">
          <BotaoResumo turmaId={d.turma.id} rotulo={resumo ? "Atualizar resumo" : "Gerar resumo com IA"} />
        </div>
      </section>

      {/* Mapa de calor */}
      <section aria-labelledby="h-mapa">
        <h2 id="h-mapa" className="mb-1 text-lg font-semibold">Mapa de domínio — tópico × aluno</h2>
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span>Alunos com menor domínio primeiro.</span>
          <span className="flex items-center gap-1.5" aria-label="Legenda de cores">
            0%
            <span
              className="inline-block h-3 w-36 rounded"
              style={{ background: `linear-gradient(to right, ${corCelula(0)}, ${corCelula(LIMIAR_LACUNA)} ${LIMIAR_LACUNA * 100}%, ${corCelula(1)})` }}
            />
            100% <span>(meta {pct(LIMIAR_LACUNA)} no cinza)</span>
          </span>
          <span><span aria-hidden>▼</span> lacuna · — dados insuficientes (&lt; {MIN_QUESTOES} questões)</span>
        </div>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-separate border-spacing-0.5 text-sm">
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 bg-background px-3 py-2 text-left font-medium">Aluno</th>
                {d.topicos.map((t) => (
                  <th key={t.id} scope="col" className="min-w-28 px-2 py-2 text-center text-xs font-medium">{t.nome}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="sticky left-0 bg-background px-3 py-2 text-left font-semibold">Turma (média)</th>
                {d.topicos.map((t) => {
                  const c = d.turmaCelulas[t.id];
                  return c?.dominio == null ? (
                    <td key={t.id} className="rounded text-center text-zinc-500">—</td>
                  ) : (
                    <td
                      key={t.id}
                      style={{ background: corCelula(c.dominio) }}
                      title={`${t.nome}: ${pct(c.dominio)} (média de ${c.alunosComDados} alunos)`}
                      className="rounded px-2 py-2 text-center font-semibold tabular-nums"
                    >
                      {c.lacuna && <span aria-hidden>▼ </span>}{pct(c.dominio)}
                    </td>
                  );
                })}
              </tr>
              {d.alunos.map((a) => (
                <tr key={a.id}>
                  <th scope="row" className="sticky left-0 bg-background px-3 py-1.5 text-left font-normal whitespace-nowrap">
                    {a.nome.replace(" (fictício)", "")}
                    {!a.entregou && <span className="ml-2 text-xs text-zinc-500">sem entrega</span>}
                  </th>
                  {d.topicos.map((t) => {
                    const c = a.celulas[t.id];
                    if (!c || c.dominio === null) {
                      return (
                        <td key={t.id} title={`${t.nome}: dados insuficientes`} className="rounded border border-dashed border-zinc-300 text-center text-zinc-400 dark:border-zinc-700">—</td>
                      );
                    }
                    return (
                      <td
                        key={t.id}
                        style={{ background: corCelula(c.dominio) }}
                        title={`${a.nome} · ${t.nome}: ${pct(c.dominio)} (${c.acertos} de ${c.respondidas} certas)`}
                        className="rounded px-2 py-1.5 text-center tabular-nums"
                      >
                        {c.lacuna && <span aria-hidden>▼ </span>}{pct(c.dominio)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Comparação entre turmas */}
      {comDados.length > 1 && (
        <section aria-labelledby="h-comp">
          <h2 id="h-comp" className="mb-3 text-lg font-semibold">Comparação entre turmas</h2>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
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
                        <td key={t.turma.id} className="text-center text-zinc-400">—</td>
                      ) : (
                        <td key={t.turma.id} style={{ background: corCelula(c.dominio) }} className="rounded px-3 py-1.5 text-center tabular-nums">
                          {c.lacuna && <span aria-hidden>▼ </span>}{pct(c.dominio)}
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
          <h2 id="h-eq" className="mb-3 text-lg font-semibold">Equívocos mais frequentes</h2>
          <ol className="space-y-1.5 text-sm">
            {d.equivocos.slice(0, 6).map((e, i) => (
              <li key={`${e.topicoId}-${e.equivoco}`} className="flex items-baseline gap-3">
                <span className="w-5 text-right text-zinc-400 tabular-nums">{i + 1}.</span>
                <span className="flex-1">{e.equivoco} <span className="text-zinc-500">— {e.topico}</span></span>
                <span className="tabular-nums text-zinc-500">{e.vezes} alunos</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
