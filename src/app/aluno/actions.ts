"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiConfigurado } from "@/lib/material-ia";
import { processarCorrecaoAssincronaEntrega } from "@/lib/processar-entrega";
import type { Json } from "@/lib/supabase/database.types";

export type EstadoForm = { erro?: string } | undefined;

const MIN_DISSERTATIVA = 10;

export type TelemetriaResposta = {
  paste_events: number;
  paste_chars: number;
  total_chars: number;
  tempo_segundos: number;
  sinal_cola: boolean;
};

function parseTelemetria(bruto: FormDataEntryValue | null, textoFinal: string): TelemetriaResposta | null {
  if (!bruto || typeof bruto !== "string") return null;
  try {
    const j = JSON.parse(bruto) as Partial<TelemetriaResposta>;
    const pasteEvents = Math.max(0, Math.round(Number(j.paste_events) || 0));
    const pasteChars = Math.max(0, Math.round(Number(j.paste_chars) || 0));
    const totalChars = textoFinal.length;
    const tempoSegundos = Math.max(0, Math.round(Number(j.tempo_segundos) || 0));
    const razaoCola = totalChars > 0 ? pasteChars / totalChars : 0;
    // Sinal conservador (informativo, nunca punitivo): colou >= 70% de um texto substancial muito rápido.
    const sinalCola = pasteChars >= 80 && razaoCola >= 0.7 && tempoSegundos < 35;
    return {
      paste_events: pasteEvents,
      paste_chars: pasteChars,
      total_chars: totalChars,
      tempo_segundos: tempoSegundos,
      sinal_cola: sinalCola,
    };
  } catch {
    return null;
  }
}

