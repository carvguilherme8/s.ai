"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/usuario-atual";
import { disciplinaValida } from "@/lib/disciplinas";
import {
  dividirEmTrechos,
  extrairTextoDoPdf,
  extrairTopicos,
  gerarEmbeddings,
  geminiConfigurado,
} from "@/lib/material-ia";

const MAX_PDF = 15 * 1024 * 1024;
const MAX_TITULO = 120;
const MAX_TOPICO = 100;
const MAX_DESCRICAO = 240;

export type EstadoForm = { erro?: string } | undefined;
export type EstadoAcao = { erro?: string; ok?: string } | undefined;

const limparTexto = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\s+/g, " ").trim();

function revalidarTudo(materialId?: string) {
  revalidatePath("/materiais");
  if (materialId) revalidatePath(`/materiais/${materialId}`);
  revalidatePath("/");
  revalidatePath("/atividades");
  revalidatePath("/diagnostico");
  revalidatePath("/turmas");
}

export async function criarMaterial(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const { supabase, professor } = await getProfessorAtual();

  const titulo = limparTexto(formData.get("titulo"));
  const turmaId = String(formData.get("turma_id") ?? "");
  const textoColado = String(formData.get("texto") ?? "").trim();
  const disciplinaEscolhida = disciplinaValida(formData.get("disciplina")); // vazio = a IA sugere
  const arquivo = formData.get("pdf");
  const pdf = arquivo instanceof File && arquivo.size > 0 ? arquivo : null;

  if (!titulo) return { erro: "Dê um título ao material." };
  if (titulo.length > MAX_TITULO) return { erro: `O título pode ter no máximo ${MAX_TITULO} caracteres.` };
  if (!pdf && textoColado.length < 50) return { erro: "Cole um texto (mín. 50 caracteres) ou envie um PDF." };
  if (pdf && pdf.type !== "application/pdf") return { erro: "O arquivo precisa ser um PDF." };
  if (pdf && pdf.size > MAX_PDF) return { erro: "PDF acima de 15 MB." };
  if (!geminiConfigurado()) return { erro: "GEMINI_API_KEY não configurada no .env.local." };

  // A turma precisa ser deste professor (o client admin ignora RLS).
  const { data: turma } = await supabase
    .from("turmas").select("id").eq("id", turmaId).eq("professor_id", professor.id).maybeSingle();
  if (!turma) return { erro: "Turma inválida." };

  const id = crypto.randomUUID();
  let storagePath: string | null = null;
  let texto = textoColado;

  try {
    if (pdf) {
      const bytes = Buffer.from(await pdf.arrayBuffer());
      storagePath = `${professor.id}/${id}.pdf`;
      const { error } = await supabase.storage
        .from("materiais").upload(storagePath, bytes, { contentType: "application/pdf" });
      if (error) throw error;
      texto = await extrairTextoDoPdf(bytes);
      if (texto.length < 50) {
        await supabase.storage.from("materiais").remove([storagePath]);
        return { erro: "Não consegui extrair texto do PDF (PDFs escaneados não são suportados)." };
      }
    }

    const { error: erroMaterial } = await supabase.from("materiais").insert({
      id,
      professor_id: professor.id,
      turma_id: turmaId,
      titulo,
      tipo: pdf ? "pdf" : "texto",
      storage_path: storagePath,
      conteudo_texto: texto,
    });
    if (erroMaterial) throw erroMaterial;

    // Tópicos sugeridos (o professor confirma depois).
    const { disciplina: sugerida, topicos } = await extrairTopicos(titulo, texto);
    if (topicos.length) {
      await supabase.from("topicos").insert(
        topicos.map((t) => ({ professor_id: professor.id, material_id: id, nome: t.nome.trim(), descricao: t.descricao })),
      );
    }
    // Disciplina: a que a professora escolheu; se deixou em branco, a sugestão da IA. Falha aqui não bloqueia.
    const disciplina = disciplinaEscolhida ?? sugerida;
    if (disciplina) {
      const { error: erroDisc } = await supabase.from("materiais").update({ disciplina }).eq("id", id);
      if (erroDisc) console.error("disciplina do material:", erroDisc.message);
    }

    // Trechos + embeddings para a geração de Questões e o Feedback. Falha aqui não bloqueia o fluxo.
    try {
      const trechos = dividirEmTrechos(texto);
      const vetores = await gerarEmbeddings(trechos.map((t) => t.conteudo));
      await supabase.from("material_trechos").insert(
        trechos.map((t, i) => ({
          material_id: id,
          ordem: i,
          pagina: t.pagina,
          conteudo: t.conteudo,
          embedding: vetores[i] ? (JSON.stringify(vetores[i]) as unknown as string) : null,
        })),
      );
    } catch (e) {
      console.error("Embeddings falharam:", e);
    }
  } catch (e) {
    console.error("criarMaterial:", e);
    if (storagePath) await supabase.storage.from("materiais").remove([storagePath]);
    await supabase.from("materiais").delete().eq("id", id).eq("professor_id", professor.id);
    return { erro: "Não foi possível processar o material. Tente novamente." };
  }

  revalidarTudo(id);
  redirect("/materiais");
}

