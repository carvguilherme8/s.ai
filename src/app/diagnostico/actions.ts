"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { geminiConfigurado } from "@/lib/material-ia";
import { diagnosticosDoProfessor } from "@/lib/diagnostico";
import { gerarResumoIA } from "@/lib/diagnostico-ia";
import { gerarQuestoesDoTopico } from "@/lib/questoes-ia";
import { corrigirDissertativa, type Rubrica } from "@/lib/correcao-ia";
import {
  calcularNotaDeterministica,
  normalizarRegrasGlobais,
  normalizarRubrica,
  type OverridesProfessor,
  type RegraPenalidade,
  type RubricaV2,
} from "@/lib/nota-rubrica";
import {
  detectarPadroesInesperadosIA,
  extrairCorrecaoV2,
  type PadraoInesperado,
} from "@/lib/revisao-dissertativas";
import { formatarTrechosParaPrompt, recuperarTrechosRelevantes } from "@/lib/rag";
import { salvarAtividadeGerada } from "@/lib/salvar-atividade";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";

export type EstadoResumo = { erro?: string; ok?: string } | undefined;
export type EstadoNota = { erro?: string; ok?: string; nota?: number; percentual?: number } | undefined;
export type EstadoPadroes = { erro?: string; padroes?: PadraoInesperado[]; analisado?: boolean };

/** Sincroniza `entregas.feedback` após ajuste docente para que o feedback nunca contradiga a nota ajustada. */
async function sincronizarFeedbackEntrega(
  supabase: SupabaseClient<Database>,
  entregaId: string,
  questaoId: string,
  notaNova: number | null,
  comentarioProfessor?: string | null,
) {
  const { data: entrega } = await supabase
    .from("entregas")
    .select("feedback")
    .eq("id", entregaId)
    .maybeSingle();
  if (!entrega?.feedback || typeof entrega.feedback !== "object" || Array.isArray(entrega.feedback)) return;

  type ItemFb = { questao_id: string; nota: number | null; explicacao: string | null; revisar: unknown };
  const fb = entrega.feedback as { resumo?: string | null; itens?: ItemFb[] };
  if (!Array.isArray(fb.itens)) return;

  const coment = comentarioProfessor?.trim() || null;
  const itensAtualizados = fb.itens.map((it) => {
    if (it.questao_id !== questaoId) return it;
    let novaExplicacao = it.explicacao;
    if (coment) {
      novaExplicacao = coment;
    } else if (notaNova !== null && notaNova >= 1) {
      novaExplicacao = null;
    }
    return { ...it, nota: notaNova, explicacao: novaExplicacao };
  });

  await supabase
    .from("entregas")
    .update({ feedback: { ...fb, itens: itensAtualizados } as unknown as Json })
    .eq("id", entregaId);
}

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
 * que testam os equívocos mais frequentes da turma (incluindo falhas das dissertativas!).
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

  const trechos = topico.material_id
    ? (
        await supabase
          .from("material_trechos")
          .select("id, ordem, pagina, conteudo")
          .eq("material_id", topico.material_id)
          .order("ordem")
      ).data ?? []
    : [];
  if (topico.material_id && !trechos.length) return { erro: "O material deste tópico não tem trechos indexados." };

  const foco = diag.equivocos.filter((e) => e.topicoId === topicoId).slice(0, 3).map((e) => e.equivoco);
  const relevantes = topico.material_id
    ? await recuperarTrechosRelevantes(
        supabase,
        topico.material_id,
        `${topico.nome}${topico.descricao ? `: ${topico.descricao}` : ""}${foco.length ? ` Equívocos da turma: ${foco.join("; ")}` : ""}`,
        { limite: 6, fallback: trechos },
      )
    : [];

  let geradas;
  try {
    geradas = await gerarQuestoesDoTopico(topico, relevantes, QUESTOES_REFORCO, 0, foco);
  } catch (e) {
    console.error("gerarReforco:", e);
    return { erro: "A IA não respondeu agora (cota ou rede). Tente de novo em instantes." };
  }
  if (geradas.length < 3) return { erro: "A IA não gerou questões suficientes. Tente de novo." };

  let atividadeId: string;
  try {
    atividadeId = await salvarAtividadeGerada(supabase, {
      professorId: professor.id, turmaId, materialId: topico.material_id, titulo: `Reforço: ${topico.nome}`, geradas, trechos, ehReforco: true,
    });
  } catch (e) {
    console.error("gerarReforco salvar:", e);
    return { erro: "Não foi possível salvar a atividade. Tente de novo." };
  }
  redirect(`/atividades/${atividadeId}`);
}

