// Dá uma segunda disciplina à demonstração: Matemática (função afim), com material em 3 páginas, uma
// lista de 9 questões e entregas simuladas com lacunas diferentes em cada turma. Também define a
// disciplina (Física) dos materiais de Newton. Sem IA.
// Uso:  npm run seed:matematica              (idempotente)
//       npm run seed:matematica -- --reset   (apaga a lista e recria)
// Pré-requisitos: migration 20261125120000 aplicada; npm run seed; npm run seed:diagnostico
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const EMAIL_PROFESSORA = "professora@demo.s-ai.dev";
const MATERIAL = "Funções do 1º grau";
const TITULO = "Funções do 1º grau — Lista 1 (demo)";

const PAGINAS = [
  "Coeficiente angular. Uma função do 1º grau tem a forma f(x) = ax + b, com a diferente de zero. O número a é o coeficiente angular: ele indica a inclinação da reta. Se a é positivo, a função cresce; se a é negativo, decresce. Quanto maior o valor absoluto de a, mais inclinada é a reta.",
  "Coeficiente linear. O número b é o coeficiente linear: é o valor de f(0), isto é, o ponto (0, b) em que a reta corta o eixo y. Aumentar b, mantendo a, desloca a reta para cima sem mudar sua inclinação: o novo gráfico é paralelo ao anterior.",
  "Raiz da função. A raiz é o valor de x para o qual f(x) = 0. Em f(x) = ax + b, a raiz é x = -b/a, e o gráfico corta o eixo x no ponto (-b/a, 0). Para achar a raiz, iguale a função a zero e isole x, dividindo pelo coeficiente angular.",
];

// A 1ª alternativa é a correta; a ordem exibida é embaralhada. [tópico, enunciado, alternativas]
const QUESTOES = [
  ["Coeficiente angular", "Na função f(x) = 3x + 5, o coeficiente angular vale:", [
    ["3"], ["5", "Confunde coeficiente angular com coeficiente linear"], ["−3", "Troca o sinal do coeficiente"], ["8", "Soma os coeficientes"],
  ]],
  ["Coeficiente angular", "A reta de uma função do 1º grau é decrescente quando o coeficiente angular é:", [
    ["negativo"], ["positivo", "Associa reta decrescente a coeficiente positivo"], ["igual a zero", "Confunde coeficiente zero com reta decrescente"], ["maior que 1", "Confunde inclinação com valor maior que 1"],
  ]],
  ["Coeficiente angular", "Qual das funções tem a reta mais inclinada, crescendo mais rápido?", [
    ["f(x) = 5x + 1"], ["f(x) = x + 9", "Acha que o maior termo independente dá mais inclinação"], ["f(x) = −5x + 1", "Confunde inclinação com sentido de crescimento"], ["f(x) = 2x + 8", "Compara o termo independente em vez do coeficiente angular"],
  ]],
  ["Coeficiente linear", "Na função f(x) = 2x − 7, o gráfico corta o eixo y no ponto:", [
    ["(0, −7)"], ["(−7, 0)", "Inverte as coordenadas do ponto"], ["(0, 2)", "Confunde coeficiente linear com coeficiente angular"], ["(7, 0)", "Troca o sinal e as coordenadas"],
  ]],
  ["Coeficiente linear", "O valor de f(0) para f(x) = −3x + 6 é:", [
    ["6"], ["0", "Acha que f(0) é sempre zero"], ["−3", "Confunde f(0) com o coeficiente angular"], ["3", "Erra o sinal ao substituir"],
  ]],
  ["Coeficiente linear", "Aumentar o coeficiente linear de uma reta, mantendo o angular, faz o gráfico:", [
    ["subir, ficando paralelo ao anterior"], ["ficar mais inclinado", "Confunde coeficiente linear com inclinação"], ["girar em torno da origem", "Acha que o coeficiente linear gira a reta"], ["descer", "Inverte o efeito do coeficiente linear"],
  ]],
  ["Raiz da função", "A raiz da função f(x) = 2x − 8 é:", [
    ["4"], ["−4", "Erra o sinal ao isolar x"], ["8", "Esquece de dividir pelo coeficiente angular"], ["−8", "Esquece de dividir e erra o sinal"],
  ]],
  ["Raiz da função", "A raiz de uma função do 1º grau é o valor de x em que:", [
    ["f(x) = 0"], ["x = 0", "Confunde raiz com o valor de f(0)"], ["f(x) = 1", "Confunde raiz com f(x) = 1"], ["o coeficiente angular é nulo", "Confunde raiz com coeficiente angular nulo"],
  ]],
  ["Raiz da função", "O gráfico de f(x) = −x + 3 corta o eixo x em:", [
    ["x = 3"], ["x = −3", "Erra o sinal ao isolar x"], ["x = 0", "Confunde a interseção com o eixo x e com o eixo y"], ["x = 1/3", "Inverte a divisão ao isolar x"],
  ]],
];

