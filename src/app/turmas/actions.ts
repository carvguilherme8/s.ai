"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getProfessorAtual } from "@/lib/usuario-atual";

export type EstadoAcao = { erro?: string; ok?: string } | undefined;

const MAX_NOME = 60;

function limparNome(bruto: FormDataEntryValue | null) {
  return String(bruto ?? "").replace(/\s+/g, " ").trim();
}

function gerarCodigoConvite() {
  return randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
}

function revalidarTudo() {
  revalidatePath("/turmas");
  revalidatePath("/");
  revalidatePath("/materiais");
  revalidatePath("/atividades");
  revalidatePath("/diagnostico");
}

export async function criarTurma(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const nome = limparNome(formData.get("nome"));

  if (!nome) return { erro: "Informe o nome da turma." };
  if (nome.length > MAX_NOME) return { erro: `O nome da turma pode ter no máximo ${MAX_NOME} caracteres.` };

  const { data: existentes } = await supabase
    .from("turmas")
    .select("id, nome")
    .eq("professor_id", professor.id);
  if (existentes?.some((t) => t.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
    return { erro: "Você já tem uma turma com esse nome." };
  }

  const { error } = await supabase.from("turmas").insert({
    professor_id: professor.id,
    nome,
  });
  if (error) {
    if (error.code === "23505") return { erro: "Você já tem uma turma com esse nome." };
    console.error("criarTurma:", error);
    return { erro: "Não foi possível criar a turma. Tente novamente." };
  }

  revalidarTudo();
  return { ok: `Turma "${nome}" criada.` };
}

export async function renomearTurma(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const turmaId = String(formData.get("turma_id") ?? "");
  const nome = limparNome(formData.get("nome"));

  if (!turmaId) return { erro: "Turma inválida." };
  if (!nome) return { erro: "Informe o nome da turma." };
  if (nome.length > MAX_NOME) return { erro: `O nome da turma pode ter no máximo ${MAX_NOME} caracteres.` };

  const { data: turmas } = await supabase
    .from("turmas")
    .select("id, nome")
    .eq("professor_id", professor.id);
  const atual = turmas?.find((t) => t.id === turmaId);
  if (!atual) return { erro: "Turma não encontrada." };

  if (atual.nome === nome) return { ok: "Nome mantido." };
  if (turmas?.some((t) => t.id !== turmaId && t.nome.toLocaleLowerCase("pt-BR") === nome.toLocaleLowerCase("pt-BR"))) {
    return { erro: "Você já tem outra turma com esse nome." };
  }

  const { error } = await supabase
    .from("turmas")
    .update({ nome })
    .eq("id", turmaId)
    .eq("professor_id", professor.id);
  if (error) {
    if (error.code === "23505") return { erro: "Você já tem outra turma com esse nome." };
    console.error("renomearTurma:", error);
    return { erro: "Não foi possível renomear a turma." };
  }

  revalidarTudo();
  return { ok: "Nome atualizado." };
}

export async function regenerarCodigo(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const turmaId = String(formData.get("turma_id") ?? "");
  if (!turmaId) return { erro: "Turma inválida." };

  const { data: turma } = await supabase
    .from("turmas")
    .select("id, codigo_convite")
    .eq("id", turmaId)
    .eq("professor_id", professor.id)
    .maybeSingle();
  if (!turma) return { erro: "Turma não encontrada." };

  // Tenta algumas vezes em caso improvável de colisão na constraint unique(codigo_convite).
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const novoCodigo = gerarCodigoConvite();
    if (novoCodigo === turma.codigo_convite) continue;

    const { error } = await supabase
      .from("turmas")
      .update({ codigo_convite: novoCodigo })
      .eq("id", turmaId)
      .eq("professor_id", professor.id);

    if (!error) {
      revalidarTudo();
      return { ok: `Novo código gerado: ${novoCodigo}.` };
    }
    if (error.code !== "23505") {
      console.error("regenerarCodigo:", error);
      return { erro: "Não foi possível gerar um novo código." };
    }
  }

  return { erro: "Não foi possível gerar um novo código agora. Tente novamente." };
}

export async function excluirTurma(_: EstadoAcao, formData: FormData): Promise<EstadoAcao> {
  const { supabase, professor } = await getProfessorAtual();
  const turmaId = String(formData.get("turma_id") ?? "");
  if (!turmaId) return { erro: "Turma inválida." };

  const { data: turma } = await supabase
    .from("turmas")
    .select("id, nome")
    .eq("id", turmaId)
    .eq("professor_id", professor.id)
    .maybeSingle();
  if (!turma) return { erro: "Turma não encontrada." };

  // No schema, cada Aluno pertence obrigatoriamente a uma Turma (constraint aluno_tem_turma).
  const { count: totalAlunos } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("turma_id", turmaId)
    .eq("papel", "aluno");
  if ((totalAlunos ?? 0) > 0) {
    return { erro: "Não é possível excluir uma turma que já tem alunos cadastrados." };
  }

  // Remove eventuais PDFs no Storage vinculados a materiais desta turma antes do cascade.
  const { data: pdfs } = await supabase
    .from("materiais")
    .select("storage_path")
    .eq("turma_id", turmaId)
    .eq("professor_id", professor.id)
    .not("storage_path", "is", null);
  const caminhos = (pdfs ?? []).map((p) => p.storage_path).filter((c): c is string => !!c);

  const { error } = await supabase
    .from("turmas")
    .delete()
    .eq("id", turmaId)
    .eq("professor_id", professor.id);
  if (error) {
    // Um aluno pode ter entrado na turma entre a contagem e o delete: a constraint aluno_tem_turma recusa.
    if (error.code === "23514" || error.code === "23503") {
      return { erro: "Um aluno acabou de entrar nesta turma, então ela não pode mais ser excluída." };
    }
    console.error("excluirTurma:", error);
    return { erro: "Não foi possível excluir a turma." };
  }

  if (caminhos.length) {
    const { error: erroStorage } = await supabase.storage.from("materiais").remove(caminhos);
    if (erroStorage) console.error("excluirTurma storage:", erroStorage);
  }

  revalidarTudo();
  return { ok: `Turma "${turma.nome}" excluída.` };
}