/** A resposta precisa ser de um aluno das turmas desta professora. */
async function respostaDaProfessora(respostaId: string, professorId: string) {
  const { supabase } = await getProfessorAtual();
  const { data } = await supabase
    .from("respostas")
    .select(
      `id, entrega_id, questao_id, texto, nota_ia, correcao,
       entrega:entregas(aluno_id, atividade:atividades(id, professor_id, material_id, regras_globais)),
       questao:questoes(enunciado, rubrica, topico:topicos(nome), trecho:material_trechos(conteudo))`,
    )
    .eq("id", respostaId)
    .maybeSingle();
  if (!data || data.entrega?.atividade?.professor_id !== professorId) return null;
  return { supabase, resposta: data, alunoId: data.entrega.aluno_id };
}

/** Professora ajusta manualmente a nota da IA (0 a 10) + comentário opcional, sincronizando o feedback. */
export async function ajustarNota(_: EstadoNota, formData: FormData): Promise<EstadoNota> {
  const { professor } = await getProfessorAtual();
  const alvo = await respostaDaProfessora(String(formData.get("resposta_id") ?? ""), professor.id);
  if (!alvo) return { erro: "Resposta não encontrada." };

  const bruto = String(formData.get("nota") ?? "").trim().replace(",", ".");
  const comentarioProfessor = String(formData.get("comentario_professor") ?? "").trim() || null;

  let nota: number | null = null;
  if (bruto !== "") {
    const n = Number(bruto);
    if (!Number.isFinite(n) || n < 0 || n > 10) {
      return { erro: "Informe uma nota válida entre 0 e 10." };
    }
    nota = Math.round((n / 10) * 1000) / 1000;
  }

  let novaCorrecao = alvo.resposta.correcao;
  const v2 = extrairCorrecaoV2(alvo.resposta.correcao);
  if (v2 && comentarioProfessor !== null) {
    novaCorrecao = {
      ...v2,
      overrides_professor: { ...v2.overrides_professor, comentario_professor: comentarioProfessor },
      comentario: comentarioProfessor,
    } as unknown as Json;
  }

  const { error } = await alvo.supabase
    .from("respostas")
    .update({
      nota_ajustada: nota,
      correcao: novaCorrecao,
      revisada_em: new Date().toISOString(),
    })
    .eq("id", alvo.resposta.id);
  if (error) {
    console.error("ajustarNota:", error);
    return { erro: "Não foi possível salvar a nota. Tente novamente." };
  }

  await sincronizarFeedbackEntrega(
    alvo.supabase,
    alvo.resposta.entrega_id,
    alvo.resposta.questao_id,
    nota ?? (alvo.resposta.nota_ia === null ? null : Number(alvo.resposta.nota_ia)),
    comentarioProfessor,
  );

  revalidatePath(`/diagnostico/aluno/${alvo.alunoId}`);
  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/revisao");
  return { ok: nota === null ? "Nota restaurada para a da IA." : "Nota ajustada." };
}

/**
 * Clique em pílula pós-correção: aplica overrides do professor e recalcula a nota em <50ms
 * pelo motor determinístico (SEM chamar o Gemini novamente!), sincronizando o feedback do aluno.
 */
