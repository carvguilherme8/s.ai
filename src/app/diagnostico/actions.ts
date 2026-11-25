"use server";

import { revalidatePath } from "next/cache";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { geminiConfigurado } from "@/lib/material-ia";
import { diagnosticosDoProfessor } from "@/lib/diagnostico";
import { gerarResumoIA } from "@/lib/diagnostico-ia";
import type { Json } from "@/lib/supabase/database.types";

export type EstadoResumo = { erro?: string } | undefined;

/** Gera (ou atualiza) o resumo IA da Turma e o guarda em cache em diagnostico_resumos. */
export async function gerarResumo(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { supabase, professor } = await getProfessorAtual();
  const turmaId = String(formData.get("turma_id") ?? "");

  const diag = (await diagnosticosDoProfessor(professor.id)).find((d) => d.turma.id === turmaId);
  if (!diag) return { erro: "Turma inválida." };
  if (!diag.totalEntregas) return { erro: "Ainda não há entregas nesta turma." };
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };

  let conteudo;
  try {
    conteudo = await gerarResumoIA(diag);
  } catch (e) {
    console.error("gerarResumo:", e);
    return { erro: "A IA não respondeu agora (cota ou rede). O mapa e as lacunas acima continuam valendo; tente de novo em instantes." };
  }

  const { error } = await supabase.from("diagnostico_resumos").upsert({
    turma_id: turmaId,
    conteudo: conteudo as unknown as Json,
    gerado_em: new Date().toISOString(),
  });
  if (error) {
    console.error("gerarResumo upsert:", error);
    return { erro: "Não foi possível salvar o resumo." };
  }
  revalidatePath("/diagnostico");
}