export async function enviarEntrega(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const sessao = await getSessao();
  if (!sessao || sessao.profile.papel !== "aluno") return { erro: "Entre como aluno para responder." };
  const alunoId = sessao.user.id;
  const atividadeId = String(formData.get("atividade_id") ?? "");

  // Visibilidade e prazo via RLS (a atividade precisa estar publicada na turma do aluno).
  const { data: atividade } = await sessao.supabase
    .from("atividades")
    .select("id, prazo, material_id, revisar_antes_liberar")
    .eq("id", atividadeId)
    .maybeSingle();
  if (!atividade) return { erro: "Atividade não encontrada." };
  if (atividade.prazo && new Date(atividade.prazo) < new Date()) return { erro: "O prazo desta atividade já terminou." };

  const { data: jaEntregou } = await sessao.supabase
    .from("entregas").select("id").eq("atividade_id", atividadeId).eq("aluno_id", alunoId).maybeSingle();
  if (jaEntregou) redirect(`/aluno/atividades/${atividadeId}`);

  // Gabarito, rubrica e trechos só existem no servidor (admin ignora RLS).
  const admin = createAdminClient();
  const { data: questoes } = await admin
    .from("questoes")
    .select(
      `id, tipo, ordem, enunciado, rubrica, topico:topicos(nome), trecho:material_trechos(ordem, pagina, conteudo),
       alternativas(id, texto, correta, equivoco)`,
    )
    .eq("atividade_id", atividadeId)
    .order("ordem");
  if (!questoes?.length) return { erro: "Esta atividade não tem questões." };

  // Validação: a Entrega só vale completa (o Feedback depende disso).
  type RespostaParsed = { alternativaId: string | null; texto: string | null; telemetria: TelemetriaResposta | null };
  const respostas = new Map<string, RespostaParsed>();
  for (const q of questoes) {
    const valor = String(formData.get(`q_${q.id}`) ?? "").trim();
    if (q.tipo === "multipla_escolha") {
      if (!q.alternativas.some((a) => a.id === valor)) return { erro: "Responda todas as questões antes de enviar." };
      respostas.set(q.id, { alternativaId: valor, texto: null, telemetria: null });
    } else {
      if (valor.length < MIN_DISSERTATIVA) return { erro: "Responda todas as questões antes de enviar." };
      respostas.set(q.id, {
        alternativaId: null,
        texto: valor,
        telemetria: parseTelemetria(formData.get(`telemetria_${q.id}`), valor),
      });
    }
  }

  const temDissertativa = questoes.some((q) => q.tipo === "dissertativa");
  // Trava humana: se a professora pediu revisão prévia em atividade com dissertativa, liberada_em inicia null.
  const liberadaEm = atividade.revisar_antes_liberar && temDissertativa ? null : new Date().toISOString();

  const { data: entrega, error: erroEntrega } = await admin
    .from("entregas")
    .insert({ atividade_id: atividadeId, aluno_id: alunoId, liberada_em: liberadaEm })
    .select("id")
    .single();
  if (erroEntrega) {
    if (erroEntrega.code === "23505") redirect(`/aluno/atividades/${atividadeId}`);
    console.error("enviarEntrega:", erroEntrega);
    return { erro: "Não foi possível enviar. Tente novamente." };
  }

  // Passo síncrono (<300ms): corrige TODAS as objetivas imediatamente e grava dissertativas como pendentes.
  // Nunca bloqueia a entrega do aluno mesmo se a Gemini API estiver offline ou sem chave configurada!
  const linhasRespostas: {
    entrega_id: string;
    questao_id: string;
    alternativa_id: string | null;
    texto: string | null;
    nota_ia: number | null;
    correcao: Json;
    telemetria: Json | null;
  }[] = [];

  const itensFeedbackInicial: {
    questao_id: string;
    nota: number | null;
    explicacao: string | null;
    revisar: { pagina: number; trecho: string | null } | null;
  }[] = [];
  const topicosErrados = new Set<string>();
  let precisaEnriquecerIA = temDissertativa;

  for (const q of questoes) {
    const r = respostas.get(q.id)!;
    const pagina = q.trecho?.pagina ?? null;
    const trecho = q.trecho?.conteudo
      ? q.trecho.conteudo.replace(/^\s*\[página \d+\]\s*/, "").slice(0, 280)
      : null;

    if (q.tipo === "multipla_escolha") {
      const escolhida = q.alternativas.find((a) => a.id === r.alternativaId)!;
      const correta = q.alternativas.find((a) => a.correta);
      const nota = escolhida.correta ? 1 : 0;
      const correcao = { correta: escolhida.correta, equivoco: escolhida.correta ? null : escolhida.equivoco };

      linhasRespostas.push({
        entrega_id: entrega.id,
        questao_id: q.id,
        alternativa_id: r.alternativaId,
        texto: null,
        nota_ia: nota,
        correcao: correcao as unknown as Json,
        telemetria: null,
      });

      let explicacaoPlanoB: string | null = null;
      if (nota < 1) {
        precisaEnriquecerIA = true;
        if (q.topico?.nome) topicosErrados.add(q.topico.nome);
        explicacaoPlanoB =
          `${escolhida.equivoco ? `A alternativa que você marcou costuma indicar este equívoco: ${escolhida.equivoco} ` : ""}` +
          (correta ? `A resposta correta era: ${correta.texto}` : "");
      }
      itensFeedbackInicial.push({
        questao_id: q.id,
        nota,
        explicacao: explicacaoPlanoB,
        revisar: nota < 1 && pagina !== null ? { pagina, trecho } : null,
      });
    } else {
      linhasRespostas.push({
        entrega_id: entrega.id,
        questao_id: q.id,
        alternativa_id: null,
        texto: r.texto,
        nota_ia: null,
        correcao: { pendente: true } as unknown as Json,
        telemetria: r.telemetria ? (r.telemetria as unknown as Json) : null,
      });
      itensFeedbackInicial.push({
        questao_id: q.id,
        nota: null,
        explicacao: null,
        revisar: null,
      });
    }
  }

  const { error: erroRespostas } = await admin.from("respostas").insert(linhasRespostas);
  if (erroRespostas) {
    console.error("enviarEntrega respostas:", erroRespostas);
    await admin.from("entregas").delete().eq("id", entrega.id);
    return { erro: "Não foi possível salvar suas respostas. Tente novamente." };
  }

  // Salva feedback inicial imediato (Plano B já pronto para objetivas).
  const resumoInicial =
    topicosErrados.size > 0
      ? `Vale revisar: ${[...topicosErrados].join("; ")}.`
      : temDissertativa
        ? null
        : "Parabéns! Você acertou tudo nesta atividade.";

  await admin
    .from("entregas")
    .update({ feedback: { resumo: resumoInicial, itens: itensFeedbackInicial } as unknown as Json })
    .eq("id", entrega.id);

  // Processamento assíncrono não-bloqueante (Next.js 16 `after`) para dissertativas e feedback IA.
  if (precisaEnriquecerIA && geminiConfigurado()) {
    after(async () => {
      await processarCorrecaoAssincronaEntrega(entrega.id);
    });
  }

  revalidatePath("/aluno");
  revalidatePath(`/aluno/atividades/${atividadeId}`);
  redirect(`/aluno/atividades/${atividadeId}`);
}