export async function alternarPilulaResposta(_: EstadoNota, formData: FormData): Promise<EstadoNota> {
  const { professor } = await getProfessorAtual();
  const alvo = await respostaDaProfessora(String(formData.get("resposta_id") ?? ""), professor.id);
  if (!alvo) return { erro: "Resposta não encontrada." };

  const v2 = extrairCorrecaoV2(alvo.resposta.correcao);
  if (!v2) return { erro: "Esta resposta não usa correção por pílulas (v2)." };

  let overrides: OverridesProfessor;
  try {
    overrides = JSON.parse(String(formData.get("overrides_json") ?? "{}")) as OverridesProfessor;
  } catch {
    return { erro: "Overrides inválidos." };
  }

  const rubrica = normalizarRubrica(alvo.resposta.questao?.rubrica);
  const regrasGlobais = normalizarRegrasGlobais(alvo.resposta.entrega?.atividade?.regras_globais);
  const recalculada = calcularNotaDeterministica(rubrica, v2.avaliacao_ia, regrasGlobais, overrides);

  const { error } = await alvo.supabase
    .from("respostas")
    .update({
      nota_ajustada: recalculada.nota,
      correcao: recalculada as unknown as Json,
      revisada_em: new Date().toISOString(),
    })
    .eq("id", alvo.resposta.id);
  if (error) {
    console.error("alternarPilulaResposta:", error);
    return { erro: "Não foi possível salvar o recálculo." };
  }

  await sincronizarFeedbackEntrega(
    alvo.supabase,
    alvo.resposta.entrega_id,
    alvo.resposta.questao_id,
    recalculada.nota,
    overrides.comentario_professor,
  );

  revalidatePath(`/diagnostico/aluno/${alvo.alunoId}`);
  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/revisao");
  return { ok: "Recalculado instantaneamente.", nota: recalculada.nota, percentual: recalculada.percentual };
}

/**
 * Recálculo em lote (estilo Gradescope): quando a professora muda o peso/teto de uma pílula após entregas,
 * recalcula todas as respostas daquela questão no servidor em código puro (0 tokens de IA).
 */
export async function recalcularPesoQuestaoEmLote(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { supabase, professor } = await getProfessorAtual();
  const questaoId = String(formData.get("questao_id") ?? "");
  if (!questaoId) return { erro: "Questão inválida." };

  const { data: q } = await supabase
    .from("questoes")
    .select("id, atividade:atividades(id, professor_id, regras_globais)")
    .eq("id", questaoId)
    .maybeSingle();
  if (!q || q.atividade?.professor_id !== professor.id) return { erro: "Questão não encontrada." };

  let rubricaNova: RubricaV2;
  try {
    rubricaNova = normalizarRubrica(JSON.parse(String(formData.get("rubrica_json") ?? "{}")));
  } catch {
    return { erro: "Rubrica inválida." };
  }
  if (!rubricaNova.positivos.length) return { erro: "Mantenha ao menos um critério positivo." };

  const { error: errQ } = await supabase
    .from("questoes")
    .update({ rubrica: rubricaNova as unknown as Json })
    .eq("id", questaoId);
  if (errQ) return { erro: "Não foi possível atualizar os pesos da questão." };

  const regrasGlobais = normalizarRegrasGlobais(q.atividade.regras_globais);
  const { data: respostas } = await supabase
    .from("respostas")
    .select("id, entrega_id, nota_ajustada, correcao")
    .eq("questao_id", questaoId);

  let atualizadas = 0;
  for (const r of respostas ?? []) {
    const v2 = extrairCorrecaoV2(r.correcao);
    if (!v2) continue;
    const recalc = calcularNotaDeterministica(rubricaNova, v2.avaliacao_ia, regrasGlobais, v2.overrides_professor);
    const temOverride =
      Boolean(v2.overrides_professor?.criterios && Object.keys(v2.overrides_professor.criterios).length) ||
      Boolean(v2.overrides_professor?.penalidades && Object.keys(v2.overrides_professor.penalidades).length);

    const { error } = await supabase
      .from("respostas")
      .update({
        nota_ia: recalc.nota,
        nota_ajustada: temOverride || r.nota_ajustada !== null ? recalc.nota : null,
        correcao: recalc as unknown as Json,
      })
      .eq("id", r.id);
    if (!error) {
      atualizadas++;
      await sincronizarFeedbackEntrega(supabase, r.entrega_id, questaoId, recalc.nota, v2.overrides_professor?.comentario_professor);
    }
  }

  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/revisao");
  revalidatePath(`/atividades/${q.atividade.id}`);
  return { ok: `Pesos atualizados e ${atualizadas} ${atualizadas === 1 ? "resposta recalculada" : "respostas recalculadas"} sem IA.` };
}

