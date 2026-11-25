// Popula o Supabase com ~25 alunos fictícios e entregas simuladas com padrões claros de Lacuna,
// para o mapa de calor do Diagnóstico ter contraste. Sem IA e sem dados pessoais reais.
// Uso:  npm run seed            (cria professora, turmas e os 6 primeiros alunos)
//       npm run seed:diagnostico         (idempotente: não duplica)
//       npm run seed:diagnostico -- --reset   (apaga a atividade/material demo e recria)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const SENHA = "demo1234";
const DOMINIO = "demo.s-ai.dev";
const MATERIAL = "Leis de Newton (demo)";
const TITULO_ATIVIDADE = "Leis de Newton — Lista 1 (demo)";

// ---------------------------------------------------------------------------
// Conteúdo: 4 tópicos × 3 questões de múltipla escolha. A 1ª alternativa é a correta.
// ---------------------------------------------------------------------------
const TOPICOS = [
  {
    nome: "Primeira Lei (Inércia)",
    descricao: "Um corpo sem força resultante mantém repouso ou movimento retilíneo uniforme.",
    pagina: 1,
    questoes: [
      ["Um passageiro de ônibus é projetado para a frente quando o veículo freia bruscamente. Esse fenômeno é explicado:", [
        ["pela inércia: o corpo tende a manter a velocidade que tinha"],
        ["por uma força para a frente que atua sobre o passageiro na freada", "Acha que todo movimento exige uma força na direção do movimento"],
        ["pelo aumento do peso do passageiro durante a freada", "Confunde inércia com variação do peso"],
        ["pela reação do banco, que empurra o passageiro", "Aplica ação e reação ao corpo errado"],
      ]],
      ["Uma bola desliza sobre gelo praticamente sem atrito. Se nenhuma força resultante atuar sobre ela, a bola:", [
        ["mantém a velocidade, em linha reta"],
        ["para aos poucos, mesmo sem atrito", "Acredita que o repouso é o estado natural dos corpos"],
        ["acelera de modo uniforme", "Supõe que ausência de força gera aceleração"],
        ["passa a descrever uma curva", "Associa trajetória curva à ausência de forças"],
      ]],
      ["Sobre um corpo em equilíbrio (força resultante nula), é correto afirmar que ele:", [
        ["está em repouso ou em movimento retilíneo uniforme"],
        ["está necessariamente em repouso", "Confunde equilíbrio com repouso"],
        ["não sofre a ação de nenhuma força", "Confunde força resultante nula com ausência de forças"],
        ["tem velocidade que aumenta com o tempo", "Supõe que equilíbrio permite aceleração"],
      ]],
    ],
  },
  {
    nome: "Segunda Lei (F = m·a)",
    descricao: "A força resultante é o produto da massa pela aceleração.",
    pagina: 2,
    questoes: [
      ["Um bloco de 2 kg recebe uma força resultante de 10 N. Qual é a sua aceleração?", [
        ["5 m/s²"],
        ["20 m/s²", "Multiplica a força pela massa em vez de dividir"],
        ["0,2 m/s²", "Inverte a divisão: massa dividida pela força"],
        ["12 m/s²", "Soma a força com a massa"],
      ]],
      ["Uma força resultante de 12 N provoca aceleração de 3 m/s² em um corpo. Qual é a massa do corpo?", [
        ["4 kg"],
        ["36 kg", "Multiplica a força pela aceleração"],
        ["0,25 kg", "Inverte a relação: aceleração dividida pela força"],
        ["9 kg", "Subtrai a aceleração da força"],
      ]],
      ["Se a força resultante sobre um corpo dobra e a massa não muda, a aceleração:", [
        ["dobra"],
        ["cai pela metade", "Inverte a proporcionalidade entre força e aceleração"],
        ["permanece a mesma", "Acha que a aceleração depende só da massa"],
        ["quadruplica", "Confunde proporção direta com relação quadrática"],
      ]],
    ],
  },
  {
    nome: "Terceira Lei (Ação e Reação)",
    descricao: "As forças de ação e reação têm mesma intensidade, sentidos opostos e atuam em corpos diferentes.",
    pagina: 3,
    questoes: [
      ["Um livro está sobre uma mesa. A reação à força peso do livro (a atração da Terra sobre ele) é:", [
        ["a atração do livro sobre a Terra"],
        ["a força normal da mesa sobre o livro", "Confunde a normal com a reação ao peso"],
        ["a força de atrito entre o livro e a mesa", "Mistura forças de naturezas diferentes"],
        ["inexistente, pois o livro está parado", "Acha que a reação só existe quando há movimento"],
      ]],
      ["Por que as forças de ação e reação não se anulam?", [
        ["Porque atuam em corpos diferentes"],
        ["Porque têm intensidades diferentes", "Acredita que ação e reação podem ter intensidades distintas"],
        ["Porque são perpendiculares entre si", "Confunde sentidos opostos com direções perpendiculares"],
        ["Porque só existem em corpos em movimento", "Acha que a reação depende do movimento"],
      ]],
      ["Ao remar, o barco avança porque o remo empurra a água para trás e a água:", [
        ["empurra o remo (e o barco) para a frente"],
        ["não exerce força, apenas se desloca", "Acha que o meio é passivo e não reage"],
        ["puxa o barco por inércia", "Usa inércia onde cabe ação e reação"],
        ["permanece parada em relação ao remo", "Ignora que a interação é mútua"],
      ]],
    ],
  },
  {
    nome: "Força Peso e Normal",
    descricao: "Peso é P = m·g; a normal é a reação da superfície ao contato.",
    pagina: 4,
    questoes: [
      ["Qual é o peso de um corpo de 3 kg num local onde g = 10 m/s²?", [
        ["30 N"],
        ["3 N", "Confunde massa com peso"],
        ["0,3 N", "Divide a massa por g em vez de multiplicar"],
        ["13 N", "Soma a massa com g"],
      ]],
      ["Um astronauta vai da Terra para a Lua, onde g é menor. Em relação à Terra, sua massa e seu peso:", [
        ["massa igual e peso menor"],
        ["massa e peso menores", "Confunde massa com peso"],
        ["massa menor e peso igual", "Inverte as grandezas que variam"],
        ["massa e peso iguais", "Acha que g não influencia o peso"],
      ]],
      ["Um bloco de 5 kg está em repouso sobre uma mesa horizontal (g = 10 m/s²). A força normal vale:", [
        ["50 N"],
        ["5 N", "Usa a massa no lugar do peso"],
        ["0 N", "Acha que não há normal quando o corpo está parado"],
        ["100 N", "Dobra o peso sem razão"],
      ]],
    ],
  },
];

