import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  analisarComprimentoAlternativas,
  aplicarVerificacaoEvidencias,
  calcularNotaDeterministica,
  normalizarPesosPara100,
  normalizarRubrica,
  REGRAS_GLOBAIS_PADRAO,
  simularCenariosRubrica,
  somaPesosPositivos,
  verificarEvidenciaLiteral,
  type AvaliacaoIA,
  type RubricaV2,
} from "./nota-rubrica.ts";

const rubricaCalculo: RubricaV2 = {
  versao: 2,
  resolucao_modelo: "Fatora x no numerador e denominador, cancela x, aplica lim(1/x)=0 -> 4/3.",
  positivos: [
    { id: "c1", texto: "Chegou ao resultado final correto (4/3)", rotulo_falha: "Errou o resultado final (4/3)", peso: 50 },
    { id: "c2", texto: "Fatorou o x em evidência no numerador e denominador", rotulo_falha: "Não fatorou x em evidência", peso: 30 },
    { id: "c3", texto: "Cancelou o fator x e aplicou lim(1/x)=0", rotulo_falha: "Não aplicou lim(1/x)=0 após cancelar x", peso: 20, depende_de: ["c2"] },
  ],
  penalidades: [
    {
      id: "p1",
      texto: "Usou Regra de L'Hôpital (conteúdo não dado)",
      equivoco: "Usou Regra de L'Hôpital em vez de manipulação algébrica",
      modo: "teto",
      valor: 50,
      ignora_etapas_intermediarias: true,
      ativa: true,
    },
  ],
};

