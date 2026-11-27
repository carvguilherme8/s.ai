/**
 * Motor determinístico de avaliação por blocos (Rubrica v2) — 100% puro e compartilhável entre
 * servidor e interface. O LLM nunca calcula nota: ele apenas verifica evidências por critério;
 * toda a aritmética (pesos, grupos exclusivos, erro em cascata, descontos, tetos, piso/teto e
 * overrides do professor) acontece aqui.
 */

export type RubricaV1Item = { criterio: string; pontos: number };
export type RubricaV1 = RubricaV1Item[];

export type CriterioPositivo = {
  id: string;
  texto: string;
  /** Descrição da lacuna quando o aluno não atinge este critério (alimenta o Diagnóstico). */
  rotulo_falha: string;
  /** Peso percentual positivo (ex.: 50 para +50%). A soma recomendada dos positivos é 100. */
  peso: number;
  /** Critérios com o mesmo `grupo_id` são mutuamente exclusivos (pontua apenas o melhor). */
  grupo_id?: string | null;
  /** Se false, status "parcial" vale 0 em vez de 50% do peso. Padrão: true. */
  aceita_parcial?: boolean;
  /** IDs de critérios anteriores dos quais este passo depende (referência para ECF). */
  depende_de?: string[];
};

export type ModoPenalidade = "desconto" | "teto";

export type RegraPenalidade = {
  id: string;
  texto: string;
  /** Equívoco conceitual ou método inadequado registrado no Diagnóstico quando acionada. */
  equivoco: string;
  /** "desconto" subtrai `valor` pontos percentuais; "teto" limita a nota máxima a `valor`%. */
  modo: ModoPenalidade;
  /** Percentual entre 0 e 100 (desconto a subtrair ou teto máximo permitido). */
  valor: number;
  /**
   * Em regras de método proibido com `modo: "teto"`, evita dupla penalização: se o aluno acertou
   * parte da questão (ex.: resultado final) pelo método proibido e perdeu etapas intermediárias
   * específicas do método esperado, garante que o teto seja o limite e não some perdas duplicadas.
   */
  ignora_etapas_intermediarias?: boolean;
  /** `false` indica sugestão da IA ainda inativa (pílula tracejada no editor). Padrão: true. */
  ativa?: boolean;
};

export type MetodoProibidoGlobal = {
  descricao: string;
  modo: ModoPenalidade;
  valor: number;
};

export type RegrasGlobaisProva = {
  aceitar_erro_em_cascata: boolean;
  /** Fração do peso concedida a uma etapa correta baseada em erro anterior (0..1). Padrão: 1.0. */
  fator_ecf?: number;
  aceitar_metodo_equivalente: boolean;
  ignorar_ortografia?: boolean;
  metodo_proibido?: MetodoProibidoGlobal | null;
};

export type ExemploCalibracao = {
  id: string;
  nivel: "forte" | "media" | "fraca";
  resposta: string;
  /** Nota esperada pelo professor em escala 0..10. */
  nota_esperada: number;
  comentario_professor?: string;
};

export type RubricaV2 = {
  versao: 2;
  resolucao_modelo?: string | null;
  positivos: CriterioPositivo[];
  penalidades: RegraPenalidade[];
  regras_override?: Partial<RegrasGlobaisProva>;
  exemplos_calibracao?: ExemploCalibracao[];
};

export type RubricaQualquer = RubricaV1 | RubricaV2;

export type StatusCriterio = "atendido" | "parcial" | "nao_atendido";
export type ConfiancaIA = "alta" | "media" | "baixa";

export type AvaliacaoCriterioIA = {
  criterio_id: string;
  evidencia_literal: string;
  justificativa: string;
  erro_em_cascata: boolean;
  valor_carregado?: string;
  status: StatusCriterio;
  confianca: ConfiancaIA;
  evidencia_verificada?: boolean;
};

export type AvaliacaoPenalidadeIA = {
  penalidade_id: string;
  evidencia_literal: string;
  justificativa: string;
  acionada: boolean;
  confianca: ConfiancaIA;
  evidencia_verificada?: boolean;
};

export type AvaliacaoIA = {
  metodo_alternativo_valido: boolean;
  criterios: AvaliacaoCriterioIA[];
  penalidades: AvaliacaoPenalidadeIA[];
  comentario_geral: string;
};

