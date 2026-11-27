"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { geminiConfigurado } from "@/lib/material-ia";
import { gerarQuestoesDoTopico, type QuestaoGerada } from "@/lib/questoes-ia";
import { gerarExemplosCalibracao } from "@/lib/correcao-ia";
import {
  normalizarRegrasGlobais,
  normalizarRubrica,
  somaPesosPositivos,
  type CorrecaoDissertativaV2,
  type ExemploCalibracao,
  type RegraPenalidade,
  type RegrasGlobaisProva,
  type RubricaV2,
} from "@/lib/nota-rubrica";
import { recuperarTrechosRelevantes } from "@/lib/rag";
import { salvarAtividadeGerada } from "@/lib/salvar-atividade";
import type { Json } from "@/lib/supabase/database.types";

export type EstadoForm = { erro?: string } | undefined;
export type EstadoQuestao = { erro?: string; ok?: string } | undefined;
export type EstadoCalibracao = {
  erro?: string;
  ok?: string;
  simuladas?: {
    id: string;
    nivel: "forte" | "media" | "fraca";
    resposta: string;
    correcao: CorrecaoDissertativaV2;
  }[];
};

const inteiro = (v: FormDataEntryValue | null, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export async function gerarAtividade(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const { supabase, professor } = await getProfessorAtual();

  const modo = formData.get("modo") === "tema" ? "tema" : "material";
  const turmaId = String(formData.get("turma_id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").replace(/\s+/g, " ").trim();
  const nMC = inteiro(formData.get("mc_por_topico"), 0, 5, 3);
  const nDiss = inteiro(formData.get("dissertativas"), 0, 3, 1);

  if (!titulo) return { erro: "Dê um título à atividade." };
  if (titulo.length > 120) return { erro: "O título pode ter no máximo 120 caracteres." };
  if (nMC + nDiss === 0) return { erro: "Peça pelo menos uma questão." };
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada no .env.local." };

  const { data: turma } = await supabase
    .from("turmas").select("id").eq("id", turmaId).eq("professor_id", professor.id).maybeSingle();
  if (!turma) return { erro: "Turma inválida." };

  if (modo === "tema") {
    const tema = String(formData.get("tema") ?? "").replace(/\s+/g, " ").trim();
    const orientacoes = String(formData.get("orientacoes") ?? "").trim();
    if (tema.length < 3) return { erro: "Digite o tema (mínimo 3 caracteres)." };
    if (tema.length > 100) return { erro: "O tema pode ter no máximo 100 caracteres." };
    if (orientacoes.length > 500) return { erro: "As orientações podem ter no máximo 500 caracteres." };

    const { data: existentes } = await supabase
      .from("topicos")
      .select("id, nome, descricao, confirmado")
      .eq("professor_id", professor.id);
    const encontrado = existentes?.find((t) => t.nome.toLocaleLowerCase("pt-BR") === tema.toLocaleLowerCase("pt-BR"));

    let topicoAlvo: { id: string; nome: string; descricao: string | null };
    let criouTopico = false;

    if (encontrado) {
      if (!encontrado.confirmado) {
        await supabase.from("topicos").update({ confirmado: true }).eq("id", encontrado.id).eq("professor_id", professor.id);
      }
      topicoAlvo = { id: encontrado.id, nome: encontrado.nome, descricao: encontrado.descricao };
    } else {
      const novoId = crypto.randomUUID();
      const { error: erroTopico } = await supabase.from("topicos").insert({
        id: novoId,
        professor_id: professor.id,
        material_id: null,
        nome: tema,
        descricao: orientacoes.slice(0, 240) || null,
        confirmado: true,
      });
      if (erroTopico) {
        console.error("gerarAtividade (tema) topico:", erroTopico);
        return { erro: "Não foi possível preparar o tópico. Tente novamente." };
      }
      topicoAlvo = { id: novoId, nome: tema, descricao: orientacoes.slice(0, 240) || null };
      criouTopico = true;
    }

    let geradas: QuestaoGerada[];
    try {
      geradas = await gerarQuestoesDoTopico(topicoAlvo, [], nMC, nDiss, [], orientacoes || null);
    } catch (e) {
      console.error("gerarAtividade (tema):", e);
      if (criouTopico) await supabase.from("topicos").delete().eq("id", topicoAlvo.id).eq("professor_id", professor.id);
      return { erro: "A IA não conseguiu gerar questões agora. Tente novamente." };
    }
    if (!geradas.length) {
      if (criouTopico) await supabase.from("topicos").delete().eq("id", topicoAlvo.id).eq("professor_id", professor.id);
      return { erro: "A IA não conseguiu gerar questões agora. Tente novamente." };
    }

    let atividadeId: string;
    try {
      atividadeId = await salvarAtividadeGerada(supabase, {
        professorId: professor.id, turmaId, materialId: null, titulo, geradas, trechos: [],
      });
    } catch (e) {
      console.error("gerarAtividade (tema) salvar:", e);
      if (criouTopico) await supabase.from("topicos").delete().eq("id", topicoAlvo.id).eq("professor_id", professor.id);
      return { erro: "Não foi possível salvar a atividade. Tente novamente." };
    }

    revalidatePath("/");
    revalidatePath("/atividades");
    redirect(`/atividades/${atividadeId}`);
  }

  const materialId = String(formData.get("material_id") ?? "");
  const { data: material } = await supabase
    .from("materiais").select("id, titulo").eq("id", materialId).eq("professor_id", professor.id).maybeSingle();
  if (!material) return { erro: "Material inválido." };

  const selecionados = new Set(formData.getAll("topico_ids").map(String).filter(Boolean));
  if (!selecionados.size) return { erro: "Selecione ao menos um tópico para gerar questões." };

  const [{ data: todosTopicos }, { data: trechos }] = await Promise.all([
    supabase.from("topicos").select("id, nome, descricao")
      .eq("material_id", materialId).eq("professor_id", professor.id).eq("confirmado", true).order("created_at"),
    supabase.from("material_trechos").select("id, ordem, pagina, conteudo").eq("material_id", materialId).order("ordem"),
  ]);
  const topicos = (todosTopicos ?? []).filter((t) => selecionados.has(t.id));
  if (!topicos.length) return { erro: "Selecione ao menos um tópico confirmado deste material antes de gerar questões." };
  if (!trechos?.length) return { erro: "Este material não tem trechos indexados. Envie-o novamente." };

  const resultados = await Promise.allSettled(
    topicos.map(async (t, i) => {
      const consulta = `${t.nome}${t.descricao ? `: ${t.descricao}` : ""}`;
      const relevantes = await recuperarTrechosRelevantes(supabase, materialId, consulta, {
        limite: 6,
        fallback: trechos,
      });
      return gerarQuestoesDoTopico(t, relevantes, nMC, i < nDiss ? 1 : 0);
    }),
  );
  const geradas: QuestaoGerada[] = resultados.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  resultados.forEach((r) => r.status === "rejected" && console.error("gerarQuestoes:", r.reason));
  if (!geradas.length) return { erro: "A IA não conseguiu gerar questões agora. Tente novamente." };

  let atividadeId: string;
  try {
    atividadeId = await salvarAtividadeGerada(supabase, {
      professorId: professor.id, turmaId, materialId, titulo, geradas, trechos,
    });
  } catch (e) {
    console.error("gerarAtividade:", e);
    return { erro: "Não foi possível salvar a atividade. Tente novamente." };
  }

  redirect(`/atividades/${atividadeId}`);
}

/** Garante que a atividade é do professor e ainda é rascunho. */
async function atividadeEditavel(atividadeId: string) {
  const { supabase, professor } = await getProfessorAtual();
  const { data } = await supabase.from("atividades").select("id, status, material_id, regras_globais")
    .eq("id", atividadeId).eq("professor_id", professor.id).maybeSingle();
  if (!data || data.status !== "rascunho") throw new Error("Atividade não editável.");
  return { supabase, professor, atividade: data };
}

function parseRubricaLegada(texto: string) {
  return texto.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [criterio, pontos] = l.split("|").map((s) => s.trim());
    return { criterio, pontos: Number(pontos?.replace(",", ".")) || 0 };
  }).filter((r) => r.criterio);
}

