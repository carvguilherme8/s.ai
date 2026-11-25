import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { geminiConfigurado, gerarEmbeddingConsulta, gerarEmbeddings } from "@/lib/material-ia";
import type { TrechoRef } from "@/lib/questoes-ia";

export type TrechoRecuperado = TrechoRef & { id: string; similaridade?: number };

/**
 * Preenche embeddings faltantes de um Material (ex.: materiais de seed ou falhas temporárias de cota).
 * Melhor esforço: erros não interrompem o fluxo principal.
 */
async function indexarTrechosPendentes(db: SupabaseClient<Database>, materialId: string): Promise<boolean> {
  if (!geminiConfigurado()) return false;
  const { data: pendentes } = await db
    .from("material_trechos")
    .select("id, conteudo")
    .eq("material_id", materialId)
    .is("embedding", null)
    .order("ordem");
  if (!pendentes?.length) return false;

  const vetores = await gerarEmbeddings(pendentes.map((t) => t.conteudo));
  let atualizados = 0;
  for (const [i, t] of pendentes.entries()) {
    const v = vetores[i];
    if (!v?.length) continue;
    const { error } = await db
      .from("material_trechos")
      .update({ embedding: JSON.stringify(v) })
      .eq("id", t.id);
    if (!error) atualizados++;
  }
  return atualizados > 0;
}

/**
 * Recupera os trechos mais relevantes de um Material via pgvector (distância de cosseno),
 * devolvidos em ordem de leitura (`ordem`).
 *
 * - Se `fallback` já couber inteiro dentro de `limite`, evita chamada desnecessária à API.
 * - Se o material ainda não tiver embeddings gravados, indexa-os automaticamente uma vez.
 * - Se a RPC (migration) ou a API de embeddings falhar, degrada suavemente para `fallback`.
 */
export async function recuperarTrechosRelevantes(
  db: SupabaseClient<Database>,
  materialId: string,
  consulta: string,
  opcoes?: { limite?: number; fallback?: TrechoRef[] },
): Promise<TrechoRef[]> {
  const limite = opcoes?.limite ?? 6;
  const fallback = opcoes?.fallback ?? [];

  if (fallback.length > 0 && fallback.length <= limite) {
    return fallback;
  }
  if (!consulta.trim() || !geminiConfigurado()) {
    return fallback;
  }

  try {
    const vetor = await gerarEmbeddingConsulta(consulta);
    const embeddingStr = JSON.stringify(vetor);

    let { data, error } = await db.rpc("buscar_trechos_similares", {
      p_material: materialId,
      p_embedding: embeddingStr,
      p_limite: limite,
    });
    if (error) {
      console.warn("buscar_trechos_similares indisponível, usando fallback:", error.message);
      return fallback;
    }

    // Se ainda não há embeddings salvos neste material, indexa sob demanda e tenta uma vez.
    if (!data?.length) {
      const indexou = await indexarTrechosPendentes(db, materialId);
      if (indexou) {
        ({ data, error } = await db.rpc("buscar_trechos_similares", {
          p_material: materialId,
          p_embedding: embeddingStr,
          p_limite: limite,
        }));
        if (error) {
          console.warn("buscar_trechos_similares pós-indexação:", error.message);
          return fallback;
        }
      }
    }

    if (!data?.length) return fallback;

    return [...data]
      .sort((a, b) => a.ordem - b.ordem)
      .map((t) => ({ ordem: t.ordem, pagina: t.pagina, conteudo: t.conteudo }));
  } catch (e) {
    console.warn("RAG fallback:", e);
    return fallback;
  }
}

/** Formata trechos recuperados (ordenados e sem duplicatas por `ordem`) em texto para prompt de correção/feedback. */
export function formatarTrechosParaPrompt(trechos: TrechoRef[]): string {
  const unicos = new Map<number, TrechoRef>();
  for (const t of trechos) {
    if (!unicos.has(t.ordem)) unicos.set(t.ordem, t);
  }
  return [...unicos.values()]
    .sort((a, b) => a.ordem - b.ordem)
    .map((t) => `${t.pagina ? `[página ${t.pagina}]\n` : ""}${t.conteudo}`)
    .join("\n\n");
}