export type OverridesProfessor = {
  criterios?: Record<string, StatusCriterio>;
  penalidades?: Record<string, boolean>;
  comentario_professor?: string | null;
};

export type CriterioLegado = {
  criterio: string;
  pontos: number;
  obtidos: number;
  comentario: string;
};

export type CorrecaoDissertativaV2 = {
  versao: 2;
  avaliacao_ia: AvaliacaoIA;
  overrides_professor?: OverridesProfessor;
  nota: number; // 0..1
  percentual: number; // 0..100
  precisa_revisao: boolean;
  motivos_revisao: string[];
  falhas_diagnostico: string[];
  teto_aplicado: number | null;
  /** Projeção retrocompatível com telas v1 (lista de critérios + comentário). */
  criterios: CriterioLegado[];
  comentario: string;
};

export const REGRAS_GLOBAIS_PADRAO: RegrasGlobaisProva = {
  aceitar_erro_em_cascata: true,
  fator_ecf: 1.0,
  aceitar_metodo_equivalente: true,
  ignorar_ortografia: false,
  metodo_proibido: null,
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

const round1 = (v: number) => Math.round(v * 10) / 10;

export function ehRubricaV2(raw: unknown): raw is RubricaV2 {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !Array.isArray(raw) &&
    (raw as { versao?: unknown }).versao === 2 &&
    Array.isArray((raw as { positivos?: unknown }).positivos)
  );
}

export function normalizarRegrasGlobais(raw: unknown): RegrasGlobaisProva {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...REGRAS_GLOBAIS_PADRAO };
  }
  const obj = raw as Partial<RegrasGlobaisProva>;
  const mp = obj.metodo_proibido;
  const metodoProibido: MetodoProibidoGlobal | null =
    mp && typeof mp === "object" && typeof mp.descricao === "string" && mp.descricao.trim()
      ? {
          descricao: mp.descricao.trim(),
          modo: mp.modo === "desconto" ? "desconto" : "teto",
          valor: clamp(Number(mp.valor ?? 50), 0, 100),
        }
      : null;

  return {
    aceitar_erro_em_cascata: obj.aceitar_erro_em_cascata ?? REGRAS_GLOBAIS_PADRAO.aceitar_erro_em_cascata,
    fator_ecf: clamp(Number(obj.fator_ecf ?? REGRAS_GLOBAIS_PADRAO.fator_ecf), 0, 1),
    aceitar_metodo_equivalente: obj.aceitar_metodo_equivalente ?? REGRAS_GLOBAIS_PADRAO.aceitar_metodo_equivalente,
    ignorar_ortografia: Boolean(obj.ignorar_ortografia),
    metodo_proibido: metodoProibido,
  };
}

/**
 * Converte qualquer rubrica (v1 legado `{ criterio, pontos }[]` ou v2 parcial) para uma `RubricaV2`
 * válida, garantindo IDs estáveis e pesos positivos coerentes.
 */
