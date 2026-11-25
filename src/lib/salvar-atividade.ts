import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import type { QuestaoGerada } from "@/lib/questoes-ia";

/**
 * Grava uma Atividade (em Rascunho) com as Questões geradas pela IA.
 * Se algo falhar no meio, apaga o que já tinha gravado e relança o erro.
 */
export async function salvarAtividadeGerada(
  db: SupabaseClient<Database>,
  p: {
    professorId: string;
    turmaId: string;
    materialId: string;
    titulo: string;
    geradas: QuestaoGerada[];
    trechos: { id: string; ordem: number }[];
  },
): Promise<string> {
  const trechoPorOrdem = new Map(p.trechos.map((t) => [t.ordem, t.id]));
  const atividadeId = crypto.randomUUID();
  try {
    const { error } = await db.from("atividades").insert({
      id: atividadeId, professor_id: p.professorId, turma_id: p.turmaId, material_id: p.materialId, titulo: p.titulo,
    });
    if (error) throw error;

    for (const [i, q] of p.geradas.entries()) {
      const questaoId = crypto.randomUUID();
      const { error: eq } = await db.from("questoes").insert({
        id: questaoId,
        atividade_id: atividadeId,
        topico_id: q.topico_id,
        trecho_id: (q.trecho_ordem != null && trechoPorOrdem.get(q.trecho_ordem)) || null,
        tipo: q.tipo,
        ordem: i,
        enunciado: q.enunciado,
        rubrica: q.rubrica,
      });
      if (eq) throw eq;
      if (q.tipo === "multipla_escolha") {
        const { error: ea } = await db.from("alternativas").insert(
          q.alternativas.map((a, j) => ({
            questao_id: questaoId, ordem: j, texto: a.texto, correta: a.correta,
            equivoco: a.correta ? null : a.equivoco!.trim(),
          })),
        );
        if (ea) throw ea;
      }
    }
  } catch (e) {
    await db.from("atividades").delete().eq("id", atividadeId).eq("professor_id", p.professorId);
    throw e;
  }
  return atividadeId;
}