/** Edita título, turma e disciplina de um Material. */
export async function editarMaterial(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const materialId = String(formData.get("material_id") ?? "");
  const titulo = limparTexto(formData.get("titulo"));
  const turmaId = String(formData.get("turma_id") ?? "");
  const disciplina = disciplinaValida(formData.get("disciplina")); // vazio = sem disciplina

  if (!materialId) return { erro: "Material inválido." };
  if (!titulo) return { erro: "Informe o título do material." };
  if (titulo.length > MAX_TITULO) return { erro: `O título pode ter no máximo ${MAX_TITULO} caracteres.` };

  const [{ data: material }, { data: turma }] = await Promise.all([
    supabase.from("materiais").select("id").eq("id", materialId).eq("professor_id", professor.id).maybeSingle(),
    supabase.from("turmas").select("id").eq("id", turmaId).eq("professor_id", professor.id).maybeSingle(),
  ]);
  if (!material) return { erro: "Material não encontrado." };
  if (!turma) return { erro: "Turma inválida." };

  const { error } = await supabase
    .from("materiais")
    .update({ titulo, turma_id: turmaId, disciplina })
    .eq("id", materialId)
    .eq("professor_id", professor.id);
  if (error) {
    console.error("editarMaterial:", error);
    return { erro: "Não foi possível salvar as alterações." };
  }

  revalidarTudo(materialId);
  return { ok: "Material atualizado." };
}

/** Exclui um Material, seu PDF no Storage e os tópicos dele que ainda não têm questões vinculadas. */
export async function excluirMaterial(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const materialId = String(formData.get("material_id") ?? "");
  if (!materialId) return { erro: "Material inválido." };

  const { data: material } = await supabase
    .from("materiais")
    .select("id, titulo, storage_path")
    .eq("id", materialId)
    .eq("professor_id", professor.id)
    .maybeSingle();
  if (!material) return { erro: "Material não encontrado." };

  // Remove tópicos deste material que não têm questões (os usados em questões ficam preservados com material_id = null).
  const { data: topicos } = await supabase
    .from("topicos")
    .select("id, questoes(id)")
    .eq("material_id", materialId)
    .eq("professor_id", professor.id);
  const topicosSemQuestoes = (topicos ?? []).filter((t) => t.questoes.length === 0).map((t) => t.id);
  if (topicosSemQuestoes.length) {
    await supabase.from("topicos").delete().in("id", topicosSemQuestoes).eq("professor_id", professor.id);
  }

  const { error } = await supabase
    .from("materiais")
    .delete()
    .eq("id", materialId)
    .eq("professor_id", professor.id);
  if (error) {
    console.error("excluirMaterial:", error);
    return { erro: "Não foi possível excluir o material." };
  }

  if (material.storage_path) {
    const { error: erroStorage } = await supabase.storage.from("materiais").remove([material.storage_path]);
    if (erroStorage) console.error("excluirMaterial storage:", erroStorage);
  }

  revalidarTudo();
  return { ok: `Material "${material.titulo}" excluído.` };
}