export async function salvarQuestao(_: EstadoQuestao, formData: FormData): Promise<EstadoQuestao> {
  const atividadeId = String(formData.get("atividade_id") ?? "");
  const questaoId = String(formData.get("questao_id") ?? "");

  let supabase;
  try {
    ({ supabase } = await atividadeEditavel(atividadeId));
  } catch {
    return { erro: "Esta atividade já foi publicada e não pode mais ser editada." };
  }

  const { data: q } = await supabase.from("questoes").select("id, tipo, rubrica")
    .eq("id", questaoId).eq("atividade_id", atividadeId).maybeSingle();
  if (!q) return { erro: "Questão não encontrada." };

  const enunciado = String(formData.get("enunciado") ?? "").trim();
  if (!enunciado) return { erro: "O enunciado não pode ficar vazio." };

  if (q.tipo === "dissertativa") {
    const rubricaJsonStr = String(formData.get("rubrica_json") ?? "").trim();
    let rubricaParaSalvar: RubricaV2;

    if (rubricaJsonStr) {
      try {
        const parsed = JSON.parse(rubricaJsonStr) as unknown;
        const atual = normalizarRubrica(q.rubrica);
        const normalizada = normalizarRubrica(parsed);
        // Preserva exemplos de calibração já salvos se não vierem no payload do editor
        rubricaParaSalvar = {
          ...normalizada,
          exemplos_calibracao: normalizada.exemplos_calibracao ?? atual.exemplos_calibracao,
        };
      } catch {
        return { erro: "Formato de rubrica inválido." };
      }
      if (!rubricaParaSalvar.positivos.length) {
        return { erro: "Adicione pelo menos um critério positivo (+%) na rubrica." };
      }
      if (somaPesosPositivos(rubricaParaSalvar.positivos) <= 0) {
        return { erro: "Os pesos dos critérios positivos devem somar mais que zero." };
      }
    } else {
      const legada = parseRubricaLegada(String(formData.get("rubrica") ?? ""));
      if (!legada.length) return { erro: "Informe ao menos um critério na rubrica." };
      if (legada.some((r) => r.pontos < 0) || legada.reduce((s, r) => s + r.pontos, 0) <= 0) {
        return { erro: "Os pontos da rubrica devem ser positivos e somar mais que zero." };
      }
      rubricaParaSalvar = normalizarRubrica(legada);
    }

    const { error } = await supabase
      .from("questoes")
      .update({ enunciado, rubrica: rubricaParaSalvar as unknown as Json })
      .eq("id", questaoId);
    if (error) return { erro: "Não foi possível salvar a questão." };
  } else {
    const { data: alts } = await supabase.from("alternativas").select("id").eq("questao_id", questaoId);
    const corretaId = String(formData.get("correta") ?? "");
    if (!alts?.some((a) => a.id === corretaId)) return { erro: "Marque qual alternativa é a correta." };
    const novas = alts.map((a) => ({
      id: a.id,
      texto: String(formData.get(`texto_${a.id}`) ?? "").trim(),
      correta: a.id === corretaId,
      equivoco: String(formData.get(`equivoco_${a.id}`) ?? "").trim(),
    }));
    if (novas.some((a) => !a.texto)) return { erro: "Preencha o texto de todas as alternativas." };
    if (novas.some((a) => !a.correta && !a.equivoco)) {
      return { erro: "Cada alternativa errada (distrator) precisa descrever o equívoco." };
    }
    const { error: eq } = await supabase.from("questoes").update({ enunciado }).eq("id", questaoId);
    if (eq) return { erro: "Não foi possível salvar o enunciado." };
    for (const a of novas) {
      const { error: ea } = await supabase.from("alternativas")
        .update({ texto: a.texto, correta: a.correta, equivoco: a.correta ? null : a.equivoco })
        .eq("id", a.id).eq("questao_id", questaoId);
      if (ea) return { erro: "Não foi possível salvar as alternativas." };
    }
  }
  revalidatePath(`/atividades/${atividadeId}`);
  return { ok: "Questão salva." };
}

