import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { detalheDoAluno } from "@/lib/aluno-detalhe";
import { LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";
import { Bolinhas } from "../../../bolinhas";
import { IconeVoltar } from "../../../icones";
import { ajustarNota } from "../../actions";
import { BotaoCorrigir } from "../../botao-corrigir";

export const metadata = { title: "Aluno — s.ai" };

// A correção por IA de uma resposta pendente pode demorar.
export const maxDuration = 120;

const pct = (d: number) => `${Math.round(d * 100)}%`;
const dez = (n: number) => (Math.round(n * 100) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function AlunoPage({ params }: PageProps<"/diagnostico/aluno/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Suspense fallback={<p className="text-sm text-muted">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params }: { params: PageProps<"/diagnostico/aluno/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const { professor } = await getProfessorAtual();
  const det = await detalheDoAluno(professor.id, id);
  if (!det) notFound();

  const nome = det.aluno.nome.replace(" (fictício)", "");

  return (
    <div className="max-w-3xl space-y-10">
      <header>
        <Link
          href={`/diagnostico?turma=${det.turma.id}`}
          className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink"
        >
          <IconeVoltar /> Diagnóstico da {det.turma.nome}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">{nome}</h1>
        <p className="mt-1 text-sm text-muted">
          Turma {det.turma.nome} · {det.entregas} {det.entregas === 1 ? "atividade entregue" : "atividades entregues"}
        </p>
      </header>

      {det.entregas === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong p-6 text-sm text-muted">
          {nome} ainda não entregou nenhuma atividade.
        </p>
      ) : (
        <>
          <section aria-labelledby="h-dom">
            <h2 id="h-dom" className="mb-3 text-xl font-bold">Domínio por tópico</h2>
            <ul className="space-y-2">
              {det.porTopico.map((t) => (
                <li key={t.topicoId} className="card flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {t.lacuna ? <span className="grifo">{t.nome}</span> : t.nome}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {t.dominio === null
                        ? `dados insuficientes (menos de ${MIN_QUESTOES} questões)`
                        : `${t.acertos} de ${t.respondidas} certas${t.lacuna ? ` · abaixo da meta de ${pct(LIMIAR_LACUNA)}` : ""}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {t.dominio === null ? (
                      <span className="text-muted">—</span>
                    ) : (
                      <>
                        <p className={`font-display text-xl font-bold tabular-nums ${t.lacuna ? "text-danger" : ""}`}>{pct(t.dominio)}</p>
                        <Bolinhas valor={t.dominio} className={`mt-1 ${t.lacuna ? "text-danger" : "text-ok"}`} />
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {det.equivocos.length > 0 && (
            <section aria-labelledby="h-eq">
              <h2 id="h-eq" className="mb-3 text-xl font-bold">Equívocos de {nome}</h2>
              <ul className="space-y-1.5 text-sm">
                {det.equivocos.map((e) => (
                  <li key={`${e.topico}-${e.equivoco}`} className="flex items-baseline justify-between gap-3">
                    <span>{e.equivoco} <span className="text-muted">— {e.topico}</span></span>
                    <span className="shrink-0 tabular-nums text-muted">{e.vezes}×</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {det.dissertativas.length > 0 && (
            <section aria-labelledby="h-diss">
              <h2 id="h-diss" className="mb-1 text-xl font-bold">Respostas dissertativas</h2>
              <p className="mb-4 text-sm text-muted">
                A nota da IA vem da rubrica. Você pode ajustá-la; o ajuste vale no feedback do aluno e no Diagnóstico.
              </p>
              <ul className="space-y-5">
                {det.dissertativas.map((r) => {
                  const atual = r.notaAjustada ?? r.notaIa;
                  return (
                    <li key={r.id} className="card p-5">
                      <p className="text-xs text-muted">{r.atividade} · {r.topico}</p>
                      <p className="mt-2 text-[0.9375rem] whitespace-pre-wrap">{r.enunciado}</p>
                      <p className="mt-3 rounded-lg bg-sunken p-3 text-sm whitespace-pre-wrap">{r.texto}</p>

                      {r.pendente ? (
                        <div className="mt-4 space-y-2">
                          <p className="text-sm text-muted">A correção por IA ainda não ficou pronta (cota esgotada ou falha de rede).</p>
                          <BotaoCorrigir respostaId={r.id} />
                        </div>
                      ) : (
                        <>
                          {r.criterios.length > 0 && (
                            <ul className="mt-4 space-y-1 text-sm">
                              {r.criterios.map((c) => (
                                <li key={c.criterio}>
                                  <strong className="tabular-nums">{c.obtidos}/{c.pontos}</strong> — {c.criterio}
                                  {c.comentario && <span className="text-muted"> ({c.comentario})</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                          {r.comentario && <p className="mt-2 text-sm text-muted">{r.comentario}</p>}
                          <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-t border-line pt-4">
                            <p className="text-sm">
                              Nota da IA: <strong className="tabular-nums">{dez(r.notaIa ?? 0)}</strong>
                              {r.notaAjustada !== null && (
                                <>
                                  {" "}· ajustada por você: <strong className="tabular-nums text-ok">{dez(r.notaAjustada)}</strong>
                                </>
                              )}
                            </p>
                            <form action={ajustarNota} className="flex items-end gap-2">
                              <input type="hidden" name="resposta_id" value={r.id} />
                              <label className="text-xs text-muted">
                                Nova nota (0 a 10)
                                <input
                                  name="nota"
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  max={10}
                                  step={0.5}
                                  defaultValue={atual === null ? "" : (Math.round(atual * 100) / 10).toString()}
                                  className="field mt-1 w-24"
                                />
                              </label>
                              <button className="btn btn-primary btn-sm">Salvar nota</button>
                            </form>
                            {r.notaAjustada !== null && (
                              <form action={ajustarNota}>
                                <input type="hidden" name="resposta_id" value={r.id} />
                                <input type="hidden" name="nota" value="" />
                                <button className="btn btn-secondary btn-sm">Voltar à nota da IA</button>
                              </form>
                            )}
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {det.erradas.length > 0 && (
            <section aria-labelledby="h-err">
              <h2 id="h-err" className="mb-3 text-xl font-bold">Questões que {nome} errou</h2>
              <ul className="space-y-3">
                {det.erradas.map((r) => (
                  <li key={r.id} className="card p-4 text-sm">
                    <p className="text-xs text-muted">{r.atividade} · {r.topico}</p>
                    <p className="mt-1.5">{r.enunciado}</p>
                    <p className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-danger">
                      Marcou: {r.escolhida}
                      {r.equivoco && <span className="mt-0.5 block text-xs">Equívoco: {r.equivoco}</span>}
                    </p>
                    <p className="mt-1.5 rounded-lg bg-ok-soft px-3 py-2 text-ok-ink">Correta: {r.correta}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
