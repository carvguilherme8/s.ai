import "server-only";
import { Type } from "@google/genai";
import { gerarComFallback } from "@/lib/material-ia";
import {
  normalizarPesosPara100,
  type CriterioPositivo,
  type RegraPenalidade,
  type RubricaV2,
} from "@/lib/nota-rubrica";

export type TopicoAlvo = { id: string; nome: string; descricao: string | null };
export type TrechoRef = { ordem: number; pagina: number | null; conteudo: string };

export type QuestaoGerada = {
  topico_id: string;
  tipo: "multipla_escolha" | "dissertativa";
  enunciado: string;
  trecho_ordem: number | null;
  alternativas: { texto: string; correta: boolean; equivoco: string | null }[];
  rubrica: RubricaV2 | null;
};

type RubricaGeradaBruta = {
  resolucao_modelo?: string;
  positivos?: { texto: string; rotulo_falha: string; peso: number }[];
  penalidades?: {
    texto: string;
    equivoco: string;
    modo: "desconto" | "teto";
    valor: number;
    ignora_etapas_intermediarias?: boolean;
  }[];
};

function criarSchema(comMaterial: boolean) {
  return {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        tipo: { type: Type.STRING, enum: ["multipla_escolha", "dissertativa"] },
        enunciado: { type: Type.STRING },
        ...(comMaterial
          ? { trecho_ordem: { type: Type.INTEGER, description: "Número do trecho do material que fundamenta a questão." } }
          : {}),
        alternativas: {
          type: Type.ARRAY,
          description: "Só para múltipla escolha: exatamente 4 alternativas com comprimentos parecidos, 1 correta.",
          items: {
            type: Type.OBJECT,
            properties: {
              texto: { type: Type.STRING },
              correta: { type: Type.BOOLEAN },
              equivoco: {
                type: Type.STRING,
                description: "Distrator: o erro conceitual que leva o aluno a escolhê-lo. Vazio na correta.",
              },
            },
            required: ["texto", "correta"],
          },
        },
        rubrica: {
          type: Type.OBJECT,
          description: "Só para dissertativa: critérios modulares (pílulas) somando 100% + sugestões de penalidade.",
          properties: {
            resolucao_modelo: {
              type: Type.STRING,
              description: "Resposta esperada concisa que serve de referência para o professor.",
            },
            positivos: {
              type: Type.ARRAY,
              description: "3 a 4 critérios objetivos e verificáveis cuja soma dos pesos é exatamente 100.",
              items: {
                type: Type.OBJECT,
                properties: {
                  texto: { type: Type.STRING, description: "O que o aluno precisa demonstrar (curto, cabe numa pílula)." },
                  rotulo_falha: {
                    type: Type.STRING,
                    description: "Frase curta de diagnóstico quando o aluno falha neste critério (ex.: 'Não fatorou x em evidência').",
                  },
                  peso: { type: Type.INTEGER, description: "Percentual positivo (ex.: 50, 30, 20). Soma deve fechar 100." },
                },
                required: ["texto", "rotulo_falha", "peso"],
              },
            },
            penalidades: {
              type: Type.ARRAY,
              description: "1 a 2 armadilhas, erros graves ou métodos não permitidos comuns nesta questão (sugestões opcionais).",
              items: {
                type: Type.OBJECT,
                properties: {
                  texto: { type: Type.STRING, description: "Descrição curta da penalidade (ex.: 'Usou método avançado não dado')." },
                  equivoco: { type: Type.STRING, description: "Equívoco conceitual registrado no Diagnóstico." },
                  modo: {
                    type: Type.STRING,
                    enum: ["desconto", "teto"],
                    description: "Use 'teto' para método proibido/fuga parcial; 'desconto' para omissão pontual (ex.: sem unidade).",
                  },
                  valor: { type: Type.INTEGER, description: "Percentual (0..100): quanto desconta ou qual o teto máximo." },
                  ignora_etapas_intermediarias: {
                    type: Type.BOOLEAN,
                    description: "True quando modo='teto' por método proibido, para evitar dupla penalização.",
                  },
                },
                required: ["texto", "equivoco", "modo", "valor"],
              },
            },
          },
          required: ["resolucao_modelo", "positivos"],
        },
      },
      required: comMaterial ? ["tipo", "enunciado", "trecho_ordem"] : ["tipo", "enunciado"],
    },
  };
}

function normalizarRubricaGerada(bruta?: RubricaGeradaBruta | null): RubricaV2 | null {
  if (!bruta?.positivos?.length) return null;
  const positivosBrutos: CriterioPositivo[] = bruta.positivos
    .filter((c) => c.texto?.trim())
    .slice(0, 6)
    .map((c, i) => ({
      id: `c${i + 1}`,
      texto: c.texto.trim(),
      rotulo_falha: c.rotulo_falha?.trim() || `Não atingiu: ${c.texto.trim()}`,
      peso: Math.max(5, Math.round(Number(c.peso) || 25)),
      grupo_id: null,
      aceita_parcial: true,
    }));
  if (!positivosBrutos.length) return null;

  const positivos = normalizarPesosPara100(positivosBrutos);
  const penalidades: RegraPenalidade[] = (bruta.penalidades ?? [])
    .filter((p) => p.texto?.trim())
    .slice(0, 3)
    .map((p, i) => ({
      id: `p${i + 1}`,
      texto: p.texto.trim(),
      equivoco: p.equivoco?.trim() || p.texto.trim(),
      modo: p.modo === "teto" ? "teto" : "desconto",
      valor: Math.min(100, Math.max(5, Math.round(Number(p.valor) || 25))),
      ignora_etapas_intermediarias: p.modo === "teto" ? Boolean(p.ignora_etapas_intermediarias ?? true) : false,
      // Sugestões nascem inativas (pílulas tracejadas no editor) para a professora ativar com 1 clique.
      ativa: false,
    }));

  return {
    versao: 2,
    resolucao_modelo: bruta.resolucao_modelo?.trim() || null,
    positivos,
    penalidades,
  };
}