/** Salva as regras globais da prova (ECF, método equivalente, método proibido, revisão prévia). */
export async function salvarRegrasAtividade(_: EstadoQuestao, formData: FormData): Promise<EstadoQuestao> {
  const atividadeId = String(formData.get("atividade_id") ?? "");
  let supabase;
  try {
    ({ supabase } = await atividadeEditavel(atividadeId));
  } catch {
    return { erro: "Esta atividade já foi publicada e não pode mais ser editada." };
  }

  let regras: RegrasGlobaisProva;
  try {
    regras = normalizarRegrasGlobais(JSON.parse(String(formData.get("regras_json") ?? "{}")));
  } catch {
    return { erro: "Regras inválidas." };
  }
  const revisarAntesLiberar = formData.get("revisar_antes_liberar") === "true";

  const { error } = await supabase
    .from("atividades")
    .update({
      regras_globais: regras as unknown as Json,
      revisar_antes_liberar: revisarAntesLiberar,
    })
    .eq("id", atividadeId);
  if (error) {
    console.error("salvarRegrasAtividade:", error);
    return { erro: "Não foi possível salvar as regras da prova." };
  }
  revalidatePath(`/atividades/${atividadeId}`);
  return { ok: "Regras da prova salvas." };
}

/** Salva um preset reutilizável de regras e penalidades padrão do professor (por disciplina). */
export async function salvarPresetRubrica(_: EstadoQuestao, formData: FormData): Promise<EstadoQuestao> {
  const { supabase, professor } = await getProfessorAtual();
  const nome = String(formData.get("nome") ?? "").replace(/\s+/g, " ").trim();
  const disciplina = String(formData.get("disciplina") ?? "").trim() || null;
  const atividadeId = String(formData.get("atividade_id") ?? "");

  if (!nome) return { erro: "Dê um nome ao padrão (ex.: Meu padrão de Física)." };
  if (nome.length > 80) return { erro: "Nome do padrão muito longo (máx. 80 caracteres)." };

  let regras: RegrasGlobaisProva;
  let pilulas: RegraPenalidade[] = [];
  try {
    regras = normalizarRegrasGlobais(JSON.parse(String(formData.get("regras_json") ?? "{}")));
    const brutoPilulas = JSON.parse(String(formData.get("pilulas_json") ?? "[]")) as unknown;
    if (Array.isArray(brutoPilulas)) pilulas = brutoPilulas as RegraPenalidade[];
  } catch {
    return { erro: "Dados do padrão inválidos." };
  }

  const { error } = await supabase.from("professor_rubrica_presets").insert({
    professor_id: professor.id,
    disciplina,
    nome,
    regras_globais: regras as unknown as Json,
    pilulas_padrao: pilulas as unknown as Json,
  });
  if (error) {
    console.error("salvarPresetRubrica:", error);
    return { erro: "Não foi possível salvar o padrão." };
  }
  if (atividadeId) revalidatePath(`/atividades/${atividadeId}`);
  return { ok: `Padrão "${nome}" salvo.` };
}

