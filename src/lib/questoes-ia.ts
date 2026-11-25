import "server-only";
import { Type } from "@google/genai";
import { gerarComFallback } from "@/lib/material-ia";

export type TopicoAlvo = { id: string; nome: string; descricao: string | null };
export type TrechoRef = { ordem: number; pagina: number | null; conteudo: string };

export type QuestaoGerada = {
  topico_id: string;
  tipo: "multipla_escolha" | "dissertativa";
  enunciado: string;
  trecho_ordem: number | null;
  alternativas: { texto: string; correta: boolean; equivoco: string | null }[];
  rubrica: { criterio: string; pontos: number }[] | null;
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
          description: "Só para múltipla escolha: exatamente 4 alternativas, 1 correta.",
          items: {
            type: Type.OBJECT,
            properties: {
              texto: { type: Type.STRING },
              correta: { type: Type.BOOLEAN },
              equivoco: { type: Type.STRING, description: "Distrator: o erro conceitual que leva o aluno a escolhê-lo. Vazio na correta." },
            },
            required: ["texto", "correta"],
          },
        },
        rubrica: {
          type: Type.ARRAY,
          description: "Só para dissertativa: de 2 a 4 critérios; a soma dos pontos deve ser 10.",
          items: {
            type: Type.OBJECT,
            properties: { criterio: { type: Type.STRING }, pontos: { type: Type.NUMBER } },
            required: ["criterio", "pontos"],
          },
        },
      },
      required: comMaterial ? ["tipo", "enunciado", "trecho_ordem"] : ["tipo", "enunciado"],
    },
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
  ].filter(Boolean).join(" e ");

  const res = await gerarComFallback({
    contents:
      `Você elabora questões no estilo ENEM para o ensino médio, em português do Brasil.\n` +
      `Tópico: "${topico.nome}"${topico.descricao ? ` — ${topico.descricao}` : ""}.\n` +
      (comMaterial
        ? `Crie ${pedido}, baseadas SOMENTE no material abaixo.\n\n`
        : `Crie ${pedido}, adequadas ao ensino médio público e ao ENEM, cobrindo conceitos essenciais desse tema.\n\n`) +
      `Regras:\n` +
      `- Múltipla escolha: exatamente 4 alternativas, só 1 correta. Cada alternativa errada (distrator) deve ` +
      `refletir um erro conceitual real e comum; descreva-o em "equivoco" (ex.: "Confunde massa com peso").\n` +
      `- Dissertativa: inclua "rubrica" com 2 a 4 critérios objetivos, somando 10 pontos.\n` +
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

  const bruto = JSON.parse(res.text ?? "[]") as Omit<QuestaoGerada, "topico_id">[];
  const validas: QuestaoGerada[] = [];
  for (const q of bruto) {
    const enunciado = q.enunciado?.trim();
    if (!enunciado) continue;
    const trechoOrdem = comMaterial && typeof q.trecho_ordem === "number" ? q.trecho_ordem : null;
    if (q.tipo === "multipla_escolha") {
      const alts = q.alternativas ?? [];
      const corretas = alts.filter((a) => a.correta).length;
      if (alts.length < 2 || corretas !== 1) continue;
      if (alts.some((a) => !a.correta && !a.equivoco?.trim())) continue;
      validas.push({ ...q, enunciado, trecho_ordem: trechoOrdem, topico_id: topico.id, rubrica: null });
    } else if (q.tipo === "dissertativa") {
      if (!q.rubrica?.length) continue;
      validas.push({ ...q, enunciado, trecho_ordem: trechoOrdem, topico_id: topico.id, alternativas: [] });
    }
  }
  return validas;
}
