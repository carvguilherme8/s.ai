"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoForm = { erro?: string } | undefined;

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(form.get("email")),
    password: String(form.get("senha")),
  });
  if (error) return { erro: "E-mail ou senha incorretos." };
  redirect("/painel");
}

export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const papel = form.get("papel") === "professor" ? "professor" : "aluno";
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: String(form.get("email")),
    password: String(form.get("senha")),
    options: {
      data: {
        papel,
        nome: String(form.get("nome") ?? ""),
        codigo_convite: papel === "aluno" ? String(form.get("codigo") ?? "") : undefined,
      },
    },
  });
  if (error) {
    if (papel === "aluno" && /database error/i.test(error.message)) {
      return { erro: "Código de convite inválido." };
    }
    return { erro: error.message };
  }
  redirect("/painel");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