export async function removerPresetRubrica(formData: FormData) {
  const { supabase, professor } = await getProfessorAtual();
  const presetId = String(formData.get("preset_id") ?? "");
  const atividadeId = String(formData.get("atividade_id") ?? "");
  if (!presetId) return;
  await supabase.from("professor_rubrica_presets").delete().eq("id", presetId).eq("professor_id", professor.id);
  if (atividadeId) revalidatePath(`/atividades/${atividadeId}`);
}

/** Regenera apenas 1 questão do rascunho (preservando tópico, tipo e posição). */
export async function regenerarQuestao(_: EstadoQuestao, formData: FormData): Promise<EstadoQuestao> {
  const atividadeId = String(formData.get("atividade_id") ?? "");
  const questaoId = String(formData.get("questao_id") ?? "");
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };

  let supabase;
  let atividade;
  try {
    ({ supabase, atividade } = await atividadeEditavel(atividadeId));
  } catch {
    return { erro: "Esta atividade já foi publicada." };
  }

  const { data: q } = await supabase
    .from("questoes")
    .select("id, tipo, topico_id, trecho_id, enunciado, topico:topicos(id, nome, descricao)")
    .eq("id", questaoId)
    .eq("atividade_id", atividadeId)
    .maybeSingle();
  if (!q || !q.topico) return { erro: "Questão não encontrada." };

  const trechos = atividade.material_id
    ? (
        await supabase
          .from("material_trechos")
          .select("id, ordem, pagina, conteudo")
          .eq("material_id", atividade.material_id)
          .order("ordem")
      ).data ?? []
    : [];

  const relevantes = atividade.material_id && trechos.length
    ? await recuperarTrechosRelevantes(
        supabase,
        atividade.material_id,
        `${q.topico.nome}${q.topico.descricao ? `: ${q.topico.descricao}` : ""}`,
        { limite: 5, fallback: trechos },
      )
    : [];

  let geradas: QuestaoGerada[];
  try {
    geradas = await gerarQuestoesDoTopico(
      q.topico,
      relevantes,
      q.tipo === "multipla_escolha" ? 1 : 0,
      q.tipo === "dissertativa" ? 1 : 0,
      [],
      `Crie uma questão DIFERENTE desta anterior (mude o contexto/números): "${q.enunciado.slice(0, 200)}"`,
    );
  } catch (e) {
    console.error("regenerarQuestao:", e);
    return { erro: "A IA não respondeu agora. Tente novamente em instantes." };
  }
  const nova = geradas[0];
  if (!nova) return { erro: "A IA não gerou uma alternativa válida. Tente novamente." };

  const trechoPorOrdem = new Map(trechos.map((t) => [t.ordem, t.id]));
  const novoTrechoId = (nova.trecho_ordem != null && trechoPorOrdem.get(nova.trecho_ordem)) || q.trecho_id;

  const { error: erroUpd } = await supabase
    .from("questoes")
    .update({
      enunciado: nova.enunciado,
      trecho_id: novoTrechoId,
      rubrica: nova.rubrica ? (nova.rubrica as unknown as Json) : null,
    })
    .eq("id", questaoId)
    .eq("atividade_id", atividadeId);
  if (erroUpd) return { erro: "Não foi possível atualizar a questão." };

  if (q.tipo === "multipla_escolha") {
    await supabase.from("alternativas").delete().eq("questao_id", questaoId);
    const embaralhadas = embaralhar(nova.alternativas);
    const { error: erroAlts } = await supabase.from("alternativas").insert(
      embaralhadas.map((a, j) => ({
        questao_id: questaoId,
        ordem: j,
        texto: a.texto,
        correta: a.correta,
        equivoco: a.correta ? null : a.equivoco!.trim(),
      })),
    );
    if (erroAlts) return { erro: "Erro ao salvar as novas alternativas." };
  }

  revalidatePath(`/atividades/${atividadeId}`);
  return { ok: "Questão regenerada." };
}

