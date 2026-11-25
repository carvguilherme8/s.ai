"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { geminiConfigurado } from "@/lib/material-ia";
import { diagnosticosDoProfessor } from "@/lib/diagnostico";
import { gerarResumoIA } from "@/lib/diagnostico-ia";
import { gerarQuestoesDoTopico } from "@/lib/questoes-ia";
import { corrigirDissertativa, type Rubrica } from "@/lib/correcao-ia";
import { salvarAtividadeGerada } from "@/lib/salvar-atividade";
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

const QUESTOES_REFORCO = 5;

/**
 * Cria um Rascunho de atividade de reforço para uma Lacuna: questões sobre o tópico, com distratores
 * que testam os equívocos mais frequentes da turma. A professora revisa e publica.
 */
export async function gerarReforco(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { supabase, professor } = await getProfessorAtual();
  const turmaId = String(formData.get("turma_id") ?? "");
  const topicoId = String(formData.get("topico_id") ?? "");
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };

  const diag = (await diagnosticosDoProfessor(professor.id)).find((d) => d.turma.id === turmaId);
  if (!diag) return { erro: "Turma inválida." };

  const { data: topico } = await supabase
    .from("topicos").select("id, nome, descricao, material_id")
    .eq("id", topicoId).eq("professor_id", professor.id).maybeSingle();
  if (!topico) return { erro: "Tópico inválido." };
  if (!topico.material_id) return { erro: "Este tópico não está ligado a um material. Gere o reforço pela tela Atividades." };

  const { data: trechos } = await supabase
    .from("material_trechos").select("id, ordem, pagina, conteudo").eq("material_id", topico.material_id).order("ordem");
  if (!trechos?.length) return { erro: "O material deste tópico não tem trechos indexados." };

  const foco = diag.equivocos.filter((e) => e.topicoId === topicoId).slice(0, 3).map((e) => e.equivoco);

  let geradas;
  try {
    geradas = await gerarQuestoesDoTopico(topico, trechos, QUESTOES_REFORCO, 0, foco);
  } catch (e) {
    console.error("gerarReforco:", e);
    return { erro: "A IA não respondeu agora (cota ou rede). Tente de novo em instantes." };
  }
  if (geradas.length < 3) return { erro: "A IA não gerou questões suficientes. Tente de novo." };

  let atividadeId: string;
  try {
    atividadeId = await salvarAtividadeGerada(supabase, {
      professorId: professor.id, turmaId, materialId: topico.material_id, titulo: `Reforço: ${topico.nome}`, geradas, trechos,
    });
  } catch (e) {
    console.error("gerarReforco salvar:", e);
    return { erro: "Não foi possível salvar a atividade. Tente de novo." };
  }
  redirect(`/atividades/${atividadeId}`);
}

/** A resposta precisa ser de um aluno das turmas desta professora. Devolve o id do aluno. */
async function respostaDaProfessora(respostaId: string, professorId: string) {
  const { supabase } = await getProfessorAtual();
  const { data } = await supabase
    .from("respostas")
    .select("id, texto, entrega:entregas(aluno_id, atividade:atividades(professor_id)), questao:questoes(enunciado, rubrica, trecho:material_trechos(conteudo))")
    .eq("id", respostaId)
    .maybeSingle();
  if (!data || data.entrega?.atividade?.professor_id !== professorId) return null;
  return { supabase, resposta: data, alunoId: data.entrega.aluno_id };
}

/** Professora ajusta a nota da IA (0 a 10) ou volta para a nota da IA (campo vazio). */
export async function ajustarNota(formData: FormData) {
  const { professor } = await getProfessorAtual();
  const alvo = await respostaDaProfessora(String(formData.get("resposta_id") ?? ""), professor.id);
  if (!alvo) return;

  const bruto = String(formData.get("nota") ?? "").trim().replace(",", ".");
  let nota: number | null = null;
  if (bruto !== "") {
    const n = Number(bruto);
    if (!Number.isFinite(n) || n < 0 || n > 10) return;
    nota = Math.round((n / 10) * 1000) / 1000;
  }
  await alvo.supabase.from("respostas").update({ nota_ajustada: nota }).eq("id", alvo.resposta.id);
  revalidatePath(`/diagnostico/aluno/${alvo.alunoId}`);
  revalidatePath("/diagnostico");
}

/** Refaz a correção por IA de uma dissertativa que ficou pendente (cota esgotada ou falha de rede). */
export async function corrigirPendente(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { professor } = await getProfessorAtual();
  const alvo = await respostaDaProfessora(String(formData.get("resposta_id") ?? ""), professor.id);
  if (!alvo) return { erro: "Resposta inválida." };
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };

  const q = alvo.resposta.questao;
  if (!q?.rubrica || !alvo.resposta.texto) return { erro: "Esta resposta não tem rubrica ou texto para corrigir." };
  try {
    const c = await corrigirDissertativa(q.enunciado, q.rubrica as Rubrica, alvo.resposta.texto, q.trecho?.conteudo ?? "");
    await alvo.supabase.from("respostas").update({ nota_ia: c.nota, correcao: c as unknown as Json }).eq("id", alvo.resposta.id);
  } catch (e) {
    console.error("corrigirPendente:", e);
    return { erro: "A IA não respondeu agora. Tente de novo em instantes." };
  }
  revalidatePath(`/diagnostico/aluno/${alvo.alunoId}`);
  revalidatePath("/diagnostico");
}
