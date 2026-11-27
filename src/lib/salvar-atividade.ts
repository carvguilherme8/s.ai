import "server-only";
import { randomInt } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { QuestaoGerada } from "@/lib/questoes-ia";
import { REGRAS_GLOBAIS_PADRAO, type RegrasGlobaisProva } from "@/lib/nota-rubrica";

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Grava uma Atividade (em Rascunho) com as Questões geradas pela IA.
 * Embaralha obrigatoriamente a ordem das alternativas (elimina viés de posição do LLM).
 * Se algo falhar no meio, apaga o que já tinha gravado e relança o erro.
 */
export async function salvarAtividadeGerada(
  db: SupabaseClient<Database>,
  p: {
    professorId: string;
    turmaId: string;
    materialId: string | null;
    titulo: string;
    geradas: QuestaoGerada[];
    trechos: { id: string; ordem: number }[];
    ehReforco?: boolean;
    regrasGlobais?: Partial<RegrasGlobaisProva>;
    revisarAntesLiberar?: boolean;
  },
): Promise<string> {
  const trechoPorOrdem = new Map(p.trechos.map((t) => [t.ordem, t.id]));
  const atividadeId = crypto.randomUUID();
  const regrasGlobais = { ...REGRAS_GLOBAIS_PADRAO, ...p.regrasGlobais };

  try {
    const { error } = await db.from("atividades").insert({
      id: atividadeId,
      professor_id: p.professorId,
      turma_id: p.turmaId,
      material_id: p.materialId,
      titulo: p.titulo,
      regras_globais: regrasGlobais as unknown as Json,
      revisar_antes_liberar: Boolean(p.revisarAntesLiberar),
    });
    if (error) throw error;
    if (p.ehReforco) {
      const { error: erroReforco } = await db.from("atividades").update({ eh_reforco: true }).eq("id", atividadeId);
      if (erroReforco) console.warn("eh_reforco:", erroReforco.message);
    }

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
        rubrica: q.rubrica ? (q.rubrica as unknown as Json) : null,
      });
      if (eq) throw eq;
      if (q.tipo === "multipla_escolha") {
        const embaralhadas = embaralhar(q.alternativas);
        const { error: ea } = await db.from("alternativas").insert(
          embaralhadas.map((a, j) => ({
            questao_id: questaoId,
            ordem: j,
            texto: a.texto,
            correta: a.correta,
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
