import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { IconeCheck, IconeVoltar } from "../../icones";
import { excluirAtividade, publicarAtividade, removerQuestao, salvarQuestao } from "../actions";

export const metadata = { title: "Atividade — s.ai" };

const campo = "field";
const botao = "btn btn-secondary btn-sm";
const LETRAS = "ABCDEFGH";

export default function AtividadePage({ params }: PageProps<"/atividades/[id]">) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <Link href="/atividades" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
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

  const { data: atividade } = await supabase
    .from("atividades")
    .select(
      `id, titulo, status, prazo, turma:turmas(nome), material:materiais(titulo),
       questoes(id, tipo, ordem, enunciado, rubrica, topico:topicos(nome), trecho:material_trechos(pagina),
         alternativas(id, ordem, texto, correta, equivoco))`,
    )
    .eq("id", id)
    .eq("professor_id", professor.id)
    .maybeSingle();
  if (!atividade) notFound();

  const rascunho = atividade.status === "rascunho";
  const questoes = [...atividade.questoes].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="mt-4 max-w-3xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{atividade.titulo}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className={`badge ${rascunho ? "badge-neutral" : "badge-ok"}`}>
              {rascunho ? "rascunho" : "publicada"}
            </span>
            {atividade.turma?.nome} · material: {atividade.material?.titulo ?? "—"} · {questoes.length} questões
            {!rascunho && atividade.prazo && ` · prazo ${new Date(atividade.prazo).toLocaleDateString("pt-BR")}`}
          </p>
        </div>
        {rascunho && (
          <form action={excluirAtividade}>
            <input type="hidden" name="atividade_id" value={atividade.id} />
            <button className="btn btn-danger btn-sm">Excluir rascunho</button>
          </form>
        )}
      </header>

      {rascunho && (
        <form action={publicarAtividade} className="flex flex-wrap items-end gap-3 rounded-xl bg-sunken p-4">
          <input type="hidden" name="atividade_id" value={atividade.id} />
          <label className="text-sm text-muted">
            Prazo (opcional)
            <input type="date" name="prazo" className={`${campo} mt-1`} />
          </label>
          <button
            disabled={questoes.length === 0}
            className="btn btn-primary"
          >
            Publicar para {atividade.turma?.nome}
          </button>
          <p className="basis-full text-xs text-muted">
            Revise e edite as questões abaixo (salve cada uma). Depois de publicada, a atividade não pode mais ser editada.
          </p>
        </form>
      )}

      <ol className="space-y-5">
        {questoes.map((q, i) => {
          const alts = [...q.alternativas].sort((a, b) => a.ordem - b.ordem);
          const rubrica = (q.rubrica as { criterio: string; pontos: number }[] | null) ?? [];
          return (
            <li key={q.id} className="card p-5">
              <p className="mb-2 text-xs text-muted">
                Questão {i + 1} · {q.tipo === "multipla_escolha" ? "múltipla escolha" : "dissertativa"} · tópico:{" "}
                {q.topico?.nome}
                {q.trecho?.pagina ? ` · material, p. ${q.trecho.pagina}` : ""}
              </p>

              {rascunho ? (
                <form action={salvarQuestao} className="space-y-3">
                  <input type="hidden" name="atividade_id" value={atividade.id} />
                  <input type="hidden" name="questao_id" value={q.id} />
                  <textarea name="enunciado" defaultValue={q.enunciado} rows={3} className={campo} aria-label="Enunciado" />
                  {q.tipo === "multipla_escolha" ? (
                    <ul className="space-y-2">
                      {alts.map((a, j) => (
                        <li key={a.id} className="grid grid-cols-[auto_1fr] items-start gap-2 text-sm">
                          <label className="flex items-center gap-1 pt-1.5" title="Alternativa correta">
                            <input type="radio" name="correta" value={a.id} defaultChecked={a.correta} />
                            <span className="font-medium">{LETRAS[j]}</span>
                          </label>
                          <div className="space-y-1">
                            <input name={`texto_${a.id}`} defaultValue={a.texto} className={campo} aria-label={`Alternativa ${LETRAS[j]}`} />
                            <input
                              name={`equivoco_${a.id}`}
                              defaultValue={a.equivoco ?? ""}
                              placeholder="Equívoco que este distrator representa (só nas erradas)"
                              className={`${campo} text-muted`}
                              aria-label={`Equívoco da alternativa ${LETRAS[j]}`}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <label className="block text-sm text-muted">
                      Rubrica — um critério por linha, no formato <code>critério | pontos</code>
                      <textarea
                        name="rubrica"
                        rows={Math.max(3, rubrica.length + 1)}
                        defaultValue={rubrica.map((r) => `${r.criterio} | ${r.pontos}`).join("\n")}
                        className={`${campo} mt-1`}
                      />
                    </label>
                  )}
                  <div className="flex gap-2">
                    <button className={botao}>Salvar questão</button>
                    <button formAction={removerQuestao} className="btn btn-danger btn-sm">Remover</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="whitespace-pre-wrap">{q.enunciado}</p>
                  {q.tipo === "multipla_escolha" ? (
                    <ul className="space-y-1">
                      {alts.map((a, j) => (
                        <li key={a.id} className={`flex items-start gap-2 rounded-lg px-3 py-1.5 ${a.correta ? "bg-ok-soft text-ok-ink" : ""}`}>
                          <span className="bolha">{LETRAS[j]}</span>
                          <span className="flex-1">
                            {a.texto}
                            {!a.correta && a.equivoco && <span className="mt-0.5 block text-xs text-muted">Equívoco: {a.equivoco}</span>}
                          </span>
                          {a.correta && <IconeCheck className="mt-0.5" aria-label="alternativa correta" />}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="list-disc pl-5 text-muted">
                      {rubrica.map((r) => (
                        <li key={r.criterio}>{r.criterio} ({r.pontos} pts)</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
