"use server";

import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/server";

export async function criarTurma(form: FormData) {
  const sessao = await getSessao();
  if (!sessao || sessao.profile.papel !== "professor") return;
  const nome = String(form.get("nome") ?? "").trim();
  if (!nome) return;
  await sessao.supabase.from("turmas").insert({ nome, professor_id: sessao.user.id });
  revalidatePath("/painel");
}