const TEXTO_PAGINAS = [
  "Primeira Lei de Newton (Inércia): um corpo em repouso ou em movimento retilíneo uniforme tende a manter esse estado, a menos que uma força resultante atue sobre ele. Equilíbrio significa força resultante nula, e não ausência de forças.",
  "Segunda Lei de Newton: a força resultante é igual ao produto da massa pela aceleração, F = m · a. A unidade de força no SI é o newton (N). A aceleração é diretamente proporcional à força e inversamente proporcional à massa.",
  "Terceira Lei de Newton (Ação e Reação): toda ação tem uma reação de mesma intensidade e direção, mas sentido oposto, aplicadas em corpos diferentes. Por isso elas nunca se anulam.",
  "Força peso: P = m · g, com g ≈ 10 m/s² na superfície da Terra. A massa não muda de lugar para lugar; o peso muda. Força normal: reação da superfície ao contato com o corpo, perpendicular a ela.",
];

// Probabilidade-base de acerto por turma e tópico: aqui estão as Lacunas desenhadas.
const BASE = {
  "2ºA": [0.85, 0.3, 0.75, 0.6], // trava em F = m·a
  "3ºB": [0.7, 0.72, 0.28, 0.82], // trava em Ação e Reação
};

const NOMES = [
  "Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabriela", "Henrique", "Isabela", "João",
  "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Pedro", "Quésia", "Rafael", "Sofia", "Tiago",
  "Úrsula", "Vinícius", "Wesley", "Ximena", "Yuri",
];

// PRNG determinístico: o seed gera sempre os mesmos dados.
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

async function usuario(email, metadata) {
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: SENHA, email_confirm: true, user_metadata: metadata,
  });
  if (!error) return data.user.id;
  if (!/already|registered/i.test(error.message)) throw error;
  const { data: lista } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  return lista.users.find((u) => u.email === email).id;
}
const ok = (r, ctx) => { if (r.error) throw new Error(`${ctx}: ${r.error.message}`); return r.data; };

