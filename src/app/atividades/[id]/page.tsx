import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { excluirAtividade, publicarAtividade, removerQuestao, salvarQuestao } from "../actions";

export const metadata = { title: "Atividade — s.ai" };

const campo = "w-full rounded-md border border-zinc-300 bg-transparent px-2 py-1.5 text-sm dark:border-zinc-700";
const botao = "rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700";
const LETRAS = "ABCDEFGH";

export default function AtividadePage({ params }: PageProps<"/atividades/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Link href="/atividades" className="text-sm text-zinc-500 hover:underline">← Atividades</Link>
      <Suspense fallback={<p className="mt-8 text-sm text-zinc-500">Carregando…</p>}>
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
    <div className="mt-2 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{atividade.titulo}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {atividade.turma?.nome} · material: {atividade.material?.titulo ?? "—"} · {questoes.length} questões ·{" "}
            {rascunho ? "rascunho" : `publicada${atividade.prazo ? ` (prazo ${new Date(atividade.prazo).toLocaleDateString("pt-BR")})` : ""}`}
          </p>
        </div>
        {rascunho && (
          <form action={excluirAtividade}>
            <input type="hidden" name="atividade_id" value={atividade.id} />
            <button className={`${botao} text-red-600`}>Excluir rascunho</button>
          </form>
        )}
      </header>

      {rascunho && (
        <form action={publicarAtividade} className="flex flex-wrap items-end gap-3 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-900">
          <input type="hidden" name="atividade_id" value={atividade.id} />
          <label className="text-sm text-zinc-500">
            Prazo (opcional)
            <input type="date" name="prazo" className={`${campo} mt-1`} />
          </label>
          <button
            disabled={questoes.length === 0}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Publicar para {atividade.turma?.nome}
          </button>
          <p className="basis-full text-xs text-zinc-500">
            Revise e edite as questões abaixo (salve cada uma). Depois de publicada, a atividade não pode mais ser editada.
          </p>
        </form>
      )}

      <ol className="space-y-5">
        {questoes.map((q, i) => {
          const alts = [...q.alternativas].sort((a, b) => a.ordem - b.ordem);
          const rubrica = (q.rubrica as { criterio: string; pontos: number }[] | null) ?? [];
          return (
            <li key={q.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <p className="mb-2 text-xs text-zinc-500">
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
                              className={`${campo} text-zinc-500`}
                              aria-label={`Equívoco da alternativa ${LETRAS[j]}`}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <label className="block text-sm text-zinc-500">
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
                    <button formAction={removerQuestao} className={`${botao} text-red-600`}>Remover</button>
                  </div>
                </form>
              ) : (
                <div className="space-y-2 text-sm">
                  <p className="whitespace-pre-wrap">{q.enunciado}</p>
                  {q.tipo === "multipla_escolha" ? (
                    <ul className="space-y-1">
                      {alts.map((a, j) => (
                        <li key={a.id} className={a.correta ? "font-medium text-emerald-700 dark:text-emerald-400" : ""}>
                          {LETRAS[j]}) {a.texto}
                          {!a.correta && a.equivoco && <span className="ml-2 text-xs text-zinc-500">— {a.equivoco}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="list-disc pl-5 text-zinc-600 dark:text-zinc-400">
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