/** Adiciona uma questão manual (múltipla escolha ou dissertativa) ao rascunho. */
export async function adicionarQuestaoManual(_: EstadoQuestao, formData: FormData): Promise<EstadoQuestao> {
  const atividadeId = String(formData.get("atividade_id") ?? "");
  let supabase;
  let professor;
  try {
    ({ supabase, professor } = await atividadeEditavel(atividadeId));
  } catch {
    return { erro: "Esta atividade já foi publicada." };
  }

  const tipo = formData.get("tipo") === "dissertativa" ? "dissertativa" : "multipla_escolha";
  const topicoId = String(formData.get("topico_id") ?? "");
  const enunciado = String(formData.get("enunciado") ?? "").trim();

  if (!enunciado) return { erro: "Escreva o enunciado da questão." };
  const { data: topico } = await supabase
    .from("topicos")
    .select("id")
    .eq("id", topicoId)
    .eq("professor_id", professor.id)
    .maybeSingle();
  if (!topico) return { erro: "Selecione um tópico válido." };

  const { data: ultima } = await supabase
    .from("questoes")
    .select("ordem")
    .eq("atividade_id", atividadeId)
    .order("ordem", { ascending: false })
    .limit(1)
    .maybeSingle();
  const proximaOrdem = (ultima?.ordem ?? -1) + 1;

  if (tipo === "dissertativa") {
    const rubrica: RubricaV2 = {
      versao: 2,
      resolucao_modelo: null,
      positivos: [
        { id: "c1", texto: "Resposta correta e completa", rotulo_falha: "Não chegou à resposta correta", peso: 50, aceita_parcial: true },
        { id: "c2", texto: "Justificativa ou desenvolvimento coerente", rotulo_falha: "Faltou desenvolvimento coerente", peso: 50, aceita_parcial: true },
      ],
      penalidades: [],
    };
    const { error } = await supabase.from("questoes").insert({
      atividade_id: atividadeId,
      topico_id: topicoId,
      tipo: "dissertativa",
      ordem: proximaOrdem,
      enunciado,
      rubrica: rubrica as unknown as Json,
    });
    if (error) return { erro: "Não foi possível adicionar a questão dissertativa." };
  } else {
    const corretaIdx = Number(formData.get("correta_idx") ?? 0);
    const alts = [0, 1, 2, 3].map((i) => ({
      texto: String(formData.get(`alt_${i}`) ?? "").trim(),
      correta: i === corretaIdx,
      equivoco: String(formData.get(`eq_${i}`) ?? "").trim(),
    }));
    if (alts.some((a) => !a.texto)) return { erro: "Preencha as 4 alternativas." };
    if (alts.some((a) => !a.correta && !a.equivoco)) {
      return { erro: "Informe o equívoco de cada alternativa errada (distrator)." };
    }
    const questaoId = crypto.randomUUID();
    const { error: eq } = await supabase.from("questoes").insert({
      id: questaoId,
      atividade_id: atividadeId,
      topico_id: topicoId,
      tipo: "multipla_escolha",
      ordem: proximaOrdem,
      enunciado,
      rubrica: null,
    });
    if (eq) return { erro: "Não foi possível criar a questão." };
    const { error: ea } = await supabase.from("alternativas").insert(
      alts.map((a, j) => ({
        questao_id: questaoId,
        ordem: j,
        texto: a.texto,
        correta: a.correta,
        equivoco: a.correta ? null : a.equivoco,
      })),
    );
    if (ea) {
      await supabase.from("questoes").delete().eq("id", questaoId);
      return { erro: "Não foi possível salvar as alternativas." };
    }
  }

  revalidatePath(`/atividades/${atividadeId}`);
  return { ok: "Questão adicionada ao rascunho." };
}