/** Exclui ou reinclui uma entrega no Mapa de Calor do Diagnóstico (ex.: cola confirmada pela professora). */
export async function alternarDesconsiderarEntrega(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { supabase, professor } = await getProfessorAtual();
  const entregaId = String(formData.get("entrega_id") ?? "");
  const desconsiderar = formData.get("desconsiderar") === "true";

  const { data: entrega } = await supabase
    .from("entregas")
    .select("id, aluno_id, atividade:atividades(professor_id)")
    .eq("id", entregaId)
    .maybeSingle();
  if (!entrega || entrega.atividade?.professor_id !== professor.id) return { erro: "Entrega não encontrada." };

  const { error } = await supabase
    .from("entregas")
    .update({ desconsiderar_diagnostico: desconsiderar })
    .eq("id", entregaId);
  if (error) return { erro: "Não foi possível atualizar a entrega." };

  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/revisao");
  revalidatePath(`/diagnostico/aluno/${entrega.aluno_id}`);
  return {
    ok: desconsiderar
      ? "Entrega desconsiderada no Diagnóstico da turma."
      : "Entrega reincluída no Diagnóstico da turma.",
  };
}

/** Libera as entregas retidas pela trava humana ("Revisar dissertativas antes de liberar"). */
export async function liberarEntregasAtividade(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { supabase, professor } = await getProfessorAtual();
  const atividadeId = String(formData.get("atividade_id") ?? "");
  const entregaId = String(formData.get("entrega_id") ?? "");

  if (entregaId) {
    const { data: e } = await supabase
      .from("entregas")
      .select("id, atividade:atividades(id, professor_id)")
      .eq("id", entregaId)
      .maybeSingle();
    if (!e || e.atividade?.professor_id !== professor.id) return { erro: "Entrega inválida." };
    await supabase.from("entregas").update({ liberada_em: new Date().toISOString() }).eq("id", entregaId);
    revalidatePath("/diagnostico/revisao");
    revalidatePath(`/aluno/atividades/${e.atividade.id}`);
    return { ok: "Correção liberada para o aluno." };
  }

  const { data: ativ } = await supabase
    .from("atividades")
    .select("id")
    .eq("id", atividadeId)
    .eq("professor_id", professor.id)
    .maybeSingle();
  if (!ativ) return { erro: "Atividade inválida." };

  const { data: atualizadas } = await supabase
    .from("entregas")
    .update({ liberada_em: new Date().toISOString() })
    .eq("atividade_id", atividadeId)
    .is("liberada_em", null)
    .select("id");

  revalidatePath("/diagnostico/revisao");
  revalidatePath(`/aluno/atividades/${atividadeId}`);
  return { ok: `${atualizadas?.length ?? 0} entrega(s) liberada(s) para os alunos.` };
}

/** Refaz a correção por IA de uma dissertativa que ficou pendente. */
export async function corrigirPendente(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { professor } = await getProfessorAtual();
  const alvo = await respostaDaProfessora(String(formData.get("resposta_id") ?? ""), professor.id);
  if (!alvo) return { erro: "Resposta inválida." };
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };

  const q = alvo.resposta.questao;
  if (!q?.rubrica || !alvo.resposta.texto) return { erro: "Esta resposta não tem rubrica ou texto para corrigir." };
  try {
    let referencia = q.trecho?.conteudo ?? "";
    const materialId = alvo.resposta.entrega?.atividade?.material_id ?? null;
    if (!referencia && materialId) {
      const encontrados = await recuperarTrechosRelevantes(
        alvo.supabase,
        materialId,
        `${q.topico?.nome ?? ""} ${q.enunciado}`,
        { limite: 2 },
      );
      referencia = formatarTrechosParaPrompt(encontrados);
    }
    const c = await corrigirDissertativa(q.enunciado, q.rubrica as Rubrica, alvo.resposta.texto, referencia, {
      regrasGlobais: normalizarRegrasGlobais(alvo.resposta.entrega?.atividade?.regras_globais),
    });
    await alvo.supabase.from("respostas").update({ nota_ia: c.nota, correcao: c as unknown as Json }).eq("id", alvo.resposta.id);
    await sincronizarFeedbackEntrega(alvo.supabase, alvo.resposta.entrega_id, alvo.resposta.questao_id, c.nota, null);
  } catch (e) {
    console.error("corrigirPendente:", e);
    return { erro: "A IA não respondeu agora. Tente de novo em instantes." };
  }
  revalidatePath(`/diagnostico/aluno/${alvo.alunoId}`);
  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/revisao");
  return { ok: "Resposta corrigida pela IA." };
}

