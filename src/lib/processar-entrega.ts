import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiConfigurado } from "@/lib/material-ia";
import {
  corrigirDissertativa,
  gerarFeedback,
  type CorrecaoDissertativa,
  type ItemParaFeedback,
  type Rubrica,
} from "@/lib/correcao-ia";
import { normalizarRegrasGlobais } from "@/lib/nota-rubrica";
import { formatarTrechosParaPrompt, recuperarTrechosRelevantes } from "@/lib/rag";
import type { TrechoRef } from "@/lib/questoes-ia";
import type { Json } from "@/lib/supabase/database.types";

/**
 * Executa em background (via `after()` no Next.js 16) a correção por IA das dissertativas pendentes
 * e o enriquecimento do feedback da entrega. Totalmente idempotente e resiliente a falhas de cota/rede.
 */
export async function processarCorrecaoAssincronaEntrega(entregaId: string) {
  if (!geminiConfigurado()) return;

  const admin = createAdminClient();
  const { data: entrega } = await admin
    .from("entregas")
    .select("id, atividade_id, atividade:atividades(id, material_id, regras_globais)")
    .eq("id", entregaId)
    .maybeSingle();
  if (!entrega?.atividade) return;

  const [{ data: questoes }, { data: respostas }] = await Promise.all([
    admin
      .from("questoes")
      .select(
        `id, tipo, ordem, enunciado, rubrica, topico:topicos(nome), trecho:material_trechos(ordem, pagina, conteudo),
         alternativas(id, texto, correta, equivoco)`,
      )
      .eq("atividade_id", entrega.atividade_id)
      .order("ordem"),
    admin
      .from("respostas")
      .select("id, questao_id, alternativa_id, texto, nota_ia, nota_ajustada, correcao")
      .eq("entrega_id", entrega.id),
  ]);
  if (!questoes?.length || !respostas?.length) return;

  const respPorQuestao = new Map(respostas.map((r) => [r.questao_id, r]));
  const regrasGlobais = normalizarRegrasGlobais(entrega.atividade.regras_globais);
  const materialId = entrega.atividade.material_id;

  // 1. Corrige em paralelo todas as dissertativas ainda pendentes
  const correcoesNovas = new Map<string, CorrecaoDissertativa>();
  await Promise.all(
    questoes
      .filter((q) => {
        if (q.tipo !== "dissertativa") return false;
        const r = respPorQuestao.get(q.id);
        return r && r.nota_ia === null && Boolean(r.texto?.trim());
      })
      .map(async (q) => {
        const r = respPorQuestao.get(q.id)!;
        try {
          let referencia = q.trecho?.conteudo ?? "";
          if (!referencia && materialId) {
            const encontrados = await recuperarTrechosRelevantes(
              admin,
              materialId,
              `${q.topico?.nome ?? ""} ${q.enunciado}`,
              { limite: 2 },
            );
            referencia = formatarTrechosParaPrompt(encontrados);
          }
          const c = await corrigirDissertativa(
            q.enunciado,
            q.rubrica as Rubrica,
            r.texto!,
            referencia,
            { regrasGlobais },
          );
          correcoesNovas.set(q.id, c);
          await admin
            .from("respostas")
            .update({ nota_ia: c.nota, correcao: c as unknown as Json })
            .eq("id", r.id)
            .is("nota_ia", null);
        } catch (e) {
          console.error("processarCorrecaoAssincronaEntrega dissertativa:", e);
        }
      }),
  );

  // 2. Monta itens para feedback personalizado (objetivas erradas + dissertativas parciais/erradas)
  const paraFeedback: ItemParaFeedback[] = [];
  const meta = new Map<string, { nota: number | null; pagina: number | null; trecho: string | null }>();

  for (const q of questoes) {
    const r = respPorQuestao.get(q.id);
    if (!r) continue;
    const nova = correcoesNovas.get(q.id);
    const nota = r.nota_ajustada ?? nova?.nota ?? r.nota_ia;

    if (q.tipo === "multipla_escolha") {
      const escolhida = q.alternativas.find((a) => a.id === r.alternativa_id);
      const correta = q.alternativas.find((a) => a.correta);
      if (nota !== null && nota < 1 && escolhida) {
        paraFeedback.push({
          questao_id: q.id,
          topico: q.topico?.nome ?? "",
          enunciado: q.enunciado,
          resposta_aluno: escolhida.texto,
          resposta_correta: correta?.texto ?? null,
          equivoco: escolhida.equivoco,
          comentario_correcao: null,
        });
      }
    } else if (nova && nova.nota < 1) {
      paraFeedback.push({
        questao_id: q.id,
        topico: q.topico?.nome ?? "",
        enunciado: q.enunciado,
        resposta_aluno: r.texto ?? "",
        resposta_correta: null,
        equivoco: nova.falhas_diagnostico[0] ?? null,
        comentario_correcao: nova.criterios.map((x) => `${x.criterio}: ${x.obtidos}/${x.pontos}. ${x.comentario}`).join(" "),
      });
    }

    meta.set(q.id, {
      nota,
      pagina: q.trecho?.pagina ?? null,
      trecho: q.trecho?.conteudo ? q.trecho.conteudo.replace(/^\s*\[página \d+\]\s*/, "").slice(0, 280) : null,
    });
  }

  let resumo: string | null = null;
  const explicacoes = new Map<string, string>();

  if (paraFeedback.length) {
    try {
      let contextoMaterial = "";
      if (materialId) {
        const idsErradas = new Set(paraFeedback.map((it) => it.questao_id));
        const trechosLigados: TrechoRef[] = questoes
          .filter((q) => idsErradas.has(q.id) && q.trecho)
          .map((q) => ({ ordem: q.trecho!.ordem, pagina: q.trecho!.pagina, conteudo: q.trecho!.conteudo }));

        const consultaFeedback = paraFeedback
          .map((it) => `${it.topico}: ${it.equivoco ?? it.enunciado.slice(0, 200)}`)
          .join("\n");
        const trechosRag = await recuperarTrechosRelevantes(admin, materialId, consultaFeedback, { limite: 5 });
        contextoMaterial = formatarTrechosParaPrompt([...trechosLigados, ...trechosRag]);

        if (!contextoMaterial) {
          contextoMaterial =
            (await admin.from("materiais").select("conteudo_texto").eq("id", materialId).maybeSingle()).data
              ?.conteudo_texto ?? "";
        }
      }
      const fb = await gerarFeedback(paraFeedback, contextoMaterial);
      resumo = fb.resumo ?? null;
      fb.itens?.forEach((i) => explicacoes.set(i.questao_id, i.explicacao));
    } catch (e) {
      console.error("processarCorrecaoAssincronaEntrega feedback:", e);
    }
  } else {
    const algumaPendente = questoes.some((q) => (meta.get(q.id)?.nota ?? null) === null);
    resumo = algumaPendente ? null : "Parabéns! Você acertou tudo nesta atividade.";
  }

  // Plano B sem IA caso alguma explicação falhe
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
      const m = meta.get(q.id) ?? { nota: null, pagina: null, trecho: null };
      const precisaRevisar = m.nota !== null && m.nota < 1;
      return {
        questao_id: q.id,
        nota: m.nota,
        explicacao: explicacoes.get(q.id) ?? null,
        revisar: precisaRevisar && m.pagina !== null ? { pagina: m.pagina, trecho: m.trecho } : null,
      };
    }),
  };

  await admin.from("entregas").update({ feedback: feedback as unknown as Json }).eq("id", entrega.id);
}
