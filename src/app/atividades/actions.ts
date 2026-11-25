"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { geminiConfigurado } from "@/lib/material-ia";
import { gerarQuestoesDoTopico, type QuestaoGerada } from "@/lib/questoes-ia";
import { recuperarTrechosRelevantes } from "@/lib/rag";
import { salvarAtividadeGerada } from "@/lib/salvar-atividade";

export type EstadoForm = { erro?: string } | undefined;

const inteiro = (v: FormDataEntryValue | null, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

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

    // Reaproveita um tópico já existente com o mesmo nome (para somar no Diagnóstico) ou cria um novo.
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

  // Uma chamada por tópico, em paralelo, recuperando via pgvector (RAG) os trechos mais relevantes para cada tópico.
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
  const { data } = await supabase.from("atividades").select("id, status")
    .eq("id", atividadeId).eq("professor_id", professor.id).maybeSingle();
  if (!data || data.status !== "rascunho") throw new Error("Atividade não editável.");
  return { supabase, professor };
}

function parseRubrica(texto: string) {
  return texto.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const [criterio, pontos] = l.split("|").map((s) => s.trim());
    return { criterio, pontos: Number(pontos?.replace(",", ".")) || 0 };
  }).filter((r) => r.criterio);
}

export async function salvarQuestao(formData: FormData) {
  const atividadeId = String(formData.get("atividade_id"));
  const questaoId = String(formData.get("questao_id"));
  const { supabase } = await atividadeEditavel(atividadeId);

  const { data: q } = await supabase.from("questoes").select("id, tipo")
    .eq("id", questaoId).eq("atividade_id", atividadeId).maybeSingle();
  if (!q) return;

  const enunciado = String(formData.get("enunciado") ?? "").trim();
  if (!enunciado) return;

  if (q.tipo === "dissertativa") {
    const rubrica = parseRubrica(String(formData.get("rubrica") ?? ""));
    if (!rubrica.length) return;
    await supabase.from("questoes").update({ enunciado, rubrica }).eq("id", questaoId);
  } else {
    const { data: alts } = await supabase.from("alternativas").select("id").eq("questao_id", questaoId);
    const corretaId = String(formData.get("correta"));
    if (!alts?.some((a) => a.id === corretaId)) return;
    const novas = alts.map((a) => ({
      id: a.id,
      texto: String(formData.get(`texto_${a.id}`) ?? "").trim(),
      correta: a.id === corretaId,
      equivoco: String(formData.get(`equivoco_${a.id}`) ?? "").trim(),
    }));
    if (novas.some((a) => !a.texto || (!a.correta && !a.equivoco))) return;
    await supabase.from("questoes").update({ enunciado }).eq("id", questaoId);
    for (const a of novas) {
      await supabase.from("alternativas")
        .update({ texto: a.texto, correta: a.correta, equivoco: a.correta ? null : a.equivoco })
        .eq("id", a.id).eq("questao_id", questaoId);
    }
  }
  revalidatePath(`/atividades/${atividadeId}`);
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