export function normalizarRubrica(raw: unknown): RubricaV2 {
  if (ehRubricaV2(raw)) {
    const positivos: CriterioPositivo[] = raw.positivos
      .filter((c) => c && typeof c.texto === "string" && c.texto.trim())
      .map((c, i) => ({
        id: c.id?.trim() || `c${i + 1}`,
        texto: c.texto.trim(),
        rotulo_falha: c.rotulo_falha?.trim() || `Não atingiu: ${c.texto.trim()}`,
        peso: Math.max(0, Number(c.peso) || 0),
        grupo_id: c.grupo_id?.trim() || null,
        aceita_parcial: c.aceita_parcial !== false,
        depende_de: Array.isArray(c.depende_de) ? c.depende_de.filter(Boolean) : undefined,
      }));
    const penalidades: RegraPenalidade[] = (raw.penalidades ?? [])
      .filter((p) => p && typeof p.texto === "string" && p.texto.trim())
      .map((p, i) => ({
        id: p.id?.trim() || `p${i + 1}`,
        texto: p.texto.trim(),
        equivoco: p.equivoco?.trim() || p.texto.trim(),
        modo: p.modo === "teto" ? "teto" : "desconto",
        valor: clamp(Number(p.valor) || 0, 0, 100),
        ignora_etapas_intermediarias: Boolean(p.ignora_etapas_intermediarias),
        ativa: p.ativa !== false,
      }));
    return {
      versao: 2,
      resolucao_modelo: raw.resolucao_modelo ?? null,
      positivos,
      penalidades,
      regras_override: raw.regras_override,
      exemplos_calibracao: Array.isArray(raw.exemplos_calibracao) ? raw.exemplos_calibracao : undefined,
    };
  }

  // Retrocompatibilidade: Rubrica v1 = [{ criterio, pontos }]
  const lista = Array.isArray(raw) ? (raw as RubricaV1Item[]) : [];
  const validos = lista.filter((r) => r && typeof r.criterio === "string" && r.criterio.trim());
  const soma = validos.reduce((s, r) => s + Math.max(0, Number(r.pontos) || 0), 0) || validos.length || 1;

  const positivos: CriterioPositivo[] = validos.map((r, i) => {
    const pesoBruto = Math.max(0, Number(r.pontos) || 0);
    const pesoPct = Math.round((pesoBruto / soma) * 100);
    return {
      id: `c${i + 1}`,
      texto: r.criterio.trim(),
      rotulo_falha: `Não atingiu: ${r.criterio.trim()}`,
      peso: pesoPct,
      grupo_id: null,
      aceita_parcial: true,
    };
  });

  // Ajusta arredondamento de 1–2% no último item para fechar exatamente 100%
  if (positivos.length > 0) {
    const somaAtual = positivos.reduce((s, c) => s + c.peso, 0);
    if (somaAtual > 0 && somaAtual !== 100) {
      positivos[positivos.length - 1].peso = Math.max(1, positivos[positivos.length - 1].peso + (100 - somaAtual));
    }
  }

  return {
    versao: 2,
    resolucao_modelo: null,
    positivos,
    penalidades: [],
  };
}

/** Soma efetiva dos pesos positivos: cada `grupo_id` exclusivo contribui com o maior peso do grupo. */
export function somaPesosPositivos(positivos: CriterioPositivo[]): number {
  const maxPorGrupo = new Map<string, number>();
  let livres = 0;
  for (const c of positivos) {
    const w = Math.max(0, Number(c.peso) || 0);
    if (c.grupo_id) {
      maxPorGrupo.set(c.grupo_id, Math.max(maxPorGrupo.get(c.grupo_id) ?? 0, w));
    } else {
      livres += w;
    }
  }
  const somaGrupos = [...maxPorGrupo.values()].reduce((a, b) => a + b, 0);
  return round1(livres + somaGrupos);
}

/** Redistribui os pesos dos critérios positivos (sem grupo exclusivo) para fechar exatamente 100%. */
export function normalizarPesosPara100(positivos: CriterioPositivo[]): CriterioPositivo[] {
  if (!positivos.length) return [];
  const total = somaPesosPositivos(positivos);
  if (total <= 0) {
    const base = Math.floor(100 / positivos.length);
    const resto = 100 - base * positivos.length;
    return positivos.map((c, i) => ({ ...c, peso: base + (i === 0 ? resto : 0) }));
  }

  const escalados = positivos.map((c) => ({
    ...c,
    peso: Math.max(1, Math.round((Math.max(0, c.peso) / total) * 100)),
  }));
  const novaSoma = somaPesosPositivos(escalados);
  const diff = Math.round(100 - novaSoma);
  if (diff !== 0) {
    // Aplica o ajuste de arredondamento no critério livre de maior peso (ou no primeiro).
    const alvoIdx = escalados.reduce(
      (best, c, idx) => (!c.grupo_id && c.peso > (escalados[best]?.peso ?? -1) ? idx : best),
      0,
    );
    escalados[alvoIdx] = { ...escalados[alvoIdx], peso: Math.max(1, escalados[alvoIdx].peso + diff) };
  }
  return escalados;
}

/** Retorna a lista efetiva de penalidades ativas, mesclando penalidades da questão + regra global de método proibido. */
export function penalidadesEfetivas(
  rubrica: RubricaV2,
  regrasGlobais: RegrasGlobaisProva,
): RegraPenalidade[] {
  const regras = { ...regrasGlobais, ...rubrica.regras_override };
  const ativas = rubrica.penalidades.filter((p) => p.ativa !== false);
  const mp = regras.metodo_proibido;
  if (mp && mp.descricao.trim()) {
    const jaExiste = ativas.some(
      (p) => p.id === "p_global_metodo" || p.texto.toLowerCase() === mp.descricao.trim().toLowerCase(),
    );
    if (!jaExiste) {
      ativas.push({
        id: "p_global_metodo",
        texto: `Usou método proibido: ${mp.descricao.trim()}`,
        equivoco: `Recorreu a método não permitido (${mp.descricao.trim()})`,
        modo: mp.modo,
        valor: clamp(mp.valor, 0, 100),
        ignora_etapas_intermediarias: mp.modo === "teto",
        ativa: true,
      });
    }
  }
  return ativas;
}