async function main() {
  const reset = process.argv.includes("--reset");
  const professorId = await usuario(`professora@${DOMINIO}`, { papel: "professor", nome: "Profa. Demo" });

  const turmas = [];
  for (const nome of ["2ºA", "3ºB"]) {
    let t = ok(await supabase.from("turmas").select().eq("professor_id", professorId).eq("nome", nome).maybeSingle(), "turma");
    if (!t) t = ok(await supabase.from("turmas").insert({ nome, professor_id: professorId }).select().single(), "turma");
    turmas.push(t);
  }

  // --- limpeza opcional
  const { data: matExistente } = await supabase.from("materiais").select("id").eq("professor_id", professorId).eq("titulo", MATERIAL).maybeSingle();
  if (matExistente && !reset) {
    console.log(`"${MATERIAL}" já existe. Use --reset para recriar. Nada a fazer.`);
    return;
  }
  if (matExistente && reset) {
    await supabase.from("atividades").delete().eq("professor_id", professorId).eq("titulo", TITULO_ATIVIDADE);
    await supabase.from("topicos").delete().eq("material_id", matExistente.id);
    await supabase.from("materiais").delete().eq("id", matExistente.id);
    console.log("Demo anterior removida.");
  }

  // --- alunos: 25 fictícios, alternando as turmas
  const alunos = [];
  for (const [i, nome] of NOMES.entries()) {
    const turma = turmas[i % 2];
    const id = await usuario(`${slug(nome)}@${DOMINIO}`, { papel: "aluno", nome: `${nome} (fictício)`, codigo_convite: turma.codigo_convite });
    alunos.push({ id, nome, turma });
  }
  console.log(`${alunos.length} alunos.`);

  // --- material, trechos e tópicos
  const material = ok(await supabase.from("materiais").insert({
    professor_id: professorId, turma_id: turmas[0].id, titulo: MATERIAL, tipo: "texto",
    conteudo_texto: TEXTO_PAGINAS.map((t, i) => `[página ${i + 1}]\n${t}`).join("\n\n"),
  }).select().single(), "material");
  const trechos = ok(await supabase.from("material_trechos").insert(
    TEXTO_PAGINAS.map((t, i) => ({ material_id: material.id, ordem: i, pagina: i + 1, conteudo: `[página ${i + 1}]\n${t}` })),
  ).select(), "trechos");
  const topicos = ok(await supabase.from("topicos").insert(
    TOPICOS.map((t) => ({ professor_id: professorId, material_id: material.id, nome: t.nome, descricao: t.descricao, confirmado: true })),
  ).select(), "tópicos");
  const topicoId = (nome) => topicos.find((t) => t.nome === nome).id;

  // --- uma atividade publicada por turma, com as mesmas 12 questões
  const questoesPorTurma = new Map(); // turmaId -> [{ id, t (índice do tópico), alternativas:[{id, correta}] }]
  for (const turma of turmas) {
    const atividade = ok(await supabase.from("atividades").insert({
      professor_id: professorId, turma_id: turma.id, material_id: material.id,
      titulo: TITULO_ATIVIDADE, status: "publicada",
      publicada_em: new Date(Date.now() - 6 * 86400000).toISOString(),
    }).select().single(), "atividade");
    const lista = [];
    let ordem = 0;
    for (const [ti, top] of TOPICOS.entries()) {
      for (const [enunciado, alts] of top.questoes) {
        const q = ok(await supabase.from("questoes").insert({
          atividade_id: atividade.id, topico_id: topicoId(top.nome), trecho_id: trechos[top.pagina - 1].id,
          tipo: "multipla_escolha", ordem: ordem++, enunciado,
        }).select().single(), "questão");
        const salvas = ok(await supabase.from("alternativas").insert(
          alts.map(([texto, equivoco], i) => ({ questao_id: q.id, ordem: i, texto, correta: i === 0, equivoco: i === 0 ? null : equivoco })),
        ).select(), "alternativas");
        lista.push({ id: q.id, t: ti, alternativas: salvas.sort((a, b) => a.ordem - b.ordem), atividadeId: atividade.id });
      }
    }
    questoesPorTurma.set(turma.id, { atividadeId: atividade.id, questoes: lista });
  }

  // --- entregas simuladas
  const rand = mulberry32(2026);
  let entregas = 0, respostas = 0, semEntrega = 0;
  for (const [i, aluno] of alunos.entries()) {
    const { atividadeId, questoes } = questoesPorTurma.get(aluno.turma.id);
    if (i % 9 === 8) { semEntrega++; continue; } // alguns alunos não entregaram
    const habilidade = 0.25 + rand() * 0.7; // 0,25..0,95
    const base = BASE[aluno.turma.nome];
    const entrega = ok(await supabase.from("entregas").insert({
      atividade_id: atividadeId, aluno_id: aluno.id,
      enviada_em: new Date(Date.now() - Math.floor(rand() * 5 * 86400000)).toISOString(),
    }).select().single(), "entrega");
    entregas++;
    const linhas = questoes.map((q) => {
      const p = Math.min(0.97, Math.max(0.03, base[q.t] + (habilidade - 0.6) * 0.7 + (rand() - 0.5) * 0.2));
      const acertou = rand() < p;
      const certa = q.alternativas.find((a) => a.correta);
      const erradas = q.alternativas.filter((a) => !a.correta);
      // o 1º distrator domina: dá um "equívoco mais frequente" claro
      const r = rand();
      const errada = r < 0.6 ? erradas[0] : r < 0.85 ? erradas[1] : erradas[2];
      const escolhida = acertou ? certa : errada;
      return {
        entrega_id: entrega.id, questao_id: q.id, alternativa_id: escolhida.id,
        nota_ia: acertou ? 1 : 0, correcao: { correta: acertou, equivoco: acertou ? null : escolhida.equivoco },
      };
    });
    ok(await supabase.from("respostas").insert(linhas), "respostas");
    respostas += linhas.length;
  }

  console.log(`Entregas: ${entregas} (${semEntrega} alunos sem entrega) · respostas: ${respostas}.`);
  console.log(`Login de teste dos alunos: <nome>@${DOMINIO} / ${SENHA}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