/**
 * Gera as Questões de UM Tópico, a partir dos trechos de um Material ou apenas pelo tema/tópico
 * (quando `trechos` está vazio).
 */
export async function gerarQuestoesDoTopico(
  topico: TopicoAlvo,
  trechos: TrechoRef[],
  nMultiplaEscolha: number,
  nDissertativas: number,
  /** Equívocos frequentes da turma neste tópico: as questões de reforço devem testá-los. */
  focoEquivocos: string[] = [],
  /** Orientações extras opcionais do professor (útil na geração por tema sem material). */
  orientacoes?: string | null,
): Promise<QuestaoGerada[]> {
  const comMaterial = trechos.length > 0;
  const material = comMaterial
    ? trechos
        .map((t) => `[trecho ${t.ordem}${t.pagina ? `, página ${t.pagina}` : ""}]\n${t.conteudo}`)
        .join("\n\n")
        .slice(0, 60_000)
    : "";

  const pedido = [
    nMultiplaEscolha > 0 && `${nMultiplaEscolha} questão(ões) de múltipla escolha`,
    nDissertativas > 0 && `${nDissertativas} questão(ões) dissertativa(s)`,
  ]
    .filter(Boolean)
    .join(" e ");

  const res = await gerarComFallback({
    contents:
      `Você elabora questões no estilo ENEM para o ensino médio, em português do Brasil.\n` +
      `Tópico: "${topico.nome}"${topico.descricao ? ` — ${topico.descricao}` : ""}.\n` +
      (comMaterial
        ? `Crie ${pedido}, baseadas SOMENTE no material abaixo.\n\n`
        : `Crie ${pedido}, adequadas ao ensino médio público e ao ENEM, cobrindo conceitos essenciais desse tema.\n\n`) +
      `Regras:\n` +
      `- Múltipla escolha: exatamente 4 alternativas, só 1 correta. Mantenha todas as 4 alternativas com tamanho e nível de detalhe parecidos (NUNCA deixe a correta visivelmente mais longa que as erradas). Cada alternativa errada (distrator) deve refletir um erro conceitual real e comum; descreva-o em "equivoco" (ex.: "Confunde massa com peso").\n` +
      `- Dissertativa: inclua "rubrica" com "resolucao_modelo", 3 a 4 critérios "positivos" atômicos e verificáveis (soma dos pesos = 100, cada um com "rotulo_falha" curto para diagnóstico) e 1 a 2 sugestões de "penalidades" comuns nessa questão (ex.: método não ensinado com modo "teto", ou erro pontual com modo "desconto").\n` +
      `- Enunciados autocontidos, claros e contextualizados, sem referenciar "o texto" ou "o material".\n` +
      (comMaterial ? `- "trecho_ordem": número do trecho que fundamenta a questão.\n` : ``) +
      (orientacoes?.trim() ? `- Orientações adicionais do professor: ${orientacoes.trim().slice(0, 500)}\n` : ``) +
      (focoEquivocos.length
        ? `- Esta é uma atividade de REFORÇO. A turma tem estas dificuldades frequentes neste tópico: ` +
          `${focoEquivocos.map((e) => `"${e}"`).join("; ")}. Cada questão deve ter pelo menos um distrator que represente ` +
          `um desses equívocos (repita o texto do equívoco, ou algo muito próximo, no campo "equivoco") e deve levar o aluno ` +
          `a superá-lo. Varie as situações; não repita enunciados óbvios.\n`
        : ``) +
      (comMaterial ? `\n--- MATERIAL ---\n${material}` : ``),
    config: {
      responseMimeType: "application/json",
      responseSchema: criarSchema(comMaterial),
      abortSignal: AbortSignal.timeout(120_000),
    },
  });

  type ItemBruto = {
    tipo: "multipla_escolha" | "dissertativa";
    enunciado?: string;
    trecho_ordem?: number;
    alternativas?: { texto: string; correta: boolean; equivoco?: string | null }[];
    rubrica?: RubricaGeradaBruta | null;
  };

  const bruto = JSON.parse(res.text ?? "[]") as ItemBruto[];
  const validas: QuestaoGerada[] = [];
  for (const q of bruto) {
    const enunciado = q.enunciado?.trim();
    if (!enunciado) continue;
    const trechoOrdem = comMaterial && typeof q.trecho_ordem === "number" ? q.trecho_ordem : null;
    if (q.tipo === "multipla_escolha") {
      const alts = (q.alternativas ?? []).map((a) => ({
        texto: a.texto?.trim() ?? "",
        correta: Boolean(a.correta),
        equivoco: a.correta ? null : (a.equivoco?.trim() || null),
      }));
      const corretas = alts.filter((a) => a.correta).length;
      if (alts.length < 2 || corretas !== 1) continue;
      if (alts.some((a) => !a.texto || (!a.correta && !a.equivoco))) continue;
      validas.push({
        topico_id: topico.id,
        tipo: "multipla_escolha",
        enunciado,
        trecho_ordem: trechoOrdem,
        alternativas: alts,
        rubrica: null,
      });
    } else if (q.tipo === "dissertativa") {
      const rubrica = normalizarRubricaGerada(q.rubrica);
      if (!rubrica) continue;
      validas.push({
        topico_id: topico.id,
        tipo: "dissertativa",
        enunciado,
        trecho_ordem: trechoOrdem,
        alternativas: [],
        rubrica,
      });
    }
  }
  return validas;
}
