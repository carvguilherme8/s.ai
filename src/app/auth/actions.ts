"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type EstadoForm = { erro?: string; valores?: { nome?: string; codigo?: string; email?: string } } | undefined;

export async function entrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const supabase = await createClient();
  const email = String(form.get("email") ?? "").trim();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: String(form.get("senha") ?? "") });
  if (error || !data.user) return { erro: "E-mail ou senha incorretos.", valores: { email } };
  const { data: perfil } = await supabase.from("profiles").select("papel").eq("id", data.user.id).maybeSingle();
  redirect(perfil?.papel === "professor" ? "/" : "/aluno");
}

/** Cadastro de ALUNO com código de convite (a professora usa o login simulado). */
export async function cadastrar(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = String(form.get("email") ?? "").trim();
  const senha = String(form.get("senha") ?? "");
  const nome = String(form.get("nome") ?? "").trim();
  const codigo = String(form.get("codigo") ?? "").trim();
  const valores = { nome, codigo, email };
  if (!nome) return { erro: "Informe seu nome.", valores };
  if (senha.length < 6) return { erro: "A senha precisa ter ao menos 6 caracteres.", valores };

  // Cria já confirmado (sem e-mail de verificação). O trigger handle_new_user valida o código.
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { papel: "aluno", nome, codigo_convite: codigo },
  });
  if (error) {
    if (/database error/i.test(error.message)) return { erro: "Código de convite inválido.", valores };
    if (/already|registered/i.test(error.message)) return { erro: "Este e-mail já está cadastrado.", valores };
    return { erro: "Não foi possível criar a conta.", valores };
  }

  const supabase = await createClient();
  const { error: erroLogin } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (erroLogin) redirect("/entrar");
  redirect("/aluno");
}

export async function sair() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