/** Cria um novo Tópico manualmente (já confirmado) ligado a um Material. */
export async function criarTopico(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const materialId = String(formData.get("material_id") ?? "");
  const nome = limparTexto(formData.get("nome"));
  const descricao = limparTexto(formData.get("descricao")) || null;

  if (!materialId) return { erro: "Material inválido." };
  if (!nome) return { erro: "Informe o nome do tópico." };
  if (nome.length > MAX_TOPICO) return { erro: `O nome do tópico pode ter no máximo ${MAX_TOPICO} caracteres.` };
  if (descricao && descricao.length > MAX_DESCRICAO) {
    return { erro: `A descrição pode ter no máximo ${MAX_DESCRICAO} caracteres.` };
  }

  const [{ data: material }, { data: existentes }] = await Promise.all([
    supabase.from("materiais").select("id").eq("id", materialId).eq("professor_id", professor.id).maybeSingle(),
    supabase.from("topicos").select("id, nome").eq("material_id", materialId).eq("professor_id", professor.id),
  ]);
  if (!material) return { erro: "Material não encontrado." };
  if (existentes?.some((t) => t.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
    return { erro: "Este material já tem um tópico com esse nome." };
  }

  const { error } = await supabase.from("topicos").insert({
    professor_id: professor.id,
    material_id: materialId,
    nome,
    descricao,
    confirmado: true,
  });
  if (error) {
    console.error("criarTopico:", error);
    return { erro: "Não foi possível adicionar o tópico." };
  }

  revalidarTudo(materialId);
  return { ok: `Tópico "${nome}" adicionado.` };
}

export async function confirmarTopico(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const id = String(formData.get("id") ?? "");
  const nome = limparTexto(formData.get("nome"));
  const confirmado = formData.get("confirmado") !== "false";

  if (!id) return { erro: "Tópico inválido." };
  if (!nome) return { erro: "O nome do tópico não pode ficar vazio." };
  if (nome.length > MAX_TOPICO) return { erro: `O nome do tópico pode ter no máximo ${MAX_TOPICO} caracteres.` };

  const { error } = await supabase
    .from("topicos")
    .update({ confirmado, nome })
    .eq("id", id)
    .eq("professor_id", professor.id);
  if (error) {
    console.error("confirmarTopico:", error);
    return { erro: "Não foi possível salvar o tópico." };
  }

  revalidarTudo();
  return { ok: "Tópico salvo." };
}

export async function confirmarTodos(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const materialId = String(formData.get("material_id") ?? "");
  if (!materialId) return { erro: "Material inválido." };

  const { error } = await supabase
    .from("topicos")
    .update({ confirmado: true })
    .eq("material_id", materialId)
    .eq("professor_id", professor.id);
  if (error) {
    console.error("confirmarTodos:", error);
    return { erro: "Não foi possível confirmar os tópicos." };
  }

  revalidarTudo(materialId);
  return { ok: "Todos os tópicos foram confirmados." };
}

export async function removerTopico(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Tópico inválido." };

  const { count } = await supabase
    .from("questoes")
    .select("*", { count: "exact", head: true })
    .eq("topico_id", id);
  if ((count ?? 0) > 0) {
    return { erro: "Este tópico já é usado em questões de atividades e não pode ser removido." };
  }

  const { error } = await supabase
    .from("topicos")
    .delete()
    .eq("id", id)
    .eq("professor_id", professor.id);
  if (error) {
    if (error.code === "23503") {
      return { erro: "Este tópico já é usado em questões de atividades e não pode ser removido." };
    }
    console.error("removerTopico:", error);
    return { erro: "Não foi possível remover o tópico." };
  }

  revalidarTudo();
  return { ok: "Tópico removido." };
}
