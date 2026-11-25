"use server";

import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { getSessao } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiConfigurado } from "@/lib/material-ia";
import { gerarQuestoesDoTopico, type TrechoRef } from "@/lib/questoes-ia";
import { gerarFeedback, type ItemParaFeedback } from "@/lib/correcao-ia";
import { formatarTrechosParaPrompt, recuperarTrechosRelevantes } from "@/lib/rag";

const QUESTOES_PRATICA = 3;
const VALIDADE_TOKEN_MS = 4 * 60 * 60 * 1000;

export type QuestaoPraticaPublica = {
  id: string;
  enunciado: string;
  alternativas: { id: string; texto: string }[];
};

export type SessaoReforco = {
  token: string;
  questoes: QuestaoPraticaPublica[];
};

export type ResultadoQuestaoReforco = {
  id: string;
  enunciado: string;
  acertou: boolean;
  escolhidaId: string;
  corretaId: string;
  alternativas: { id: string; texto: string; correta: boolean }[];
  explicacao: string | null;
  revisar: { pagina: number; trecho: string | null } | null;
};

export type ResultadoReforco = {
  acertos: number;
  total: number;
  resumo: string;
  materialId: string | null;
  itens: ResultadoQuestaoReforco[];
};

export type EstadoGeracao = { erro?: string; sessao?: SessaoReforco } | undefined;
export type EstadoCorrecao = { erro?: string; resultado?: ResultadoReforco } | undefined;

type GabaritoAssinado = {
  alunoId: string;
  topicoId: string;
  topicoNome: string;
  materialId: string | null;
  exp: number;
  questoes: {
    id: string;
    enunciado: string;
    corretaId: string;
    pagina: number | null;
    trecho: string | null;
    alternativas: { id: string; texto: string; correta: boolean; equivoco: string | null }[];
  }[];
};

function segredoAssinatura() {
  const chave = process.env.SUPABASE_SECRET_KEY;
  if (!chave) throw new Error("SUPABASE_SECRET_KEY não configurada.");
  return chave;
}

function assinarGabarito(payload: GabaritoAssinado): string {
  const corpo = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", segredoAssinatura()).update(corpo).digest("base64url");
  return `${corpo}.${sig}`;
}

function verificarGabarito(token: string): GabaritoAssinado | null {
  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [corpo, sig] = partes;
  const esperada = createHmac("sha256", segredoAssinatura()).update(corpo).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as GabaritoAssinado;
  } catch {
    return null;
  }
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Gera uma sessão de reforço individual (3 questões de múltipla escolha) sobre um Tópico da turma
 * do aluno, mirando os equívocos do próprio aluno. Não grava em entregas/respostas e não entra no Diagnóstico.
 */
export async function gerarReforcoIndividual(_: EstadoGeracao, formData: FormData): Promise<EstadoGeracao> {
  const sessao = await getSessao();
  if (!sessao || sessao.profile.papel !== "aluno") return { erro: "Entre como aluno para praticar." };
  if (!geminiConfigurado()) return { erro: "A geração por IA não está configurada agora." };

  const topicoId = String(formData.get("topico_id") ?? "");
  if (!topicoId) return { erro: "Tópico inválido." };

  // RLS garante que o aluno só enxerga tópicos confirmados de atividades publicadas na sua turma.
  const { data: topico } = await sessao.supabase
    .from("topicos")
    .select("id, nome, descricao, material_id")
    .eq("id", topicoId)
    .maybeSingle();
  if (!topico) return { erro: "Este tópico não está disponível para a sua turma." };

  // Equívocos mais frequentes DESTE aluno nesse tópico (RLS já filtra para o próprio aluno).
  const { data: respostas } = await sessao.supabase
    .from("respostas")
    .select("questao:questoes(topico_id), alternativa:alternativas(correta, equivoco)");
  const contagem = new Map<string, number>();
  for (const r of respostas ?? []) {
    if (r.questao?.topico_id !== topicoId) continue;
    const eq = r.alternativa && !r.alternativa.correta ? r.alternativa.equivoco : null;
    if (eq) contagem.set(eq, (contagem.get(eq) ?? 0) + 1);
  }
  const equivocosDoAluno = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([eq]) => eq);

  const admin = createAdminClient();
  let trechosTodos: TrechoRef[] = [];
  let relevantes: TrechoRef[] = [];
  if (topico.material_id) {
    const { data } = await admin
      .from("material_trechos")
      .select("ordem, pagina, conteudo")
      .eq("material_id", topico.material_id)
      .order("ordem");
    trechosTodos = data ?? [];
    if (trechosTodos.length) {
      const consulta =
        `${topico.nome}${topico.descricao ? `: ${topico.descricao}` : ""}` +
        (equivocosDoAluno.length ? ` Dificuldades do aluno: ${equivocosDoAluno.join("; ")}` : "");
      relevantes = await recuperarTrechosRelevantes(admin, topico.material_id, consulta, {
        limite: 5,
        fallback: trechosTodos,
      });
    }
  }

  let geradas;
  try {
    geradas = await gerarQuestoesDoTopico(topico, relevantes, QUESTOES_PRATICA, 0, equivocosDoAluno);
  } catch (e) {
    console.error("gerarReforcoIndividual:", e);
    return { erro: "A IA não respondeu agora (cota ou rede). Tente novamente em instantes." };
  }
  if (!geradas.length) return { erro: "Não foi possível gerar questões de prática agora. Tente novamente." };

  const trechoPorOrdem = new Map(trechosTodos.map((t) => [t.ordem, t]));
  const questoesPublicas: QuestaoPraticaPublica[] = [];
  const questoesPrivadas: GabaritoAssinado["questoes"] = [];

  for (const [i, q] of geradas.slice(0, QUESTOES_PRATICA).entries()) {
    const qid = `q${i}`;
    const alts = embaralhar(q.alternativas).map((a, j) => ({
      id: `a${j}`,
      texto: a.texto,
      correta: a.correta,
      equivoco: a.correta ? null : a.equivoco,
    }));
    const correta = alts.find((a) => a.correta);
    if (!correta) continue;
    const trecho = q.trecho_ordem != null ? trechoPorOrdem.get(q.trecho_ordem) : null;

    questoesPublicas.push({
      id: qid,
      enunciado: q.enunciado,
      alternativas: alts.map((a) => ({ id: a.id, texto: a.texto })),
    });
    questoesPrivadas.push({
      id: qid,
      enunciado: q.enunciado,
      corretaId: correta.id,
      pagina: trecho?.pagina ?? null,
      trecho: trecho?.conteudo ? trecho.conteudo.replace(/^\s*\[página \d+\]\s*/, "").slice(0, 280) : null,
      alternativas: alts,
    });
  }

  if (!questoesPublicas.length) return { erro: "Não foi possível montar as questões. Tente novamente." };

  const token = assinarGabarito({
    alunoId: sessao.user.id,
    topicoId: topico.id,
    topicoNome: topico.nome,
    materialId: topico.material_id,
    exp: Date.now() + VALIDADE_TOKEN_MS,
    questoes: questoesPrivadas,
  });

  return { sessao: { token, questoes: questoesPublicas } };
}

