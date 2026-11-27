// Popula o Supabase com um cenário completo das Fases 1–5 (sem chamar IA):
//   - Presets salvos da professora (Matemática e Física)
//   - 1 atividade em RASCUNHO (Limites no infinito) com Rubrica v2 (pílulas +, teto L'Hôpital, sugestão tracejada)
//     e questão objetiva com length giveaway para testar o Editor de Pílulas e Hardening
//   - 1 atividade PUBLICADA na 2ºA com trava humana (revisar_antes_liberar = true) e 6 entregas simuladas:
//     pendente, sinal de cola (telemetria), erro em cascata (ECF), teto L'Hôpital, erro de raiz e acerto total
//     (deixando ana@demo.s-ai.dev livre para testar responder como aluna com auto-save!)
//
// Uso: npm run seed:dissertativas             (idempotente)
//      npm run seed:dissertativas -- --reset  (recria as atividades demo)
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const EMAIL_PROFESSORA = "professora@demo.s-ai.dev";
const TITULO_RASCUNHO = "Limites no infinito — Rascunho com Pílulas (demo)";
const TITULO_PUBLICADA = "Avaliação Dissertativa — Limites e 2ª Lei (demo)";
const NOME_TOPICO = "Limites no infinito";

function ok(res, rotulo) {
  if (res.error) throw new Error(`${rotulo}: ${res.error.message}`);
  return res.data;
}

const RUBRICA_CALCULO = {
  versao: 2,
  resolucao_modelo:
    "Fatore x no numerador: x(4 + 5/x). No denominador, para x > 0, sqrt(9x^2 - 5x + 1) = x * sqrt(9 - 5/x + 1/x^2). Cancele x e aplique lim(1/x) = 0: 4 / sqrt(9) = 4/3.",
  positivos: [
    {
      id: "c1",
      texto: "Chegou ao resultado final correto (4/3)",
      rotulo_falha: "Errou o resultado final do limite (4/3)",
      peso: 50,
      grupo_id: null,
      aceita_parcial: true,
    },
    {
      id: "c2",
      texto: "Fatorou o x em evidência no numerador e denominador",
      rotulo_falha: "Não fatorou x em evidência",
      peso: 30,
      grupo_id: null,
      aceita_parcial: true,
    },
    {
      id: "c3",
      texto: "Cancelou o fator x e aplicou lim (1/x) = 0",
      rotulo_falha: "Não cancelou x nem aplicou lim (1/x) = 0",
      peso: 20,
      grupo_id: null,
      aceita_parcial: true,
      depende_de: ["c2"],
    },
  ],
  penalidades: [
    {
      id: "p1",
      texto: "Usou Regra de L'Hôpital (conteúdo não dado)",
      equivoco: "Recorreu à Regra de L'Hôpital em vez de fatoração algébrica",
      modo: "teto",
      valor: 50,
      ignora_etapas_intermediarias: true,
      ativa: true,
    },
    {
      id: "p2",
      texto: "Errou sinal ao extrair x² da raiz",
      equivoco: "Confundiu sqrt(x^2) com x sem considerar o sinal/módulo",
      modo: "desconto",
      valor: 15,
      ignora_etapas_intermediarias: false,
      ativa: false, // sugestão tracejada (1 clique ativa!)
    },
  ],
};

const REGRAS_PROVA = {
  aceitar_erro_em_cascata: true,
  fator_ecf: 0.8,
  aceitar_metodo_equivalente: true,
  ignorar_ortografia: false,
  metodo_proibido: null,
};

