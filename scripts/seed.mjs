// Popula o Supabase com dados fictícios (sem dados pessoais reais).
// Uso: npm run seed   (lê .env.local; idempotente)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const SENHA = "demo1234";
const DOMINIO = "demo.s-ai.dev";

async function usuario(email, metadata) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: SENHA, email_confirm: true, user_metadata: metadata,
  });
  if (!error) return data.user.id;
  if (!/already/i.test(error.message)) throw error;
  const { data: lista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  return lista.users.find((u) => u.email === email).id;
}

async function main() {
  const professorId = await usuario(`professora@${DOMINIO}`, { papel: "professor", nome: "Profa. Demo" });

  const turmas = [];
  for (const nome of ["2ºA", "3ºB"]) {
    let { data: t } = await supabase.from("turmas").select().eq("professor_id", professorId).eq("nome", nome).maybeSingle();
    if (!t) ({ data: t } = await supabase.from("turmas").insert({ nome, professor_id: professorId }).select().single());
    turmas.push(t);
  }

  const alunos = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe"];
  for (const [i, nome] of alunos.entries()) {
    const turma = turmas[i % 2];
    await usuario(`${nome.toLowerCase()}@${DOMINIO}`, { papel: "aluno", nome: `${nome} (fictício)`, codigo_convite: turma.codigo_convite });
  }

  const { count } = await supabase.from("materiais").select("*", { count: "exact", head: true }).eq("professor_id", professorId);
  if (!count) {
    const { data: material } = await supabase.from("materiais").insert({
      professor_id: professorId, turma_id: turmas[0].id, titulo: "Funções do 1º grau", tipo: "texto",
      conteudo_texto: "Uma função do 1º grau tem a forma f(x) = ax + b, com a ≠ 0. O coeficiente a indica a inclinação da reta...",
    }).select().single();
    await supabase.from("topicos").insert(
      ["Coeficiente angular", "Coeficiente linear", "Raiz da função"].map((nome) => ({
        professor_id: professorId, material_id: material.id, nome, confirmado: true,
      })),
    );
  }

  console.log(`Seed ok. Login de teste: professora@${DOMINIO} / ${SENHA}`);
  console.log("Códigos de convite:", turmas.map((t) => `${t.nome}=${t.codigo_convite}`).join(", "));
}

main().catch((e) => { console.error(e); process.exit(1); });