/** Re-corrige em lote todas as dissertativas pendentes do professor (ou de uma atividade específica). */
export async function recorrigirPendentesEmLote(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { supabase, professor } = await getProfessorAtual();
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };
  const atividadeId = String(formData.get("atividade_id") ?? "");

  let ativQuery = supabase.from("atividades").select("id, material_id, regras_globais").eq("professor_id", professor.id);
  if (atividadeId) ativQuery = ativQuery.eq("id", atividadeId);
  const { data: atividades } = await ativQuery;
  if (!atividades?.length) return { ok: "Nenhuma resposta pendente." };

  const ativPorId = new Map(atividades.map((a) => [a.id, a]));
  const { data: entregas } = await supabase
    .from("entregas")
    .select("id, atividade_id")
    .in("atividade_id", atividades.map((a) => a.id));
  if (!entregas?.length) return { ok: "Nenhuma resposta pendente." };

  const entregaAtiv = new Map(entregas.map((e) => [e.id, e.atividade_id]));
  const { data: pendentes } = await supabase
    .from("respostas")
    .select("id, entrega_id, questao_id, texto, questao:questoes(tipo, enunciado, rubrica, topico:topicos(nome), trecho:material_trechos(conteudo))")
    .in("entrega_id", entregas.map((e) => e.id))
    .is("nota_ia", null)
    .is("nota_ajustada", null);

  const dissertativas = (pendentes ?? []).filter((r) => r.questao?.tipo === "dissertativa" && r.texto && r.questao.rubrica);
  if (!dissertativas.length) return { ok: "Nenhuma resposta pendente encontrada." };

  let okCount = 0;
  await Promise.all(
    dissertativas.slice(0, 15).map(async (r) => {
      try {
        const ativ = ativPorId.get(entregaAtiv.get(r.entrega_id) ?? "");
        const c = await corrigirDissertativa(
          r.questao!.enunciado,
          r.questao!.rubrica as Rubrica,
          r.texto!,
          r.questao!.trecho?.conteudo ?? "",
          { regrasGlobais: normalizarRegrasGlobais(ativ?.regras_globais) },
        );
        await supabase.from("respostas").update({ nota_ia: c.nota, correcao: c as unknown as Json }).eq("id", r.id);
        await sincronizarFeedbackEntrega(supabase, r.entrega_id, r.questao_id, c.nota, null);
        okCount++;
      } catch (e) {
        console.error("recorrigirPendentesEmLote:", e);
      }
    }),
  );

  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/revisao");
  return okCount > 0
    ? { ok: `${okCount} de ${dissertativas.length} resposta(s) pendente(s) corrigida(s).` }
    : { erro: "A IA não conseguiu corrigir agora (cota ou rede)." };
}