function normalizarTextoComparacao(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9=+\-*/^().\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifica no servidor se o trecho citado pela IA (`evidencia_literal`) realmente aparece
 * na resposta do aluno (evita alucinação de evidência).
 */
export function verificarEvidenciaLiteral(evidencia: string, respostaAluno: string): boolean {
  const ev = normalizarTextoComparacao(evidencia);
  if (!ev) return false;
  const resp = normalizarTextoComparacao(respostaAluno);
  if (!resp) return false;

  // 1. Substring exata (após normalização)
  if (resp.includes(ev)) return true;

  // 2. Overlap de tokens (permite pequenas variações de pontuação/espaçamento em fórmulas)
  const tokensEv = ev.split(" ").filter((t) => t.length >= 2);
  if (!tokensEv.length) return resp.includes(ev);
  const tokensResp = new Set(resp.split(" ").filter(Boolean));
  let encontrados = 0;
  for (const t of tokensEv) {
    if (tokensResp.has(t) || resp.includes(t)) encontrados++;
  }
  return encontrados / tokensEv.length >= 0.65;
}

/**
 * Audita todas as evidências literais retornadas pelo Gemini contra a resposta real do aluno.
 * Se a IA marcar um critério como `atendido`/`parcial` ou acionar penalidade citando texto
 * inexistente na resposta do aluno, rebaixa `confianca` para `"baixa"`.
 */
export function aplicarVerificacaoEvidencias(avaliacao: AvaliacaoIA, respostaAluno: string): AvaliacaoIA {
  return {
    ...avaliacao,
    criterios: avaliacao.criterios.map((c) => {
      const precisaEvidencia = c.status !== "nao_atendido";
      const ok = !precisaEvidencia || verificarEvidenciaLiteral(c.evidencia_literal, respostaAluno);
      return {
        ...c,
        evidencia_verificada: ok,
        confianca: ok ? c.confianca : "baixa",
      };
    }),
    penalidades: avaliacao.penalidades.map((p) => {
      const ok = !p.acionada || verificarEvidenciaLiteral(p.evidencia_literal, respostaAluno);
      return {
        ...p,
        evidencia_verificada: ok,
        confianca: ok ? p.confianca : "baixa",
      };
    }),
  };
}

/**
 * Calcula a nota final de forma 100% determinística a partir da Rubrica v2, da avaliação por
 * critérios retornada pelo LLM, das regras globais da prova e de eventuais overrides do professor.
 */
export function calcularNotaDeterministica(
  rubricaInput: RubricaQualquer,
  avaliacao: AvaliacaoIA,
  regrasGlobaisInput?: Partial<RegrasGlobaisProva> | null,
  overrides?: OverridesProfessor,
): CorrecaoDissertativaV2 {
  const rubrica = normalizarRubrica(rubricaInput);
  const regrasBase = normalizarRegrasGlobais(regrasGlobaisInput);
  const regras: RegrasGlobaisProva = { ...regrasBase, ...rubrica.regras_override };
  const penalidadesAtivas = penalidadesEfetivas(rubrica, regras);

  const avCritPorId = new Map(avaliacao.criterios.map((c) => [c.criterio_id, c]));
  const avPenPorId = new Map(avaliacao.penalidades.map((p) => [p.penalidade_id, p]));

  const somaPesos = somaPesosPositivos(rubrica.positivos) || 100;
  const fatorEcf = clamp(regras.fator_ecf ?? 1.0, 0, 1);

  const motivosRevisao: string[] = [];
  const falhasDiagnostico: string[] = [];
  const criteriosLegados: CriterioLegado[] = [];

  // 1. Avaliar penalidades ativas
  let totalDesconto = 0;
  let menorTeto: number | null = null;
  let ignoraEtapasPorTeto = false;

  for (const pen of penalidadesAtivas) {
    const av = avPenPorId.get(pen.id);
    const temOverride = overrides?.penalidades?.[pen.id] !== undefined;
    const acionada = temOverride ? Boolean(overrides!.penalidades![pen.id]) : Boolean(av?.acionada);

    if (!temOverride && av?.confianca === "baixa") {
      motivosRevisao.push(
        av.evidencia_verificada === false
          ? `Evidência não confirmada na penalidade "${pen.texto}"`
          : `Baixa confiança na penalidade "${pen.texto}"`,
      );
    }

    if (!acionada) continue;
    falhasDiagnostico.push(pen.equivoco || pen.texto);

    if (pen.modo === "desconto") {
      totalDesconto += clamp(pen.valor, 0, 100);
    } else {
      const teto = clamp(pen.valor, 0, 100);
      menorTeto = menorTeto === null ? teto : Math.min(menorTeto, teto);
      if (pen.ignora_etapas_intermediarias) ignoraEtapasPorTeto = true;
    }
  }

  // 2. Avaliar critérios positivos (com grupos exclusivos + Error Carried Forward)
  const melhorPorGrupo = new Map<string, number>();
  let pontosLivres = 0;

  for (const crit of rubrica.positivos) {
    const av = avCritPorId.get(crit.id);
    const temOverride = overrides?.criterios?.[crit.id] !== undefined;
    const status: StatusCriterio = temOverride ? overrides!.criterios![crit.id] : (av?.status ?? "nao_atendido");
    const ecf = !temOverride && Boolean(av?.erro_em_cascata);

    if (!temOverride && av?.confianca === "baixa") {
      motivosRevisao.push(
        av.evidencia_verificada === false
          ? `Evidência não confirmada em "${crit.texto}"`
          : `Baixa confiança em "${crit.texto}"`,
      );
    }

    let multiplicador = 0;
    if (status === "atendido") {
      multiplicador = 1;
    } else if (status === "parcial") {
      multiplicador = crit.aceita_parcial === false ? 0 : 0.5;
    } else if (ecf && regras.aceitar_erro_em_cascata) {
      multiplicador = fatorEcf;
      motivosRevisao.push(`Erro em cascata (ECF) aplicado em "${crit.texto}"`);
    }

    if (multiplicador === 0 && !(ecf && regras.aceitar_erro_em_cascata)) {
      falhasDiagnostico.push(crit.rotulo_falha || `Não atingiu: ${crit.texto}`);
    }

    const obtidoPeso = Math.max(0, crit.peso) * multiplicador;
    if (crit.grupo_id) {
      melhorPorGrupo.set(crit.grupo_id, Math.max(melhorPorGrupo.get(crit.grupo_id) ?? 0, obtidoPeso));
    } else {
      pontosLivres += obtidoPeso;
    }

    // Projeção legada em escala proporcional a 10 pontos
    const pontosEscala10 = round1((Math.max(0, crit.peso) / somaPesos) * 10);
    const obtidosEscala10 = round1(pontosEscala10 * multiplicador);
    criteriosLegados.push({
      criterio: crit.texto,
      pontos: pontosEscala10,
      obtidos: obtidosEscala10,
      comentario:
        av?.justificativa ||
        (temOverride
          ? status === "atendido"
            ? "Critério confirmado pela professora."
            : status === "parcial"
              ? "Critério parcialmente atendido (ajuste docente)."
              : "Critério não atendido (ajuste docente)."
          : ""),
    });
  }

  const pontosGrupos = [...melhorPorGrupo.values()].reduce((a, b) => a + b, 0);
  let bruto = ((pontosLivres + pontosGrupos) / somaPesos) * 100;

  // 3. Caminho alternativo equivalente (quando permitido e sem penalidades) ou bypass de dupla penalização por teto
  if (
    regras.aceitar_metodo_equivalente &&
    avaliacao.metodo_alternativo_valido &&
    menorTeto === null &&
    totalDesconto === 0 &&
    !overrides?.criterios
  ) {
    bruto = 100;
    motivosRevisao.push("Resolvido por método alternativo equivalente — vale conferir");
  } else if (ignoraEtapasPorTeto && menorTeto !== null && bruto > 0) {
    // Evita dupla penalização: aluno acertou por método proibido (ex.: L'Hôpital -> +50% resultado, 0% etapas),
    // então o teto (ex.: 50%) representa o teto da questão, sem zerar por não ter usado o método esperado.
    bruto = Math.max(bruto, menorTeto);
  }

  // 4. Descontos aditivos + teto + piso [0, 100]
  let percentual = bruto - totalDesconto;
  if (menorTeto !== null) percentual = Math.min(percentual, menorTeto);
  percentual = clamp(round1(percentual), 0, 100);

  const comentarioFinal = overrides?.comentario_professor?.trim()
    ? `${overrides.comentario_professor.trim()}${avaliacao.comentario_geral ? `\n\nAvaliação inicial: ${avaliacao.comentario_geral}` : ""}`
    : avaliacao.comentario_geral;

  return {
    versao: 2,
    avaliacao_ia: avaliacao,
    overrides_professor: overrides,
    nota: Math.round((percentual / 100) * 1000) / 1000,
    percentual,
    precisa_revisao: motivosRevisao.length > 0,
    motivos_revisao: [...new Set(motivosRevisao)],
    falhas_diagnostico: [...new Set(falhasDiagnostico)],
    teto_aplicado: menorTeto,
    criterios: criteriosLegados,
    comentario: comentarioFinal,
  };
}

export type SimulacaoRubrica = {
  acertoTotal: number; // 0..10
  somaPositivos: number; // %
  cenariosPenalidade: { id: string; texto: string; notaAcertandoTudo: number; modo: ModoPenalidade; valor: number }[];
};

/** Simulador leve para o Editor de Pílulas: mostra em 1 linha o impacto de cada penalidade/teto. */
export function simularCenariosRubrica(
  rubrica: RubricaV2,
  regrasGlobais?: Partial<RegrasGlobaisProva> | null,
): SimulacaoRubrica {
  const somaPositivos = somaPesosPositivos(rubrica.positivos);
  const regras = normalizarRegrasGlobais(regrasGlobais);
  const ativas = penalidadesEfetivas(rubrica, regras);

  const todosAtendidos: AvaliacaoCriterioIA[] = rubrica.positivos.map((c) => ({
    criterio_id: c.id,
    evidencia_literal: "",
    justificativa: "",
    erro_em_cascata: false,
    status: "atendido",
    confianca: "alta",
  }));

  const base = calcularNotaDeterministica(
    rubrica,
    { metodo_alternativo_valido: false, criterios: todosAtendidos, penalidades: [], comentario_geral: "" },
    regras,
  );

  const cenariosPenalidade = ativas.map((p) => {
    const res = calcularNotaDeterministica(
      rubrica,
      {
        metodo_alternativo_valido: false,
        criterios: todosAtendidos,
        penalidades: [{ penalidade_id: p.id, evidencia_literal: "", justificativa: "", acionada: true, confianca: "alta" }],
        comentario_geral: "",
      },
      regras,
    );
    return {
      id: p.id,
      texto: p.texto,
      notaAcertandoTudo: round1(res.percentual / 10),
      modo: p.modo,
      valor: p.valor,
    };
  });

  return {
    acertoTotal: round1(base.percentual / 10),
    somaPositivos,
    cenariosPenalidade,
  };
}

/**
 * Detecta o "length giveaway" clássico de LLMs em questões de múltipla escolha:
 * quando a alternativa correta é desproporcionalmente mais longa que os distratores.
 */
export function analisarComprimentoAlternativas(
  alternativas: { texto: string; correta: boolean }[],
): { alerta: boolean; razao: number; tamCorreta: number; mediaDistratores: number } {
  const correta = alternativas.find((a) => a.correta);
  const distratores = alternativas.filter((a) => !a.correta);
  if (!correta || !distratores.length) {
    return { alerta: false, razao: 1, tamCorreta: 0, mediaDistratores: 0 };
  }
  const tamCorreta = correta.texto.trim().length;
  const mediaDistratores =
    distratores.reduce((s, d) => s + d.texto.trim().length, 0) / distratores.length;
  const razao = mediaDistratores > 0 ? tamCorreta / mediaDistratores : 1;
  const alerta = razao >= 1.6 && tamCorreta - mediaDistratores >= 25;
  return {
    alerta,
    razao: Math.round(razao * 100) / 100,
    tamCorreta,
    mediaDistratores: Math.round(mediaDistratores),
  };
}

/** Extrai com segurança os rótulos de falha/equívoco gravados em `respostas.correcao` (v2). */
export function extrairFalhasDiagnostico(correcao: unknown): string[] {
  if (!correcao || typeof correcao !== "object" || Array.isArray(correcao)) return [];
  const raw = (correcao as { falhas_diagnostico?: unknown }).falhas_diagnostico;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}