/** Gera 3 respostas simuladas (forte, média, fraca) para calibrar o rigor da rubrica antes de publicar. */
export async function gerarCalibracaoQuestao(
  _: EstadoCalibracao | undefined,
  formData: FormData,
): Promise<EstadoCalibracao> {
  const atividadeId = String(formData.get("atividade_id") ?? "");
  const questaoId = String(formData.get("questao_id") ?? "");
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada." };

  let supabase;
  let atividade;
  try {
    ({ supabase, atividade } = await atividadeEditavel(atividadeId));
  } catch {
    return { erro: "Esta atividade já foi publicada." };
  }

  const { data: q } = await supabase
    .from("questoes")
    .select("id, enunciado, rubrica, trecho:material_trechos(conteudo)")
    .eq("id", questaoId)
    .eq("atividade_id", atividadeId)
    .maybeSingle();
  if (!q) return { erro: "Questão não encontrada." };

  const rubricaJson = String(formData.get("rubrica_json") ?? "").trim();
  const rubrica = rubricaJson ? normalizarRubrica(JSON.parse(rubricaJson)) : normalizarRubrica(q.rubrica);
  const enunciado = String(formData.get("enunciado") ?? "").trim() || q.enunciado;
  const regrasGlobais = normalizarRegrasGlobais(atividade.regras_globais);

  try {
    const simuladas = await gerarExemplosCalibracao(enunciado, rubrica, regrasGlobais, q.trecho?.conteudo ?? "");
    if (!simuladas.length) return { erro: "Não foi possível gerar respostas simuladas agora." };
    return { simuladas };
  } catch (e) {
    console.error("gerarCalibracaoQuestao:", e);
    return { erro: "A IA não respondeu agora (cota ou rede). Tente novamente em instantes." };
  }
}