// Probabilidade-base de acerto por turma e tópico (a ordem segue os 3 tópicos): lacunas diferentes por turma.
const BASE = {
  "2ºA": { "Coeficiente angular": 0.82, "Coeficiente linear": 0.78, "Raiz da função": 0.4 },
  "3ºB": { "Coeficiente angular": 0.5, "Coeficiente linear": 0.8, "Raiz da função": 0.72 },
};

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

  const { error: semColuna } = await supabase.from("materiais").select("disciplina").limit(1);
  if (semColuna) throw new Error("A coluna materiais.disciplina não existe. Aplique antes a migration 20261125120000_disciplina_em_materiais.sql.");

  const { data: lista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const prof = lista.users.find((u) => u.email === EMAIL_PROFESSORA);
  if (!prof) throw new Error("Professora demo não encontrada. Rode: npm run seed");

  // Disciplinas dos materiais de demonstração
  await supabase.from("materiais").update({ disciplina: "Física" }).eq("professor_id", prof.id).in("titulo", ["Leis de Newton (demo)", "leis de newton"]);
  await supabase.from("materiais").update({ disciplina: "Matemática" }).eq("professor_id", prof.id).eq("titulo", MATERIAL);

  const material = ok(await supabase.from("materiais").select("id").eq("professor_id", prof.id).eq("titulo", MATERIAL).limit(1).single(), "material");
  const topicos = ok(await supabase.from("topicos").select("id, nome").eq("material_id", material.id), "tópicos");
  const topicoId = Object.fromEntries(topicos.map((t) => [t.nome, t.id]));
  for (const nome of ["Coeficiente angular", "Coeficiente linear", "Raiz da função"]) if (!topicoId[nome]) throw new Error(`Tópico "${nome}" não encontrado. Rode: npm run seed`);

  const turmas = ok(await supabase.from("turmas").select("id, nome").eq("professor_id", prof.id), "turmas");
  const { data: existentes } = await supabase.from("atividades").select("id").eq("professor_id", prof.id).eq("titulo", TITULO);
  if (existentes?.length && !reset) { console.log("A lista de Matemática já existe. Use --reset para recriar."); return; }
  if (existentes?.length) { await supabase.from("atividades").delete().in("id", existentes.map((a) => a.id)); console.log("Lista anterior removida."); }

  // Material com texto de verdade e 3 trechos (um por página), para o aluno ler e para os links por página
  await supabase.from("materiais").update({
    conteudo_texto: PAGINAS.map((t, i) => `[página ${i + 1}]\n${t}`).join("\n\n"),
  }).eq("id", material.id);
  await supabase.from("material_trechos").delete().eq("material_id", material.id);
  const trechos = ok(await supabase.from("material_trechos").insert(
    PAGINAS.map((t, i) => ({ material_id: material.id, ordem: i, pagina: i + 1, conteudo: `[página ${i + 1}]\n${t}` })),
  ).select(), "trechos");
  const trechoDoTopico = { "Coeficiente angular": trechos[0].id, "Coeficiente linear": trechos[1].id, "Raiz da função": trechos[2].id };

  const prngOrdem = mulberry32(31);
  const permPorQuestao = new Map();
  const embaralhar = () => {
    const idx = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(prngOrdem() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx;
  };

  const rand = mulberry32(909);
  let totalEntregas = 0;
  for (const turma of turmas) {
    if (!BASE[turma.nome]) continue;
    const atividade = ok(await supabase.from("atividades").insert({
      professor_id: prof.id, turma_id: turma.id, material_id: material.id, titulo: TITULO, status: "publicada", publicada_em: dias(5),
    }).select().single(), "atividade");

    const questoes = [];
    for (const [i, [topico, enunciado, alts]] of QUESTOES.entries()) {
      const q = ok(await supabase.from("questoes").insert({
        atividade_id: atividade.id, topico_id: topicoId[topico], trecho_id: trechoDoTopico[topico], tipo: "multipla_escolha", ordem: i, enunciado,
      }).select().single(), "questão");
      const perm = permPorQuestao.get(enunciado) ?? permPorQuestao.set(enunciado, embaralhar()).get(enunciado);
      const salvas = ok(await supabase.from("alternativas").insert(
        alts.map(([texto, equivoco], k) => ({ questao_id: q.id, ordem: perm[k], texto, correta: k === 0, equivoco: k === 0 ? null : equivoco })),
      ).select(), "alternativas");
      questoes.push({ id: q.id, topico, alternativas: salvas });
    }

    // Alunos fictícios; a Isabela fica sem entrega para poder responder ao vivo na demonstração.
    const alunos = ok(await supabase.from("profiles").select("id, nome").eq("turma_id", turma.id).eq("papel", "aluno").like("nome", "%(fictício)"), "alunos");
    for (const aluno of alunos) {
      if (/^Isabela/.test(aluno.nome) || rand() < 0.1) continue;
      const habilidade = 0.25 + rand() * 0.7;
      const entrega = ok(await supabase.from("entregas").insert({
        atividade_id: atividade.id, aluno_id: aluno.id, enviada_em: dias(1 + rand() * 3.5),
      }).select().single(), "entrega");
      totalEntregas++;
      const linhas = questoes.map((q) => {
        const p = Math.min(0.97, Math.max(0.05, BASE[turma.nome][q.topico] + (habilidade - 0.6) * 0.7 + (rand() - 0.5) * 0.2));
        const acertou = rand() < p;
        const certa = q.alternativas.find((a) => a.correta);
        const erradas = q.alternativas.filter((a) => !a.correta);
        const r = rand();
        const escolhida = acertou ? certa : r < 0.6 ? erradas[0] : r < 0.85 ? erradas[1] : erradas[2];
        return {
          entrega_id: entrega.id, questao_id: q.id, alternativa_id: escolhida.id,
          nota_ia: acertou ? 1 : 0, correcao: { correta: acertou, equivoco: acertou ? null : escolhida.equivoco },
        };
      });
      ok(await supabase.from("respostas").insert(linhas), "respostas");
    }
  }
  console.log(`Matemática criada: ${totalEntregas} entregas nas duas turmas. Disciplinas dos materiais definidas.`);
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
