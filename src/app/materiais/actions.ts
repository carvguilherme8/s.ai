"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProfessorAtual } from "@/lib/usuario-atual";
import {
  dividirEmTrechos,
  extrairTextoDoPdf,
  extrairTopicos,
  gerarEmbeddings,
  geminiConfigurado,
} from "@/lib/material-ia";

const MAX_PDF = 15 * 1024 * 1024;

export type EstadoForm = { erro?: string } | undefined;

export async function criarMaterial(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const { supabase, professor } = await getProfessorAtual();

  const titulo = String(formData.get("titulo") ?? "").trim();
  const turmaId = String(formData.get("turma_id") ?? "");
  const textoColado = String(formData.get("texto") ?? "").trim();
  const arquivo = formData.get("pdf");
  const pdf = arquivo instanceof File && arquivo.size > 0 ? arquivo : null;

  if (!titulo) return { erro: "Dê um título ao material." };
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
    const topicos = await extrairTopicos(titulo, texto);
    if (topicos.length) {
      await supabase.from("topicos").insert(
        topicos.map((t) => ({ professor_id: professor.id, material_id: id, nome: t.nome.trim(), descricao: t.descricao })),
      );
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

  revalidatePath("/materiais");
  redirect("/materiais");
}

export async function confirmarTopico(formData: FormData) {
  const { supabase, professor } = await getProfessorAtual();
  const nome = String(formData.get("nome") ?? "").trim();
  const update: { confirmado: boolean; nome?: string } = { confirmado: formData.get("confirmado") !== "false" };
  if (nome) update.nome = nome;
  await supabase.from("topicos").update(update)
    .eq("id", String(formData.get("id"))).eq("professor_id", professor.id);
  revalidatePath("/materiais");
}

export async function confirmarTodos(formData: FormData) {
  const { supabase, professor } = await getProfessorAtual();
  await supabase.from("topicos").update({ confirmado: true })
    .eq("material_id", String(formData.get("material_id"))).eq("professor_id", professor.id);
  revalidatePath("/materiais");
}

export async function removerTopico(formData: FormData) {
  const { supabase, professor } = await getProfessorAtual();
  await supabase.from("topicos").delete()
    .eq("id", String(formData.get("id"))).eq("professor_id", professor.id);
  revalidatePath("/materiais");
}