/** Rubrica Reversa (Passo 1): detecta padrões inesperados em >= 3 alunos de uma questão dissertativa. */
export async function analisarPadroesInesperados(_: EstadoPadroes, formData: FormData): Promise<EstadoPadroes> {
  const { supabase, professor } = await getProfessorAtual();
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };
  const questaoId = String(formData.get("questao_id") ?? "");

  const { data: q } = await supabase
    .from("questoes")
    .select("id, enunciado, rubrica, atividade:atividades(professor_id)")
    .eq("id", questaoId)
    .maybeSingle();
  if (!q || q.atividade?.professor_id !== professor.id) return { erro: "Questão não encontrada." };

  const { data: respostas } = await supabase
    .from("respostas")
    .select("id, texto")
    .eq("questao_id", questaoId)
    .not("texto", "is", null);

  const validas = (respostas ?? []).filter((r): r is { id: string; texto: string } => Boolean(r.texto?.trim()));
  if (validas.length < 3) return { erro: "São necessárias ao menos 3 respostas para detectar padrões recorrentes." };

  try {
    const padroes = await detectarPadroesInesperadosIA(q.enunciado, normalizarRubrica(q.rubrica), validas);
    return { padroes, analisado: true };
  } catch (e) {
    console.error("analisarPadroesInesperados:", e);
    return { erro: "A IA não respondeu agora. Tente novamente em instantes." };
  }
}

/** Rubrica Reversa (Passo 2): adiciona a penalidade/teto detectada e recalcula os alunos afetados em 1 clique. */
export async function aplicarPadraoInesperado(_: EstadoResumo, formData: FormData): Promise<EstadoResumo> {
  const { supabase, professor } = await getProfessorAtual();
  const questaoId = String(formData.get("questao_id") ?? "");

  const { data: q } = await supabase
    .from("questoes")
    .select("id, rubrica, atividade:atividades(id, professor_id, regras_globais)")
    .eq("id", questaoId)
    .maybeSingle();
  if (!q || q.atividade?.professor_id !== professor.id) return { erro: "Questão não encontrada." };

  let padrao: PadraoInesperado;
  try {
    padrao = JSON.parse(String(formData.get("padrao_json") ?? "{}")) as PadraoInesperado;
  } catch {
    return { erro: "Padrão inválido." };
  }
  if (!padrao.descricao || !padrao.resposta_ids?.length) return { erro: "Padrão incompleto." };

  const rubricaAtual = normalizarRubrica(q.rubrica);
  const novaPenId = `p_rev_${Date.now().toString(36)}`;
  const novaPen: RegraPenalidade = {
    id: novaPenId,
    texto: padrao.descricao,
    equivoco: padrao.equivoco || padrao.descricao,
    modo: padrao.modo === "desconto" ? "desconto" : "teto",
    valor: Math.min(100, Math.max(0, Number(padrao.valor) || 50)),
    ignora_etapas_intermediarias: padrao.modo === "teto",
    ativa: true,
  };
  const rubricaNova: RubricaV2 = {
    ...rubricaAtual,
    penalidades: [...rubricaAtual.penalidades, novaPen],
  };

  await supabase.from("questoes").update({ rubrica: rubricaNova as unknown as Json }).eq("id", questaoId);

  const regrasGlobais = normalizarRegrasGlobais(q.atividade.regras_globais);
  const afetados = new Set(padrao.resposta_ids);
  const { data: respostas } = await supabase
    .from("respostas")
    .select("id, entrega_id, nota_ia, correcao")
    .eq("questao_id", questaoId)
    .in("id", [...afetados]);

  let recalculadas = 0;
  for (const r of respostas ?? []) {
    const v2 = extrairCorrecaoV2(r.correcao);
    if (!v2) continue;
    const overrides: OverridesProfessor = {
      ...v2.overrides_professor,
      penalidades: { ...v2.overrides_professor?.penalidades, [novaPenId]: true },
    };
    const recalc = calcularNotaDeterministica(rubricaNova, v2.avaliacao_ia, regrasGlobais, overrides);
    await supabase
      .from("respostas")
      .update({ nota_ajustada: recalc.nota, correcao: recalc as unknown as Json })
      .eq("id", r.id);
    await sincronizarFeedbackEntrega(supabase, r.entrega_id, questaoId, recalc.nota, overrides.comentario_professor);
    recalculadas++;
  }

  revalidatePath("/diagnostico");
  revalidatePath("/diagnostico/revisao");
  revalidatePath(`/atividades/${q.atividade.id}`);
  return {
    ok: `Regra "${novaPen.texto}" criada e aplicada a ${recalculadas} ${recalculadas === 1 ? "aluno" : "alunos"}.`,
  };
}
