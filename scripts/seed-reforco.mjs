// Cria uma atividade de REFORÇO fictícia na 2ºA (Segunda Lei), com entregas simuladas que mostram a
// lacuna diminuindo, para a "Evolução por atividade" do Diagnóstico ter o que mostrar. Sem IA.
// Uso:  npm run seed:reforco              (idempotente)
//       npm run seed:reforco -- --reset   (apaga e recria)
// Pré-requisito: npm run seed && npm run seed:diagnostico
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const EMAIL_PROFESSORA = "professora@demo.s-ai.dev";
const TURMA = "2ºA";
const TOPICO = "Segunda Lei (F = m·a)";
const TITULO = "Reforço: Segunda Lei (F = m·a) (demo)";

// A 1ª alternativa é a correta; a ordem exibida é embaralhada.
const QUESTOES = [
  ["Uma força resultante de 20 N age em um corpo de 4 kg. Qual é a aceleração do corpo?", [
    ["5 m/s²"],
    ["80 m/s²", "Multiplica a força pela massa em vez de dividir"],
    ["0,2 m/s²", "Inverte a divisão: massa dividida pela força"],
    ["16 m/s²", "Subtrai a massa da força"],
  ]],
  ["Se a massa de um corpo dobra e a força resultante continua a mesma, a aceleração:", [
    ["cai pela metade"],
    ["dobra", "Inverte a proporcionalidade entre massa e aceleração"],
    ["permanece a mesma", "Acha que a aceleração depende só da força"],
    ["quadruplica", "Confunde proporção direta com relação quadrática"],
  ]],
  ["Um corpo de 3 kg tem aceleração de 4 m/s². Qual é a força resultante sobre ele?", [
    ["12 N"],
    ["0,75 N", "Divide a massa pela aceleração em vez de multiplicar"],
    ["7 N", "Soma a massa com a aceleração"],
    ["1,3 N", "Divide a aceleração pela massa"],
  ]],
  ["A mesma força resultante age sobre um bloco de 2 kg (A) e sobre um de 4 kg (B). Qual deles tem maior aceleração?", [
    ["O bloco A (2 kg)"],
    ["O bloco B (4 kg)", "Acha que mais massa gera mais aceleração"],
    ["Os dois têm a mesma aceleração", "Acha que a aceleração não depende da massa"],
    ["Não dá para saber sem a velocidade", "Confunde aceleração com velocidade"],
  ]],
  ["Qual é a unidade de força no Sistema Internacional?", [
    ["newton (N)"],
    ["quilograma (kg)", "Confunde massa com força"],
    ["metro por segundo ao quadrado (m/s²)", "Confunde aceleração com força"],
    ["joule (J)", "Confunde força com energia"],
  ]],
];

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ok = (r, ctx) => { if (r.error) throw new Error(`${ctx}: ${r.error.message}`); return r.data; };
const dias = (n) => new Date(Date.now() - n * 86400000).toISOString();

async function main() {
  const reset = process.argv.includes("--reset");
  const { data: lista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const prof = lista.users.find((u) => u.email === EMAIL_PROFESSORA);
  if (!prof) throw new Error("Professora demo não encontrada. Rode: npm run seed");

  const turma = ok(await supabase.from("turmas").select("id").eq("professor_id", prof.id).eq("nome", TURMA).single(), "turma");
  const topico = ok(await supabase.from("topicos").select("id, material_id").eq("professor_id", prof.id).eq("nome", TOPICO).not("material_id", "is", null).limit(1).single(), "tópico");

  const { data: existente } = await supabase.from("atividades").select("id").eq("professor_id", prof.id).eq("turma_id", turma.id).eq("titulo", TITULO).maybeSingle();
  if (existente && !reset) { console.log("Reforço demo já existe. Use --reset para recriar."); return; }
  if (existente) { await supabase.from("atividades").delete().eq("id", existente.id); console.log("Reforço anterior removido."); }

  const trecho = (await supabase.from("material_trechos").select("id").eq("material_id", topico.material_id).eq("pagina", 2).limit(1).maybeSingle()).data;

  const atividade = ok(await supabase.from("atividades").insert({
    professor_id: prof.id, turma_id: turma.id, material_id: topico.material_id,
    titulo: TITULO, status: "publicada", publicada_em: dias(3),
  }).select().single(), "atividade");

  const prng = mulberry32(77);
  const questoes = [];
  for (const [i, [enunciado, alts]] of QUESTOES.entries()) {
    const q = ok(await supabase.from("questoes").insert({
      atividade_id: atividade.id, topico_id: topico.id, trecho_id: trecho?.id ?? null, tipo: "multipla_escolha", ordem: i, enunciado,
    }).select().single(), "questão");
    const idx = [0, 1, 2, 3];
    for (let k = 3; k > 0; k--) { const j = Math.floor(prng() * (k + 1)); [idx[k], idx[j]] = [idx[j], idx[k]]; }
    const salvas = ok(await supabase.from("alternativas").insert(
      alts.map(([texto, equivoco], k) => ({ questao_id: q.id, ordem: idx[k], texto, correta: k === 0, equivoco: k === 0 ? null : equivoco })),
    ).select(), "alternativas");
    questoes.push({ id: q.id, alternativas: salvas });
  }

  // Alunos fictícios da turma (não inclui contas de teste)
  const alunos = ok(await supabase.from("profiles").select("id, nome").eq("turma_id", turma.id).eq("papel", "aluno").like("nome", "%(fictício)"), "alunos");
  const rand = mulberry32(4242);
  let entregas = 0, respostas = 0, semEntrega = 0;
  for (const aluno of alunos) {
    if (rand() < 0.14) { semEntrega++; continue; } // uns poucos não entregam
    const habilidade = 0.25 + rand() * 0.7;
    const entrega = ok(await supabase.from("entregas").insert({
      atividade_id: atividade.id, aluno_id: aluno.id, enviada_em: dias(1 + rand() * 1.5),
    }).select().single(), "entrega");
    entregas++;
    const linhas = questoes.map((q) => {
      const p = Math.min(0.96, Math.max(0.1, 0.68 + (habilidade - 0.6) * 0.55 + (rand() - 0.5) * 0.2));
      const acertou = rand() < p;
      const certa = q.alternativas.find((a) => a.correta);
      const erradas = q.alternativas.filter((a) => !a.correta);
      const r = rand();
      const escolhida = acertou ? certa : r < 0.55 ? erradas[0] : r < 0.85 ? erradas[1] : erradas[2];
      return {
        entrega_id: entrega.id, questao_id: q.id, alternativa_id: escolhida.id,
        nota_ia: acertou ? 1 : 0, correcao: { correta: acertou, equivoco: acertou ? null : escolhida.equivoco },
      };
    });
    ok(await supabase.from("respostas").insert(linhas), "respostas");
    respostas += linhas.length;
  }
  console.log(`Reforço criado na ${TURMA}: ${entregas} entregas (${semEntrega} alunos sem entrega), ${respostas} respostas.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
