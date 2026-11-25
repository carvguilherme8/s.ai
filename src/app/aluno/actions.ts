"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessao } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiConfigurado } from "@/lib/material-ia";
import {
  corrigirDissertativa,
  gerarFeedback,
  type CorrecaoDissertativa,
  type ItemParaFeedback,
  type Rubrica,
} from "@/lib/correcao-ia";
import type { Json } from "@/lib/supabase/database.types";

export type EstadoForm = { erro?: string } | undefined;

const MIN_DISSERTATIVA = 10;

export async function enviarEntrega(_: EstadoForm, formData: FormData): Promise<EstadoForm> {
  const sessao = await getSessao();
  if (!sessao || sessao.profile.papel !== "aluno") return { erro: "Entre como aluno para responder." };
  const alunoId = sessao.user.id;
  const atividadeId = String(formData.get("atividade_id") ?? "");

  // Visibilidade e prazo via RLS (a atividade precisa estar publicada na turma do aluno).
  const { data: atividade } = await sessao.supabase
    .from("atividades").select("id, prazo").eq("id", atividadeId).maybeSingle();
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
      `id, tipo, ordem, enunciado, rubrica, topico:topicos(nome), trecho:material_trechos(pagina, conteudo),
       alternativas(id, texto, correta, equivoco)`,
    )
    .eq("atividade_id", atividadeId)
    .order("ordem");
  if (!questoes?.length) return { erro: "Esta atividade não tem questões." };

  // Validação: a Entrega só vale completa (o Feedback depende disso).
  type Resposta = { alternativaId: string | null; texto: string | null };
  const respostas = new Map<string, Resposta>();
  for (const q of questoes) {
    const valor = String(formData.get(`q_${q.id}`) ?? "").trim();
    if (q.tipo === "multipla_escolha") {
      if (!q.alternativas.some((a) => a.id === valor)) return { erro: "Responda todas as questões antes de enviar." };
      respostas.set(q.id, { alternativaId: valor, texto: null });
    } else {
      if (valor.length < MIN_DISSERTATIVA) return { erro: "Responda todas as questões antes de enviar." };
      respostas.set(q.id, { alternativaId: null, texto: valor });
    }
  }
  if (!geminiConfigurado()) return { erro: "A correção por IA não está configurada. Avise seu professor." };

  const { data: entrega, error: erroEntrega } = await admin
    .from("entregas").insert({ atividade_id: atividadeId, aluno_id: alunoId }).select("id").single();
  if (erroEntrega) {
    if (erroEntrega.code === "23505") redirect(`/aluno/atividades/${atividadeId}`);
    console.error("enviarEntrega:", erroEntrega);
    return { erro: "Não foi possível enviar. Tente novamente." };
  }

  // Correção: múltipla escolha é automática; dissertativas pela Rubrica (em paralelo).
  const correcoes = new Map<string, CorrecaoDissertativa | null>();
  await Promise.all(
    questoes.filter((q) => q.tipo === "dissertativa").map(async (q) => {
      try {
        correcoes.set(
          q.id,
          await corrigirDissertativa(q.enunciado, q.rubrica as Rubrica, respostas.get(q.id)!.texto!, q.trecho?.conteudo ?? ""),
        );
      } catch (e) {
        console.error("corrigirDissertativa:", e);
        correcoes.set(q.id, null);
      }
    }),
  );

  type Linha = { questaoId: string; nota: number | null; correcao: Json };
  const linhas: Linha[] = [];
  const paraFeedback: ItemParaFeedback[] = [];
  const meta = new Map<string, { nota: number | null; pagina: number | null; trecho: string | null }>();

  for (const q of questoes) {
    const r = respostas.get(q.id)!;
    let nota: number | null;
    let correcao: Json;
    if (q.tipo === "multipla_escolha") {
      const escolhida = q.alternativas.find((a) => a.id === r.alternativaId)!;
      const correta = q.alternativas.find((a) => a.correta);
      nota = escolhida.correta ? 1 : 0;
      correcao = { correta: escolhida.correta, equivoco: escolhida.correta ? null : escolhida.equivoco };
      if (nota < 1) {
        paraFeedback.push({
          questao_id: q.id, topico: q.topico?.nome ?? "", enunciado: q.enunciado,
          resposta_aluno: escolhida.texto, resposta_correta: correta?.texto ?? null,
          equivoco: escolhida.equivoco, comentario_correcao: null,
        });
      }
    } else {
      const c = correcoes.get(q.id) ?? null;
      nota = c?.nota ?? null;
      correcao = c ? (c as unknown as Json) : { pendente: true };
      if (c && c.nota < 1) {
        paraFeedback.push({
          questao_id: q.id, topico: q.topico?.nome ?? "", enunciado: q.enunciado,
          resposta_aluno: r.texto!, resposta_correta: null, equivoco: null,
          comentario_correcao: c.criterios.map((x) => `${x.criterio}: ${x.obtidos}/${x.pontos}. ${x.comentario}`).join(" "),
        });
      }
    }
    linhas.push({ questaoId: q.id, nota, correcao });
    meta.set(q.id, {
      nota,
      pagina: q.trecho?.pagina ?? null,
      trecho: q.trecho?.conteudo ? q.trecho.conteudo.replace(/^\s*\[página \d+\]\s*/, "").slice(0, 280) : null,
    });
  }

  const { error: erroRespostas } = await admin.from("respostas").insert(
    linhas.map((l) => ({
      entrega_id: entrega.id,
      questao_id: l.questaoId,
      alternativa_id: respostas.get(l.questaoId)!.alternativaId,
      texto: respostas.get(l.questaoId)!.texto,
      nota_ia: l.nota,
      correcao: l.correcao,
    })),
  );
  if (erroRespostas) {
    console.error("enviarEntrega respostas:", erroRespostas);
    await admin.from("entregas").delete().eq("id", entrega.id);
    return { erro: "Não foi possível salvar suas respostas. Tente novamente." };
  }

  // Feedback: gerado uma vez e guardado (cache). Se a IA falhar, a Entrega continua válida.
  let resumo: string | null = null;
  const explicacoes = new Map<string, string>();
  if (paraFeedback.length) {
    try {
      const material = (
        await admin.from("atividades").select("material:materiais(conteudo_texto)").eq("id", atividadeId).single()
      ).data?.material?.conteudo_texto ?? "";
      const fb = await gerarFeedback(paraFeedback, material);
      resumo = fb.resumo ?? null;
      fb.itens?.forEach((i) => explicacoes.set(i.questao_id, i.explicacao));
    } catch (e) {
      console.error("gerarFeedback:", e);
    }
  } else {
    resumo = "Parabéns! Você acertou tudo nesta atividade.";
  }

  // Plano B sem IA (cota esgotada, falha de rede): usa o Equívoco do distrator e o tópico.
  for (const it of paraFeedback) {
    if (explicacoes.has(it.questao_id)) continue;
    if (it.resposta_correta) {
      explicacoes.set(
        it.questao_id,
        `${it.equivoco ? `A alternativa que você marcou costuma indicar este equívoco: ${it.equivoco} ` : ""}` +
          `A resposta correta era: ${it.resposta_correta}`,
      );
    }
  }
  if (!resumo && paraFeedback.length) {
    const topicos = [...new Set(paraFeedback.map((it) => it.topico).filter(Boolean))];
    resumo = `Vale revisar: ${topicos.join("; ")}.`;
  }

  const feedback = {
    resumo,
    itens: questoes.map((q) => {
      const m = meta.get(q.id)!;
      const precisaRevisar = m.nota !== null && m.nota < 1;
      return {
        questao_id: q.id,
        nota: m.nota,
        explicacao: explicacoes.get(q.id) ?? null,
        revisar: precisaRevisar && m.pagina !== null ? { pagina: m.pagina, trecho: m.trecho } : null,
      };
    }),
  };
  await admin.from("entregas").update({ feedback }).eq("id", entrega.id);

  revalidatePath("/aluno");
  redirect(`/aluno/atividades/${atividadeId}`);
}