/** Salva os exemplos calibrados pelo professor dentro da Rubrica v2 da questão (âncoras few-shot). */
export async function salvarCalibracaoQuestao(_: EstadoQuestao, formData: FormData): Promise<EstadoQuestao> {
  const atividadeId = String(formData.get("atividade_id") ?? "");
  const questaoId = String(formData.get("questao_id") ?? "");

  let supabase;
  try {
    ({ supabase } = await atividadeEditavel(atividadeId));
  } catch {
    return { erro: "Esta atividade já foi publicada." };
  }

  const { data: q } = await supabase
    .from("questoes")
    .select("id, rubrica")
    .eq("id", questaoId)
    .eq("atividade_id", atividadeId)
    .maybeSingle();
  if (!q) return { erro: "Questão não encontrada." };

  let exemplos: ExemploCalibracao[];
  try {
    const parsed = JSON.parse(String(formData.get("exemplos_json") ?? "[]")) as ExemploCalibracao[];
    exemplos = parsed
      .filter((e) => e && typeof e.resposta === "string" && e.resposta.trim())
      .slice(0, 3)
      .map((e, i) => ({
        id: e.id || `cal_${i + 1}`,
        nivel: e.nivel === "forte" || e.nivel === "media" || e.nivel === "fraca" ? e.nivel : "media",
        resposta: e.resposta.trim().slice(0, 800),
        nota_esperada: Math.min(10, Math.max(0, Number(e.nota_esperada) || 0)),
        comentario_professor: e.comentario_professor?.trim().slice(0, 240) || undefined,
      }));
  } catch {
    return { erro: "Exemplos de calibração inválidos." };
  }

  const rubricaAtual = normalizarRubrica(q.rubrica);
  const atualizada: RubricaV2 = { ...rubricaAtual, exemplos_calibracao: exemplos };
  const { error } = await supabase
    .from("questoes")
    .update({ rubrica: atualizada as unknown as Json })
    .eq("id", questaoId);
  if (error) return { erro: "Não foi possível salvar a calibração." };

  revalidatePath(`/atividades/${atividadeId}`);
  return { ok: `${exemplos.length} exemplos de calibração salvos na questão.` };
}