/**
 * Corrige a sessão de reforço individual do aluno após ele responder todas as questões.
 * Não altera o banco nem o Diagnóstico; gera feedback (com plano B sem IA).
 */
export async function corrigirReforcoIndividual(_: EstadoCorrecao, formData: FormData): Promise<EstadoCorrecao> {
  const sessao = await getSessao();
  if (!sessao || sessao.profile.papel !== "aluno") return { erro: "Entre como aluno para corrigir." };

  const token = String(formData.get("token") ?? "");
  const gabarito = verificarGabarito(token);
  if (!gabarito || gabarito.alunoId !== sessao.user.id) {
    return { erro: "Sessão de prática inválida. Gere novas questões." };
  }
  if (Date.now() > gabarito.exp) {
    return { erro: "Esta sessão de prática expirou. Gere novas questões." };
  }

  const escolhidas = new Map<string, string>();
  for (const q of gabarito.questoes) {
    const altId = String(formData.get(`r_${q.id}`) ?? "");
    if (!q.alternativas.some((a) => a.id === altId)) {
      return { erro: "Responda todas as questões antes de conferir o resultado." };
    }
    escolhidas.set(q.id, altId);
  }

  const paraFeedback: ItemParaFeedback[] = [];
  let acertos = 0;

  for (const q of gabarito.questoes) {
    const escolhidaId = escolhidas.get(q.id)!;
    const escolhida = q.alternativas.find((a) => a.id === escolhidaId)!;
    const correta = q.alternativas.find((a) => a.id === q.corretaId)!;
    if (escolhida.correta) {
      acertos++;
    } else {
      paraFeedback.push({
        questao_id: q.id,
        topico: gabarito.topicoNome,
        enunciado: q.enunciado,
        resposta_aluno: escolhida.texto,
        resposta_correta: correta.texto,
        equivoco: escolhida.equivoco,
        comentario_correcao: null,
      });
    }
  }

  let resumo = "";
  const explicacoes = new Map<string, string>();

  if (paraFeedback.length && geminiConfigurado()) {
    try {
      let contexto = "";
      if (gabarito.materialId) {
        const admin = createAdminClient();
        const consulta = paraFeedback.map((it) => `${it.topico}: ${it.equivoco ?? it.enunciado.slice(0, 180)}`).join("\n");
        const trechosRag = await recuperarTrechosRelevantes(admin, gabarito.materialId, consulta, { limite: 4 });
        contexto = formatarTrechosParaPrompt(trechosRag);
      }
      const fb = await gerarFeedback(paraFeedback, contexto);
      resumo = fb.resumo ?? "";
      fb.itens?.forEach((i) => explicacoes.set(i.questao_id, i.explicacao));
    } catch (e) {
      console.error("corrigirReforcoIndividual feedback:", e);
    }
  }

  // Plano B sem IA (garante explicação útil mesmo sem cota).
  for (const it of paraFeedback) {
    if (explicacoes.has(it.questao_id)) continue;
    explicacoes.set(
      it.questao_id,
      `${it.equivoco ? `A alternativa que você marcou costuma indicar este equívoco: ${it.equivoco} ` : ""}` +
        `A resposta correta era: ${it.resposta_correta}`,
    );
  }
  if (!resumo) {
    resumo =
      paraFeedback.length === 0
        ? `Mandou bem! Você acertou todas as questões de prática sobre ${gabarito.topicoNome}.`
        : `Bom treino! Revise as explicações abaixo sobre ${gabarito.topicoNome} e tente outra rodada quando quiser.`;
  }

  return {
    resultado: {
      acertos,
      total: gabarito.questoes.length,
      resumo,
      materialId: gabarito.materialId,
      itens: gabarito.questoes.map((q) => {
        const escolhidaId = escolhidas.get(q.id)!;
        const acertou = escolhidaId === q.corretaId;
        return {
          id: q.id,
          enunciado: q.enunciado,
          acertou,
          escolhidaId,
          corretaId: q.corretaId,
          alternativas: q.alternativas.map((a) => ({ id: a.id, texto: a.texto, correta: a.correta })),
          explicacao: acertou ? null : (explicacoes.get(q.id) ?? null),
          revisar: !acertou && q.pagina !== null ? { pagina: q.pagina, trecho: q.trecho } : null,
        };
      }),
    },
  };
}