async function main() {
  const reset = process.argv.includes("--reset");
  const { data: listaUsers } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const profUser = listaUsers?.users?.find((u) => u.email === EMAIL_PROFESSORA);
  if (!profUser) throw new Error("Professora demo não encontrada. Rode `npm run seed` primeiro.");
  const professorId = profUser.id;

  const turmas = ok(
    await supabase.from("turmas").select("id, nome").eq("professor_id", professorId).order("nome"),
    "turmas",
  );
  const turma2A = turmas.find((t) => t.nome === "2ºA") ?? turmas[0];
  if (!turma2A) throw new Error("Nenhuma turma encontrada. Rode `npm run seed` primeiro.");

  if (reset) {
    await supabase
      .from("atividades")
      .delete()
      .eq("professor_id", professorId)
      .in("titulo", [TITULO_RASCUNHO, TITULO_PUBLICADA]);
  }

  // 1. Presets da professora (idempotente)
  const presetsExistentes = ok(
    await supabase.from("professor_rubrica_presets").select("nome").eq("professor_id", professorId),
    "presets",
  );
  const nomesPresets = new Set(presetsExistentes.map((p) => p.nome));
  const novosPresets = [
    {
      professor_id: professorId,
      disciplina: "Matemática",
      nome: "Meu padrão de Matemática (ECF + sem L'Hôpital)",
      regras_globais: {
        aceitar_erro_em_cascata: true,
        fator_ecf: 0.8,
        aceitar_metodo_equivalente: true,
        ignorar_ortografia: true,
        metodo_proibido: { descricao: "Regra de L'Hôpital", modo: "teto", valor: 50 },
      },
      pilulas_padrao: [],
    },
    {
      professor_id: professorId,
      disciplina: "Física",
      nome: "Meu padrão de Física (foco conceitual)",
      regras_globais: {
        aceitar_erro_em_cascata: true,
        fator_ecf: 1.0,
        aceitar_metodo_equivalente: true,
        ignorar_ortografia: true,
        metodo_proibido: null,
      },
      pilulas_padrao: [],
    },
  ].filter((p) => !nomesPresets.has(p.nome));

  if (novosPresets.length) {
    ok(await supabase.from("professor_rubrica_presets").insert(novosPresets), "inserir presets");
  }

  // 2. Material e Tópico de Limites (reaproveita material de Matemática se existir)
  const { data: matMat } = await supabase
    .from("materiais")
    .select("id")
    .eq("professor_id", professorId)
    .eq("disciplina", "Matemática")
    .limit(1)
    .maybeSingle();

  let { data: topicoLimite } = await supabase
    .from("topicos")
    .select("id")
    .eq("professor_id", professorId)
    .eq("nome", NOME_TOPICO)
    .maybeSingle();

  if (!topicoLimite) {
    topicoLimite = ok(
      await supabase
        .from("topicos")
        .insert({
          professor_id: professorId,
          material_id: matMat?.id ?? null,
          nome: NOME_TOPICO,
          descricao: "Cálculo de limites no infinito com fatoração do termo de maior grau.",
          confirmado: true,
        })
        .select("id")
        .single(),
      "topico limites",
    );
  }

  // 3. Atividade 1: RASCUNHO rico (para testar Editor de Pílulas, Calibração, Length Giveaway e Multi-Turma)
  const { data: rascunhoExistente } = await supabase
    .from("atividades")
    .select("id")
    .eq("professor_id", professorId)
    .eq("titulo", TITULO_RASCUNHO)
    .maybeSingle();

  if (!rascunhoExistente) {
    const ativRasc = ok(
      await supabase
        .from("atividades")
        .insert({
          professor_id: professorId,
          turma_id: turma2A.id,
          material_id: matMat?.id ?? null,
          titulo: TITULO_RASCUNHO,
          status: "rascunho",
          regras_globais: REGRAS_PROVA,
          revisar_antes_liberar: true,
        })
        .select("id")
        .single(),
      "atividade rascunho",
    );

    ok(
      await supabase.from("questoes").insert({
        atividade_id: ativRasc.id,
        topico_id: topicoLimite.id,
        tipo: "dissertativa",
        ordem: 0,
        enunciado:
          "Encontre o limite de (4x + 5) / sqrt(9x² − 5x + 1) quando x → +∞, mostrando as etapas algébricas de fatoração e simplificação.",
        rubrica: RUBRICA_CALCULO,
      }),
      "questao dissertativa rascunho",
    );

    // Questão objetiva com length giveaway proposital para demonstrar o alerta no editor!
    const qMc = ok(
      await supabase
        .from("questoes")
        .insert({
          atividade_id: ativRasc.id,
          topico_id: topicoLimite.id,
          tipo: "multipla_escolha",
          ordem: 1,
          enunciado: "Ao calcular lim (x → +∞) de (2x + 3) / (5x − 1), qual procedimento algébrico elimina a indeterminação ∞/∞?",
          rubrica: null,
        })
        .select("id")
        .single(),
      "questao mc rascunho",
    );

    ok(
      await supabase.from("alternativas").insert([
        {
          questao_id: qMc.id,
          ordem: 0,
          texto: "Substituir x por zero diretamente",
          correta: false,
          equivoco: "Substitui o limite no infinito por zero",
        },
        {
          questao_id: qMc.id,
          ordem: 1,
          texto:
            "Colocar o termo de maior grau x em evidência no numerador e no denominador, cancelar o fator comum e usar o fato de que lim (1/x) = 0 quando x tende a infinito",
          correta: true,
          equivoco: null,
        },
        {
          questao_id: qMc.id,
          ordem: 2,
          texto: "Somar os coeficientes 2 + 3",
          correta: false,
          equivoco: "Soma coeficientes ignorando a variável",
        },
        {
          questao_id: qMc.id,
          ordem: 3,
          texto: "Multiplicar tudo por x²",
          correta: false,
          equivoco: "Aumenta o grau em vez de simplificar",
        },
      ]),
      "alternativas rascunho",
    );
  }

  // 4. Atividade 2: PUBLICADA na 2ºA com entregas simuladas para testar Mesa de Revisão, Pílulas e Rubrica Reversa!
  const { data: pubExistente } = await supabase
    .from("atividades")
    .select("id")
    .eq("professor_id", professorId)
    .eq("titulo", TITULO_PUBLICADA)
    .maybeSingle();

  if (!pubExistente) {
    const ativPub = ok(
      await supabase
        .from("atividades")
        .insert({
          professor_id: professorId,
          turma_id: turma2A.id,
          material_id: matMat?.id ?? null,
          titulo: TITULO_PUBLICADA,
          status: "publicada",
          publicada_em: new Date(Date.now() - 2 * 86400000).toISOString(),
          regras_globais: REGRAS_PROVA,
          revisar_antes_liberar: true,
        })
        .select("id")
        .single(),
      "atividade publicada",
    );

    const qDiss = ok(
      await supabase
        .from("questoes")
        .insert({
          atividade_id: ativPub.id,
          topico_id: topicoLimite.id,
          tipo: "dissertativa",
          ordem: 0,
          enunciado:
            "Calcule o limite de (4x + 5) / sqrt(9x² − 5x + 1) quando x → +∞, apresentando o desenvolvimento algébrico completo.",
          rubrica: RUBRICA_CALCULO,
        })
        .select("id")
        .single(),
      "questao dissertativa publicada",
    );

    const qObj = ok(
      await supabase
        .from("questoes")
        .insert({
          atividade_id: ativPub.id,
          topico_id: topicoLimite.id,
          tipo: "multipla_escolha",
          ordem: 1,
          enunciado: "Quanto vale lim (x → +∞) de (6x − 2) / (3x + 7)?",
          rubrica: null,
        })
        .select("id")
        .single(),
      "questao obj publicada",
    );

    const altsObj = ok(
      await supabase
        .from("alternativas")
        .insert([
          { questao_id: qObj.id, ordem: 0, texto: "2", correta: true, equivoco: null },
          { questao_id: qObj.id, ordem: 1, texto: "−2/7", correta: false, equivoco: "Divide os termos independentes em vez dos coeficientes líderes" },
          { questao_id: qObj.id, ordem: 2, texto: "0", correta: false, equivoco: "Assume que todo limite no infinito tende a zero" },
          { questao_id: qObj.id, ordem: 3, texto: "∞", correta: false, equivoco: "Ignora o crescimento equivalente do denominador" },
        ])
        .select("id, correta"),
      "alternativas obj publicada",
    );
    const altCorreta = altsObj.find((a) => a.correta);
    const altErrada = altsObj.find((a) => !a.correta);

    const qObj2 = ok(
      await supabase
        .from("questoes")
        .insert({
          atividade_id: ativPub.id,
          topico_id: topicoLimite.id,
          tipo: "multipla_escolha",
          ordem: 2,
          enunciado: "Quando x → +∞, para qual valor tende a fração 5/x?",
          rubrica: null,
        })
        .select("id")
        .single(),
      "questao obj2 publicada",
    );

    const altsObj2 = ok(
      await supabase
        .from("alternativas")
        .insert([
          { questao_id: qObj2.id, ordem: 0, texto: "0", correta: true, equivoco: null },
          { questao_id: qObj2.id, ordem: 1, texto: "5", correta: false, equivoco: "Ignora o crescimento do denominador quando x → ∞" },
          { questao_id: qObj2.id, ordem: 2, texto: "∞", correta: false, equivoco: "Confunde 5/x com 5·x no infinito" },
          { questao_id: qObj2.id, ordem: 3, texto: "1", correta: false, equivoco: "Assume que toda razão com x tende a 1" },
        ])
        .select("id, correta"),
      "alternativas obj2 publicada",
    );
    const alt2Correta = altsObj2.find((a) => a.correta);
    const alt2Errada = altsObj2.find((a) => !a.correta);

    // Busca alunos da 2ºA, deixando ana@demo.s-ai.dev SEM entregar (para o usuário testar responder como Ana!)
    const anaUser = listaUsers?.users?.find((u) => u.email === "ana@demo.s-ai.dev");
    const alunos2A = ok(
      await supabase
        .from("profiles")
        .select("id, nome")
        .eq("papel", "aluno")
        .eq("turma_id", turma2A.id)
        .order("nome"),
      "alunos 2A",
    ).filter((a) => a.id !== anaUser?.id);

    const cenarios = [
      // 1. Pendente (para testar re-correção em lote)
      {
        texto: "Fatorei x no numerador ficando x(4 + 5/x) e no denominador tirei x² da raiz como x*sqrt(9 - 5/x + 1/x²). Depois cortei x e ficou 4/3.",
        nota_ia: null,
        liberada: false,
        telemetria: { paste_events: 0, paste_chars: 0, total_chars: 138, tempo_segundos: 95, sinal_cola: false },
        correcao: { pendente: true },
        acertouObj: true,
      },
      // 2. Sinal de cola (telemetria + baixa confiança)
      {
        texto:
          "Para determinar o limite no infinito da expressão racional envolvendo radical quadrático, dividimos tanto o numerador quanto o denominador pela maior potência de x presente, isto é, x = sqrt(x^2) para x > 0. Assim obtemos (4 + 5/x) / sqrt(9 - 5/x + 1/x^2). Aplicando as propriedades operatórias dos limites e sabendo que lim(1/x) = 0, concluímos rigorosamente que o limite converge para 4/3.",
        nota_ia: 1.0,
        liberada: false,
        telemetria: { paste_events: 1, paste_chars: 389, total_chars: 389, tempo_segundos: 5, sinal_cola: true },
        correcao: {
          versao: 2,
          nota: 1.0,
          percentual: 100,
          precisa_revisao: true,
          motivos_revisao: ["Baixa confiança em \"Fatorou o x em evidência no numerador e denominador\""],
          falhas_diagnostico: [],
          teto_aplicado: null,
          comentario: "Resposta completa e correta.",
          criterios: [
            { criterio: "Chegou ao resultado final correto (4/3)", pontos: 5, obtidos: 5, comentario: "Encontrou 4/3 corretamente." },
            { criterio: "Fatorou o x em evidência no numerador e denominador", pontos: 3, obtidos: 3, comentario: "Dividiu pela maior potência de x." },
            { criterio: "Cancelou o fator x e aplicou lim (1/x) = 0", pontos: 2, obtidos: 2, comentario: "Aplicou lim(1/x)=0." },
          ],
          avaliacao_ia: {
            metodo_alternativo_valido: false,
            comentario_geral: "Resposta completa e correta.",
            criterios: [
              { criterio_id: "c1", evidencia_literal: "converge para 4/3", justificativa: "Chegou ao resultado 4/3.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c2", evidencia_literal: "dividimos tanto o numerador quanto o denominador pela maior potência de x", justificativa: "Usou divisão por x equivalente à fatoração.", erro_em_cascata: false, status: "atendido", confianca: "baixa", evidencia_verificada: true },
              { criterio_id: "c3", evidencia_literal: "sabendo que lim(1/x) = 0", justificativa: "Aplicou o limite fundamental.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
            ],
            penalidades: [
              { penalidade_id: "p1", evidencia_literal: "", justificativa: "Não usou L'Hôpital.", acionada: false, confianca: "alta", evidencia_verificada: true },
            ],
          },
        },
        acertouObj: true,
      },
      // 3. Caso L'Hôpital (teto 50% sem dupla penalização!)
      {
        texto: "Como deu infinito sobre infinito, apliquei a Regra de L'Hôpital derivando em cima (deu 4) e derivando a raiz embaixo, chegando no final em 4/3.",
        nota_ia: 0.5,
        liberada: false,
        telemetria: { paste_events: 0, paste_chars: 0, total_chars: 146, tempo_segundos: 110, sinal_cola: false },
        correcao: {
          versao: 2,
          nota: 0.5,
          percentual: 50,
          precisa_revisao: false,
          motivos_revisao: [],
          falhas_diagnostico: [
            "Não fatorou x em evidência",
            "Não cancelou x nem aplicou lim (1/x) = 0",
            "Recorreu à Regra de L'Hôpital em vez de fatoração algébrica",
          ],
          teto_aplicado: 50,
          comentario: "Você chegou ao valor 4/3, mas usou L'Hôpital (teto de 50% nesta atividade).",
          criterios: [
            { criterio: "Chegou ao resultado final correto (4/3)", pontos: 5, obtidos: 5, comentario: "Resultado 4/3 correto." },
            { criterio: "Fatorou o x em evidência no numerador e denominador", pontos: 3, obtidos: 0, comentario: "Derivou em vez de fatorar." },
            { criterio: "Cancelou o fator x e aplicou lim (1/x) = 0", pontos: 2, obtidos: 0, comentario: "Não utilizou cancelamento algébrico." },
          ],
          avaliacao_ia: {
            metodo_alternativo_valido: false,
            comentario_geral: "Você chegou ao valor 4/3, mas usou L'Hôpital (teto de 50% nesta atividade).",
            criterios: [
              { criterio_id: "c1", evidencia_literal: "chegando no final em 4/3", justificativa: "Encontrou o resultado 4/3.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c2", evidencia_literal: "", justificativa: "Não fatorou x em evidência.", erro_em_cascata: false, status: "nao_atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c3", evidencia_literal: "", justificativa: "Não aplicou lim(1/x)=0.", erro_em_cascata: false, status: "nao_atendido", confianca: "alta", evidencia_verificada: true },
            ],
            penalidades: [
              { penalidade_id: "p1", evidencia_literal: "apliquei a Regra de L'Hôpital", justificativa: "Usou L'Hôpital explicitamente.", acionada: true, confianca: "alta", evidencia_verificada: true },
            ],
          },
        },
        acertouObj: false,
      },
      // 4. Caso Error Carried Forward (ECF: errou sqrt(9)=9, mas fatorou e cancelou corretamente!)
      {
        texto: "Coloquei x em evidência: x(4 + 5/x) dividido por x*sqrt(9 - 5/x + 1/x²). Cortei o x e zerei 5/x e 1/x², ficando 4 / 9 como resposta final.",
        nota_ia: 0.9,
        liberada: false,
        telemetria: { paste_events: 0, paste_chars: 0, total_chars: 139, tempo_segundos: 140, sinal_cola: false },
        correcao: {
          versao: 2,
          nota: 0.9,
          percentual: 90,
          precisa_revisao: true,
          motivos_revisao: ["Erro em cascata (ECF) aplicado em \"Chegou ao resultado final correto (4/3)\""],
          falhas_diagnostico: [],
          teto_aplicado: null,
          comentario: "Fatoração e limite corretos; apenas esqueceu de extrair a raiz quadrada de 9 no final.",
          criterios: [
            { criterio: "Chegou ao resultado final correto (4/3)", pontos: 5, obtidos: 4, comentario: "Esqueceu de tirar a raiz de 9 (ECF aplicado)." },
            { criterio: "Fatorou o x em evidência no numerador e denominador", pontos: 3, obtidos: 3, comentario: "Fatorou corretamente." },
            { criterio: "Cancelou o fator x e aplicou lim (1/x) = 0", pontos: 2, obtidos: 2, comentario: "Cancelou x e zerou termos com 1/x." },
          ],
          avaliacao_ia: {
            metodo_alternativo_valido: false,
            comentario_geral: "Fatoração e limite corretos; apenas esqueceu de extrair a raiz quadrada de 9 no final.",
            criterios: [
              { criterio_id: "c1", evidencia_literal: "ficando 4 / 9 como resposta final", justificativa: "Esqueceu a raiz de 9 após executar bem o método.", erro_em_cascata: true, valor_carregado: "sqrt(9) = 9", status: "nao_atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c2", evidencia_literal: "x(4 + 5/x) dividido por x*sqrt(9 - 5/x + 1/x²)", justificativa: "Fatorou corretamente.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c3", evidencia_literal: "Cortei o x e zerei 5/x e 1/x²", justificativa: "Cancelou e aplicou o limite.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
            ],
            penalidades: [
              { penalidade_id: "p1", evidencia_literal: "", justificativa: "Não usou L'Hôpital.", acionada: false, confianca: "alta", evidencia_verificada: true },
            ],
          },
        },
        acertouObj: true,
      },
      // 5. Segundo aluno que esqueceu de tirar raiz de 9 (ajuda na Rubrica Reversa!)
      {
        texto: "Fatorei x em cima e x² dentro da raiz, cortei x, sobrou 4 em cima e 9 embaixo, então o limite dá 4/9.",
        nota_ia: 0.5,
        liberada: true,
        telemetria: { paste_events: 0, paste_chars: 0, total_chars: 103, tempo_segundos: 80, sinal_cola: false },
        correcao: {
          versao: 2,
          nota: 0.5,
          percentual: 50,
          precisa_revisao: false,
          motivos_revisao: [],
          falhas_diagnostico: ["Errou o resultado final do limite (4/3)"],
          teto_aplicado: null,
          comentario: "Bom desenvolvimento algébrico, mas faltou calcular sqrt(9) = 3 no denominador.",
          criterios: [
            { criterio: "Chegou ao resultado final correto (4/3)", pontos: 5, obtidos: 0, comentario: "Respondeu 4/9 em vez de 4/3." },
            { criterio: "Fatorou o x em evidência no numerador e denominador", pontos: 3, obtidos: 3, comentario: "Fatorou bem." },
            { criterio: "Cancelou o fator x e aplicou lim (1/x) = 0", pontos: 2, obtidos: 2, comentario: "Cancelou o fator x." },
          ],
          avaliacao_ia: {
            metodo_alternativo_valido: false,
            comentario_geral: "Bom desenvolvimento algébrico, mas faltou calcular sqrt(9) = 3 no denominador.",
            criterios: [
              { criterio_id: "c1", evidencia_literal: "o limite dá 4/9", justificativa: "Esqueceu a raiz de 9.", erro_em_cascata: false, status: "nao_atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c2", evidencia_literal: "Fatorei x em cima e x² dentro da raiz", justificativa: "Fatorou x corretamente.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c3", evidencia_literal: "cortei x", justificativa: "Cancelou x.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
            ],
            penalidades: [
              { penalidade_id: "p1", evidencia_literal: "", justificativa: "Não usou L'Hôpital.", acionada: false, confianca: "alta", evidencia_verificada: true },
            ],
          },
        },
        acertouObj: false,
      },
      // 6. Terceiro aluno que também esqueceu raiz de 9 (3 alunos com mesmo padrão não previsto -> Rubrica Reversa!)
      {
        texto: "Coloquei x em evidência e simplifiquei os termos com 1/x para zero. Sobrou 4/9 como limite final.",
        nota_ia: 0.5,
        liberada: true,
        telemetria: { paste_events: 0, paste_chars: 0, total_chars: 99, tempo_segundos: 70, sinal_cola: false },
        correcao: {
          versao: 2,
          nota: 0.5,
          percentual: 50,
          precisa_revisao: false,
          motivos_revisao: [],
          falhas_diagnostico: ["Errou o resultado final do limite (4/3)"],
          teto_aplicado: null,
          comentario: "Faltou extrair a raiz quadrada do 9 no denominador.",
          criterios: [
            { criterio: "Chegou ao resultado final correto (4/3)", pontos: 5, obtidos: 0, comentario: "Respondeu 4/9 em vez de 4/3." },
            { criterio: "Fatorou o x em evidência no numerador e denominador", pontos: 3, obtidos: 3, comentario: "Fatorou x." },
            { criterio: "Cancelou o fator x e aplicou lim (1/x) = 0", pontos: 2, obtidos: 2, comentario: "Aplicou lim(1/x)=0." },
          ],
          avaliacao_ia: {
            metodo_alternativo_valido: false,
            comentario_geral: "Faltou extrair a raiz quadrada do 9 no denominador.",
            criterios: [
              { criterio_id: "c1", evidencia_literal: "Sobrou 4/9 como limite final", justificativa: "Esqueceu a raiz de 9.", erro_em_cascata: false, status: "nao_atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c2", evidencia_literal: "Coloquei x em evidência", justificativa: "Fatorou x.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
              { criterio_id: "c3", evidencia_literal: "simplifiquei os termos com 1/x para zero", justificativa: "Aplicou lim(1/x)=0.", erro_em_cascata: false, status: "atendido", confianca: "alta", evidencia_verificada: true },
            ],
            penalidades: [
              { penalidade_id: "p1", evidencia_literal: "", justificativa: "Não usou L'Hôpital.", acionada: false, confianca: "alta", evidencia_verificada: true },
            ],
          },
        },
        acertouObj: true,
      },
    ];

    let entregasCriadas = 0;
    for (const [i, cen] of cenarios.entries()) {
      const aluno = alunos2A[i];
      if (!aluno) break;
      const enviadaEm = new Date(Date.now() - (6 - i) * 3600000).toISOString();
      const entrega = ok(
        await supabase
          .from("entregas")
          .insert({
            atividade_id: ativPub.id,
            aluno_id: aluno.id,
            enviada_em: enviadaEm,
            liberada_em: cen.liberada ? enviadaEm : null,
            feedback: {
              resumo: cen.nota_ia === 1 ? "Excelente desempenho!" : "Vale revisar Limites no infinito.",
              itens: [
                { questao_id: qDiss.id, nota: cen.nota_ia, explicacao: cen.correcao.comentario ?? null, revisar: null },
                { questao_id: qObj.id, nota: cen.acertouObj ? 1 : 0, explicacao: cen.acertouObj ? null : "A resposta correta era 2.", revisar: null },
                { questao_id: qObj2.id, nota: i % 2 === 0 ? 1 : 0, explicacao: i % 2 === 0 ? null : "Quando x cresce sem limite, 5/x tende a 0.", revisar: null },
              ],
            },
          })
          .select("id")
          .single(),
        `entrega ${aluno.nome}`,
      );

      const acertouObj2 = i % 2 === 0;
      ok(
        await supabase.from("respostas").insert([
          {
            entrega_id: entrega.id,
            questao_id: qDiss.id,
            texto: cen.texto,
            nota_ia: cen.nota_ia,
            correcao: cen.correcao,
            telemetria: cen.telemetria,
          },
          {
            entrega_id: entrega.id,
            questao_id: qObj.id,
            alternativa_id: cen.acertouObj ? altCorreta.id : altErrada.id,
            nota_ia: cen.acertouObj ? 1 : 0,
            correcao: { correta: cen.acertouObj, equivoco: cen.acertouObj ? null : "Divide os termos independentes em vez dos coeficientes líderes" },
          },
          {
            entrega_id: entrega.id,
            questao_id: qObj2.id,
            alternativa_id: acertouObj2 ? alt2Correta.id : alt2Errada.id,
            nota_ia: acertouObj2 ? 1 : 0,
            correcao: { correta: acertouObj2, equivoco: acertouObj2 ? null : "Ignora o crescimento do denominador quando x → ∞" },
          },
        ]),
        `respostas ${aluno.nome}`,
      );
      entregasCriadas++;
    }
    console.log(`Seed dissertativas ok: 1 rascunho + 1 publicada na ${turma2A.nome} com ${entregasCriadas} entregas (pendente, cola, L'Hôpital, ECF e 3 casos de raiz).`);
    console.log("ana@demo.s-ai.dev ficou livre para testar responder como aluna com auto-save!");
  } else {
    console.log("Seed dissertativas já estava aplicado (use --reset para recriar).");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
