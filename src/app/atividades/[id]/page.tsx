import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { resultadosDaAtividade } from "@/lib/atividade-resultados";
import { normalizarRegrasGlobais, normalizarRubrica } from "@/lib/nota-rubrica";
import { IconeCheck, IconeVoltar } from "../../icones";
import { excluirAtividade } from "../actions";
import { BarraPublicar } from "./barra-publicar";
import { DuplicarTurmas } from "./duplicar-turmas";
import { FormAdicionarQuestao } from "./form-adicionar-questao";
import { FormQuestao } from "./form-questao";
import { PainelNotasProva } from "./painel-notas-prova";
import { RegrasGlobaisBar, type PresetProfessor } from "./regras-globais";

export const metadata = { title: "Atividade — s.ai" };

// Regeneração de questão e calibração simulada usam Gemini.
export const maxDuration = 120;

const LETRAS = "ABCDEFGH";

export default function AtividadePage({ params }: PageProps<"/atividades/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link href="/atividades" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <IconeVoltar /> Atividades
      </Link>
      <Suspense fallback={<p className="mt-8 text-sm text-muted">Carregando…</p>}>
        <Conteudo params={params} />
      </Suspense>
    </main>
  );
}

async function Conteudo({ params }: { params: PageProps<"/atividades/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const { supabase, professor } = await getProfessorAtual();

  const [{ data: atividade }, { data: turmas }, { data: presetsDb }, { data: topicosProf }] = await Promise.all([
    supabase
      .from("atividades")
      .select(
        `id, titulo, status, prazo, turma_id, regras_globais, revisar_antes_liberar,
         turma:turmas(nome), material:materiais(titulo, disciplina),
         questoes(id, tipo, ordem, enunciado, rubrica, topico:topicos(id, nome),
           trecho:material_trechos(pagina, conteudo),
           alternativas(id, ordem, texto, correta, equivoco))`,
      )
      .eq("id", id)
      .eq("professor_id", professor.id)
      .maybeSingle(),
    supabase.from("turmas").select("id, nome").eq("professor_id", professor.id).order("nome"),
    supabase
      .from("professor_rubrica_presets")
      .select("id, nome, disciplina, regras_globais")
      .eq("professor_id", professor.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("topicos")
      .select("id, nome")
      .eq("professor_id", professor.id)
      .eq("confirmado", true)
      .order("nome"),
  ]);
  if (!atividade) notFound();

  const rascunho = atividade.status === "rascunho";
  const resultados = rascunho ? null : await resultadosDaAtividade(professor.id, atividade.id);
  const questoes = [...atividade.questoes].sort((a, b) => a.ordem - b.ordem);
  const regrasGlobais = normalizarRegrasGlobais(atividade.regras_globais);
  const disciplina = atividade.material?.disciplina ?? null;
  const temDissertativa = questoes.some((q) => q.tipo === "dissertativa");

  const presets: PresetProfessor[] = (presetsDb ?? [])
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      disciplina: p.disciplina,
      regras_globais: normalizarRegrasGlobais(p.regras_globais),
    }))
    .sort((a, b) => Number(b.disciplina === disciplina) - Number(a.disciplina === disciplina));

  const outrasTurmas = (turmas ?? []).filter((t) => t.id !== atividade.turma_id);

  // Tópicos disponíveis para adicionar questão manual (prioriza os já presentes na atividade)
  const topicosMap = new Map<string, string>();
  for (const q of questoes) {
    if (q.topico) topicosMap.set(q.topico.id, q.topico.nome);
  }
  for (const t of topicosProf ?? []) {
    if (!topicosMap.has(t.id)) topicosMap.set(t.id, t.nome);
  }
  const topicosDisponiveis = [...topicosMap.entries()].map(([tid, nome]) => ({ id: tid, nome }));

  const listaQuestoes = (
    <ol className="space-y-5">
      {questoes.map((q, i) => {
        const alts = [...q.alternativas].sort((a, b) => a.ordem - b.ordem);
        const rubricaV2 = q.tipo === "dissertativa" ? normalizarRubrica(q.rubrica) : null;
        const penAtivas = rubricaV2?.penalidades.filter((p) => p.ativa !== false) ?? [];
        const chaveReset = `${q.id}-${q.enunciado.length}-${alts.map((a) => a.id).join("")}-${rubricaV2?.positivos.length ?? 0}`;
        return (
          <li key={q.id} className="card p-5">
            <p className="mb-2 text-xs text-muted">
              Questão {i + 1} · {q.tipo === "multipla_escolha" ? "múltipla escolha" : "dissertativa"} · tópico:{" "}
              {q.topico?.nome}
              {q.trecho?.pagina ? ` · material, p. ${q.trecho.pagina}` : ""}
            </p>

            {rascunho ? (
              <FormQuestao
                key={chaveReset}
                atividadeId={atividade.id}
                questaoId={q.id}
                tipo={q.tipo}
                enunciado={q.enunciado}
                alternativas={alts}
                rubrica={rubricaV2}
                regrasGlobais={regrasGlobais}
                trecho={q.trecho ? { pagina: q.trecho.pagina, conteudo: q.trecho.conteudo } : null}
              />
            ) : (
              <div className="space-y-3 text-sm">
                <p className="whitespace-pre-wrap">{q.enunciado}</p>
                {q.tipo === "multipla_escolha" ? (
                  <ul className="space-y-1">
                    {alts.map((a, j) => (
                      <li
                        key={a.id}
                        className={`flex items-start gap-2 rounded-lg px-3 py-1.5 ${
                          a.correta ? "bg-ok-soft text-ok-ink" : ""
                        }`}
                      >
                        <span className="bolha">{LETRAS[j]}</span>
                        <span className="flex-1">
                          {a.texto}
                          {!a.correta && a.equivoco && (
                            <span className="mt-0.5 block text-xs text-muted">Equívoco: {a.equivoco}</span>
                          )}
                        </span>
                        {a.correta && <IconeCheck className="mt-0.5" aria-label="alternativa correta" />}
                      </li>
                    ))}
                  </ul>
                ) : (
                  rubricaV2 && (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        {rubricaV2.positivos.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2.5 py-1 text-ok-ink"
                          >
                            <strong className="font-mono">+{c.peso}%</strong> {c.texto}
                          </span>
                        ))}
                        {penAtivas.map((p) => (
                          <span
                            key={p.id}
                            className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2.5 py-1 text-danger"
                          >
                            <strong className="font-mono">
                              {p.modo === "teto" ? `Teto ${p.valor}%` : `-${p.valor}%`}
                            </strong>{" "}
                            {p.texto}
                          </span>
                        ))}
                      </div>
                      {rubricaV2.resolucao_modelo && (
                        <details className="text-xs text-muted">
                          <summary className="cursor-pointer hover:text-ink">Ver resolução-modelo</summary>
                          <p className="mt-1 rounded-lg bg-sunken p-2.5 whitespace-pre-wrap text-ink">
                            {rubricaV2.resolucao_modelo}
                          </p>
                        </details>
                      )}
                    </div>
                  )
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className="mt-4 max-w-4xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{atividade.titulo}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className={`badge ${rascunho ? "badge-neutral" : "badge-ok"}`}>
              {rascunho ? "rascunho" : "publicada"}
            </span>
            {atividade.turma?.nome} ·{" "}
            {atividade.material?.titulo ? `material: ${atividade.material.titulo}` : "por tema (sem material)"} ·{" "}
            {questoes.length} questões
            {!rascunho && atividade.prazo && ` · prazo ${new Date(atividade.prazo).toLocaleDateString("pt-BR")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!rascunho && temDissertativa && (
            <Link href={`/diagnostico/revisao?atividade=${atividade.id}`} className="btn btn-secondary btn-sm">
              Mesa de revisão
            </Link>
          )}
          {rascunho && (
            <form action={excluirAtividade}>
              <input type="hidden" name="atividade_id" value={atividade.id} />
              <button className="btn btn-danger btn-sm">Excluir rascunho</button>
            </form>
          )}
        </div>
      </header>

      {rascunho && (
        <BarraPublicar
          atividadeId={atividade.id}
          turmaNome={atividade.turma?.nome ?? "a turma"}
          totalQuestoes={questoes.length}
        />
      )}

      {(temDissertativa || rascunho) && (
        <RegrasGlobaisBar
          atividadeId={atividade.id}
          disciplina={disciplina}
          regrasIniciais={regrasGlobais}
          revisarAntesInicial={atividade.revisar_antes_liberar}
          presets={presets}
          editavel={rascunho}
        />
      )}

      <DuplicarTurmas atividadeId={atividade.id} outrasTurmas={outrasTurmas} />

      {!rascunho && resultados ? (
        <PainelNotasProva resultados={resultados} gabaritoNode={listaQuestoes} />
      ) : (
        listaQuestoes
      )}

      {rascunho && <FormAdicionarQuestao atividadeId={atividade.id} topicos={topicosDisponiveis} />}
    </div>
  );
}