/** Duplica uma atividade (rascunho ou publicada) para 1+ turmas paralelas, mantendo mesmas questões. */
export async function duplicarAtividadeParaTurmas(_: EstadoQuestao, formData: FormData): Promise<EstadoQuestao> {
  const { supabase, professor } = await getProfessorAtual();
  const atividadeId = String(formData.get("atividade_id") ?? "");
  const turmaIds = [...new Set(formData.getAll("turma_ids").map(String).filter(Boolean))];
  const publicarAgora = formData.get("publicar_agora") === "true";
  const prazoTexto = String(formData.get("prazo") ?? "");
  const prazo = prazoTexto ? new Date(prazoTexto + "T23:59:59-03:00").toISOString() : null;

  if (!turmaIds.length) return { erro: "Selecione pelo menos uma turma destino." };

  const [{ data: origem }, { data: turmasValidas }] = await Promise.all([
    supabase
      .from("atividades")
      .select(
        `id, titulo, turma_id, material_id, eh_reforco, regras_globais, revisar_antes_liberar,
         questoes(id, topico_id, trecho_id, tipo, ordem, enunciado, rubrica,
           alternativas(ordem, texto, correta, equivoco))`,
      )
      .eq("id", atividadeId)
      .eq("professor_id", professor.id)
      .maybeSingle(),
    supabase.from("turmas").select("id, nome").eq("professor_id", professor.id).in("id", turmaIds),
  ]);

  if (!origem) return { erro: "Atividade original não encontrada." };
  if (!origem.questoes.length) return { erro: "A atividade não tem questões para duplicar." };
  const destinos = (turmasValidas ?? []).filter((t) => t.id !== origem.turma_id);
  if (!destinos.length) return { erro: "Escolha pelo menos uma turma diferente da atual." };

  const questoesOrdenadas = [...origem.questoes].sort((a, b) => a.ordem - b.ordem);
  let criadas = 0;

  for (const destino of destinos) {
    const novaAtivId = crypto.randomUUID();
    const { error: errAtiv } = await supabase.from("atividades").insert({
      id: novaAtivId,
      professor_id: professor.id,
      turma_id: destino.id,
      material_id: origem.material_id,
      titulo: origem.titulo,
      eh_reforco: origem.eh_reforco,
      regras_globais: origem.regras_globais,
      revisar_antes_liberar: origem.revisar_antes_liberar,
      status: publicarAgora ? "publicada" : "rascunho",
      publicada_em: publicarAgora ? new Date().toISOString() : null,
      prazo: publicarAgora ? prazo : null,
    });
    if (errAtiv) {
      console.error("duplicarAtividadeParaTurmas ativ:", errAtiv);
      continue;
    }

    let falhou = false;
    for (const q of questoesOrdenadas) {
      const novaQId = crypto.randomUUID();
      const { error: errQ } = await supabase.from("questoes").insert({
        id: novaQId,
        atividade_id: novaAtivId,
        topico_id: q.topico_id,
        trecho_id: q.trecho_id,
        tipo: q.tipo,
        ordem: q.ordem,
        enunciado: q.enunciado,
        rubrica: q.rubrica,
      });
      if (errQ) {
        falhou = true;
        break;
      }
      if (q.tipo === "multipla_escolha" && q.alternativas.length) {
        const altsOrd = [...q.alternativas].sort((a, b) => a.ordem - b.ordem);
        const { error: errA } = await supabase.from("alternativas").insert(
          altsOrd.map((a) => ({
            questao_id: novaQId,
            ordem: a.ordem,
            texto: a.texto,
            correta: a.correta,
            equivoco: a.equivoco,
          })),
        );
        if (errA) {
          falhou = true;
          break;
        }
      }
    }

    if (falhou) {
      await supabase.from("atividades").delete().eq("id", novaAtivId).eq("professor_id", professor.id);
    } else {
      criadas++;
    }
  }

  if (!criadas) return { erro: "Não foi possível duplicar a atividade para as turmas selecionadas." };
  revalidatePath("/atividades");
  revalidatePath("/");
  return {
    ok: `Atividade ${publicarAgora ? "publicada" : "duplicada em rascunho"} para ${criadas} ${criadas === 1 ? "turma" : "turmas"} (${destinos.map((d) => d.nome).join(", ")}).`,
  };
}

export async function removerQuestao(formData: FormData) {
  const atividadeId = String(formData.get("atividade_id"));
  const { supabase } = await atividadeEditavel(atividadeId);
  await supabase.from("questoes").delete()
    .eq("id", String(formData.get("questao_id"))).eq("atividade_id", atividadeId);
  revalidatePath(`/atividades/${atividadeId}`);
}

export async function publicarAtividade(formData: FormData) {
  const atividadeId = String(formData.get("atividade_id"));
  const { supabase } = await atividadeEditavel(atividadeId);

  const { count } = await supabase.from("questoes").select("*", { count: "exact", head: true })
    .eq("atividade_id", atividadeId);
  if (!count) return;

  const prazoTexto = String(formData.get("prazo") ?? "");
  const prazo = prazoTexto ? new Date(prazoTexto + "T23:59:59-03:00").toISOString() : null;
  await supabase.from("atividades")
    .update({ status: "publicada", publicada_em: new Date().toISOString(), prazo })
    .eq("id", atividadeId);
  revalidatePath(`/atividades/${atividadeId}`);
  revalidatePath("/atividades");
  redirect(`/atividades/${atividadeId}`);
}

export async function excluirAtividade(formData: FormData) {
  const { supabase, professor } = await getProfessorAtual();
  await supabase.from("atividades").delete()
    .eq("id", String(formData.get("atividade_id"))).eq("professor_id", professor.id).eq("status", "rascunho");
  revalidatePath("/atividades");
  redirect("/atividades");
}
