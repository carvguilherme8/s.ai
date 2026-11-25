"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { geminiConfigurado } from "@/lib/material-ia";
import { gerarQuestoesDoTopico, type QuestaoGerada } from "@/lib/questoes-ia";
import { salvarAtividadeGerada } from "@/lib/salvar-atividade";

export type EstadoForm = { erro?: string } | undefined;

const inteiro = (v: FormDataEntryValue | null, min: number, max: number, padrao: number) => {
  const n = Number(v);
  return Number.isInteger(n) ? Math.min(max, Math.max(min, n)) : padrao;
};

export async function gerarAtividade(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const { supabase, professor } = await getProfessorAtual();

  const materialId = String(formData.get("material_id") ?? "");
  const turmaId = String(formData.get("turma_id") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  const nMC = inteiro(formData.get("mc_por_topico"), 0, 5, 3);
  const nDiss = inteiro(formData.get("dissertativas"), 0, 3, 1);

  if (!titulo) return { erro: "Dê um título à atividade." };
  if (nMC + nDiss === 0) return { erro: "Peça pelo menos uma questão." };
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada no .env.local." };

  const [{ data: material }, { data: turma }] = await Promise.all([
    supabase.from("materiais").select("id, titulo").eq("id", materialId).eq("professor_id", professor.id).maybeSingle(),
    supabase.from("turmas").select("id").eq("id", turmaId).eq("professor_id", professor.id).maybeSingle(),
  ]);
  if (!material) return { erro: "Material inválido." };
  if (!turma) return { erro: "Turma inválida." };

  const [{ data: topicos }, { data: trechos }] = await Promise.all([
    supabase.from("topicos").select("id, nome, descricao")
      .eq("material_id", materialId).eq("professor_id", professor.id).eq("confirmado", true).order("created_at"),
    supabase.from("material_trechos").select("id, ordem, pagina, conteudo").eq("material_id", materialId).order("ordem"),
  ]);
  if (!topicos?.length) return { erro: "Confirme ao menos um tópico deste material antes de gerar questões." };
  if (!trechos?.length) return { erro: "Este material não tem trechos indexados. Envie-o novamente." };

  // Uma chamada por tópico, em paralelo. Dissertativas ficam nos primeiros tópicos.
  const resultados = await Promise.allSettled(
    topicos.map((t, i) =>
      gerarQuestoesDoTopico(t, trechos, nMC, i < nDiss ? 1 : 0),
    ),
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