describe("nota-rubrica: motor determinístico", () => {
  it("evita dupla penalização no caso L'Hôpital com modo teto + ignora_etapas_intermediarias", () => {
    const avaliacao: AvaliacaoIA = {
      metodo_alternativo_valido: false,
      criterios: [
        { criterio_id: "c1", evidencia_literal: "4/3", justificativa: "Acertou", erro_em_cascata: false, status: "atendido", confianca: "alta" },
        { criterio_id: "c2", evidencia_literal: "", justificativa: "Derivou em vez de fatorar", erro_em_cascata: false, status: "nao_atendido", confianca: "alta" },
        { criterio_id: "c3", evidencia_literal: "", justificativa: "Não cancelou x", erro_em_cascata: false, status: "nao_atendido", confianca: "alta" },
      ],
      penalidades: [
        { penalidade_id: "p1", evidencia_literal: "derivando numerador e denominador", justificativa: "Usou L'Hôpital", acionada: true, confianca: "alta" },
      ],
      comentario_geral: "Chegou ao valor correto usando método não permitido.",
    };

    const res = calcularNotaDeterministica(rubricaCalculo, avaliacao, REGRAS_GLOBAIS_PADRAO);
    assert.equal(res.percentual, 50);
    assert.equal(res.nota, 0.5);
    assert.equal(res.teto_aplicado, 50);
    assert.ok(res.falhas_diagnostico.includes("Usou Regra de L'Hôpital em vez de manipulação algébrica"));
  });

  it("respeita piso >= 0 quando descontos aditivos ultrapassam a pontuação obtida", () => {
    const rubricaDesconto: RubricaV2 = {
      ...rubricaCalculo,
      penalidades: [
        { id: "p1", texto: "Usou L'Hôpital", equivoco: "Usou L'Hôpital", modo: "desconto", valor: 60, ativa: true },
        { id: "p2", texto: "Sem unidade", equivoco: "Esqueceu unidade", modo: "desconto", valor: 30, ativa: true },
      ],
    };
    const avaliacao: AvaliacaoIA = {
      metodo_alternativo_valido: false,
      criterios: [
        { criterio_id: "c1", evidencia_literal: "4/3", justificativa: "Ok", erro_em_cascata: false, status: "atendido", confianca: "alta" },
        { criterio_id: "c2", evidencia_literal: "", justificativa: "Não", erro_em_cascata: false, status: "nao_atendido", confianca: "alta" },
        { criterio_id: "c3", evidencia_literal: "", justificativa: "Não", erro_em_cascata: false, status: "nao_atendido", confianca: "alta" },
      ],
      penalidades: [
        { penalidade_id: "p1", evidencia_literal: "L'Hopital", justificativa: "Sim", acionada: true, confianca: "alta" },
        { penalidade_id: "p2", evidencia_literal: "", justificativa: "Sim", acionada: true, confianca: "alta" },
      ],
      comentario_geral: "",
    };

    const res = calcularNotaDeterministica(rubricaDesconto, avaliacao, REGRAS_GLOBAIS_PADRAO);
    assert.equal(res.percentual, 0);
    assert.equal(res.nota, 0);
  });

  it("aplica Error Carried Forward (ECF) somente quando a regra global está ativada", () => {
    const avaliacao: AvaliacaoIA = {
      metodo_alternativo_valido: false,
      criterios: [
        { criterio_id: "c1", evidencia_literal: "4/9", justificativa: "Errou raiz de 9", erro_em_cascata: true, valor_carregado: "raiz(9)=9", status: "nao_atendido", confianca: "alta" },
        { criterio_id: "c2", evidencia_literal: "x(4 + 5/x)", justificativa: "Fatorou bem", erro_em_cascata: false, status: "atendido", confianca: "alta" },
        { criterio_id: "c3", evidencia_literal: "lim 1/x = 0", justificativa: "Cancelou corretamente", erro_em_cascata: false, status: "atendido", confianca: "alta" },
      ],
      penalidades: [],
      comentario_geral: "",
    };

    const comEcf = calcularNotaDeterministica(rubricaCalculo, avaliacao, { ...REGRAS_GLOBAIS_PADRAO, aceitar_erro_em_cascata: true, fator_ecf: 0.8 });
    assert.equal(comEcf.percentual, 90); // 30 + 20 + 50*0.8
    assert.equal(comEcf.precisa_revisao, true);

    const semEcf = calcularNotaDeterministica(rubricaCalculo, avaliacao, { ...REGRAS_GLOBAIS_PADRAO, aceitar_erro_em_cascata: false });
    assert.equal(semEcf.percentual, 50); // 30 + 20 + 0
  });

  it("respeita grupo_id mutuamente exclusivo (pega apenas o melhor critério do grupo)", () => {
    const rubricaGrupo: RubricaV2 = {
      versao: 2,
      positivos: [
        { id: "c1", texto: "Explicação completa com fórmula", rotulo_falha: "Sem explicação completa", peso: 60, grupo_id: "explicacao" },
        { id: "c2", texto: "Explicação intuitiva sem fórmula", rotulo_falha: "Sem explicação intuitiva", peso: 40, grupo_id: "explicacao" },
        { id: "c3", texto: "Conclusão coerente", rotulo_falha: "Sem conclusão", peso: 40 },
      ],
      penalidades: [],
    };
    assert.equal(somaPesosPositivos(rubricaGrupo.positivos), 100);

    const avaliacao: AvaliacaoIA = {
      metodo_alternativo_valido: false,
      criterios: [
        { criterio_id: "c1", evidencia_literal: "F=ma", justificativa: "Ok", erro_em_cascata: false, status: "atendido", confianca: "alta" },
        { criterio_id: "c2", evidencia_literal: "mais força", justificativa: "Ok", erro_em_cascata: false, status: "atendido", confianca: "alta" },
        { criterio_id: "c3", evidencia_literal: "logo dobra", justificativa: "Ok", erro_em_cascata: false, status: "atendido", confianca: "alta" },
      ],
      penalidades: [],
      comentario_geral: "",
    };

    const res = calcularNotaDeterministica(rubricaGrupo, avaliacao, REGRAS_GLOBAIS_PADRAO);
    assert.equal(res.percentual, 100);
    assert.equal(res.nota, 1);
  });

  it("recalcula instantaneamente com overrides do professor sem alterar a avaliação original da IA", () => {
    const avaliacao: AvaliacaoIA = {
      metodo_alternativo_valido: false,
      criterios: [
        { criterio_id: "c1", evidencia_literal: "4/3", justificativa: "Ok", erro_em_cascata: false, status: "atendido", confianca: "alta" },
        { criterio_id: "c2", evidencia_literal: "", justificativa: "Faltou", erro_em_cascata: false, status: "nao_atendido", confianca: "baixa" },
        { criterio_id: "c3", evidencia_literal: "1/x -> 0", justificativa: "Ok", erro_em_cascata: false, status: "atendido", confianca: "alta" },
      ],
      penalidades: [
        { penalidade_id: "p1", evidencia_literal: "", justificativa: "Não usou", acionada: false, confianca: "alta" },
      ],
      comentario_geral: "Boa tentativa.",
    };

    const semOverride = calcularNotaDeterministica(rubricaCalculo, avaliacao, REGRAS_GLOBAIS_PADRAO);
    assert.equal(semOverride.percentual, 70);
    assert.equal(semOverride.precisa_revisao, true);

    const comOverride = calcularNotaDeterministica(rubricaCalculo, avaliacao, REGRAS_GLOBAIS_PADRAO, {
      criterios: { c2: "parcial" },
      comentario_professor: "Fatorou implicitamente no passo 2.",
    });
    assert.equal(comOverride.percentual, 85); // 50 + 15 + 20
    assert.equal(comOverride.precisa_revisao, false);
    assert.match(comOverride.comentario, /Fatorou implicitamente/);
  });

  it("rebaixa confiança para baixa se a IA alucinar evidencia_literal inexistente no texto do aluno", () => {
    const respostaAluno = "A aceleração é 5 m/s² porque dividi 10 por 2.";
    assert.equal(verificarEvidenciaLiteral("dividi 10 por 2", respostaAluno), true);
    assert.equal(verificarEvidenciaLiteral("apliquei a terceira lei de Newton", respostaAluno), false);

    const auditada = aplicarVerificacaoEvidencias(
      {
        metodo_alternativo_valido: false,
        criterios: [
          {
            criterio_id: "c1",
            evidencia_literal: "usou conservação de energia cinética",
            justificativa: "Alucinação",
            erro_em_cascata: false,
            status: "atendido",
            confianca: "alta",
          },
        ],
        penalidades: [],
        comentario_geral: "",
      },
      respostaAluno,
    );
    assert.equal(auditada.criterios[0].evidencia_verificada, false);
    assert.equal(auditada.criterios[0].confianca, "baixa");
  });

  it("normaliza rubrica v1 legada e fecha soma de pesos em 100%", () => {
    const v2 = normalizarRubrica([
      { criterio: "Identificou força resultante", pontos: 4 },
      { criterio: "Calculou aceleração corretamente", pontos: 6 },
    ]);
    assert.equal(v2.versao, 2);
    assert.equal(v2.positivos.length, 2);
    assert.equal(somaPesosPositivos(v2.positivos), 100);
    assert.equal(v2.positivos[0].peso, 40);
    assert.equal(v2.positivos[1].peso, 60);

    const ajustados = normalizarPesosPara100([
      { id: "c1", texto: "A", rotulo_falha: "Sem A", peso: 30 },
      { id: "c2", texto: "B", rotulo_falha: "Sem B", peso: 50 },
    ]);
    assert.equal(somaPesosPositivos(ajustados), 100);
  });

  it("simula cenários e detecta length giveaway em alternativas", () => {
    const sim = simularCenariosRubrica(rubricaCalculo, REGRAS_GLOBAIS_PADRAO);
    assert.equal(sim.acertoTotal, 10);
    assert.equal(sim.cenariosPenalidade[0].notaAcertandoTudo, 5);

    const enviesada = analisarComprimentoAlternativas([
      { texto: "Porque a força resultante nula implica ausência de aceleração, mantendo o corpo em repouso ou em movimento retilíneo uniforme conforme a Primeira Lei", correta: true },
      { texto: "Porque ele para sozinho", correta: false },
      { texto: "Porque a massa aumenta", correta: false },
      { texto: "Porque o peso zera", correta: false },
    ]);
    assert.equal(enviesada.alerta, true);
  });
});
