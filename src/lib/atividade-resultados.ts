import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizarRegrasGlobais,
  normalizarRubrica,
  type CorrecaoDissertativaV2,
  type RegrasGlobaisProva,
  type RubricaV2,
} from "@/lib/nota-rubrica";
import { extrairCorrecaoV2, type TelemetriaResumo } from "@/lib/revisao-dissertativas";

const LETRAS = "ABCDEFGH";
const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export type RespostaAlunoNaQuestao = {
  respostaId: string;
  entregaId: string;
  alunoId: string;
  alunoNome: string;
  nota: number | null; // 0..1
  notaIa: number | null;
  notaAjustada: number | null;
  pendente: boolean;
  texto: string | null;
  alternativaId: string | null;
  alternativaLetra: string | null;
  alternativaTexto: string | null;
  alternativaCorreta: boolean | null;
  equivoco: string | null;
  revisadaEm: string | null;
  aguardandoLiberacao: boolean;
  desconsiderada: boolean;
  telemetria: TelemetriaResumo | null;
  correcaoV2: CorrecaoDissertativaV2 | null;
};

export type DistribuicaoAlternativa = {
  id: string;
  letra: string;
  texto: string;
  correta: boolean;
  equivoco: string | null;
  alunos: string[];
};

export type QuestaoResultados = {
  questaoId: string;
  ordem: number;
  tipo: "multipla_escolha" | "dissertativa";
  enunciado: string;
  topicoNome: string;
  mediaQuestao: number | null; // 0..1
  respondidas: number;
  pendentes: number;
  rubrica: RubricaV2 | null;
  regrasGlobais: RegrasGlobaisProva;
  respostas: RespostaAlunoNaQuestao[];
  distribuicao: DistribuicaoAlternativa[];
};

export type LinhaAlunoProva = {
  alunoId: string;
  nome: string;
  entregou: boolean;
  enviadaEm: string | null;
  aguardandoLiberacao: boolean;
  desconsiderada: boolean;
  temPendente: boolean;
  notaFinal: number | null; // 0..1
  mediaObjetivas: number | null;
  acertosObj: number;
  totalObj: number;
  mediaDissertativas: number | null;
  notasPorQuestao: Record<string, { nota: number | null; pendente: boolean }>;
};

export type ResultadosAtividade = {
  resumo: {
    totalAlunos: number;
    totalEntregas: number;
    mediaGeral: number | null;
    mediaObjetivas: number | null;
    mediaDissertativas: number | null;
    totalObjetivas: number;
    totalDissertativas: number;
    pendentes: number;
    naoLiberadas: number;
  };
  alunos: LinhaAlunoProva[];
  porQuestao: QuestaoResultados[];
};

/** Consolida todas as notas e respostas de TODOS os alunos de uma única atividade (prova). */
export async function resultadosDaAtividade(
  professorId: string,
  atividadeId: string,
): Promise<ResultadosAtividade | null> {
  const db = createAdminClient();

  const { data: atividade } = await db
    .from("atividades")
    .select(
      `id, turma_id, regras_globais, revisar_antes_liberar,
       questoes(id, tipo, ordem, enunciado, rubrica, topico:topicos(nome),
         alternativas(id, ordem, texto, correta, equivoco))`,
    )
    .eq("id", atividadeId)
    .eq("professor_id", professorId)
    .maybeSingle();

  if (!atividade) return null;

  const [{ data: alunosDb }, { data: entregasDb }] = await Promise.all([
    db
      .from("profiles")
      .select("id, nome")
      .eq("papel", "aluno")
      .eq("turma_id", atividade.turma_id)
      .order("nome"),
    db
      .from("entregas")
      .select("id, aluno_id, enviada_em, liberada_em, desconsiderar_diagnostico")
      .eq("atividade_id", atividadeId),
  ]);

  const entregaIds = (entregasDb ?? []).map((e) => e.id);
  const { data: respostasDb } = entregaIds.length
    ? await db
        .from("respostas")
        .select("id, entrega_id, questao_id, alternativa_id, texto, nota_ia, nota_ajustada, correcao, telemetria, revisada_em")
        .in("entrega_id", entregaIds)
    : { data: [] };

  const regrasGlobais = normalizarRegrasGlobais(atividade.regras_globais);
  const questoes = [...atividade.questoes].sort((a, b) => a.ordem - b.ordem);
  const entregaPorAluno = new Map((entregasDb ?? []).map((e) => [e.aluno_id, e]));
  const entregaPorId = new Map((entregasDb ?? []).map((e) => [e.id, e]));
  const nomeAlunoPorId = new Map((alunosDb ?? []).map((a) => [a.id, a.nome.replace(" (fictício)", "")]));

  const respPorEntregaQuestao = new Map<string, NonNullable<typeof respostasDb>[number]>();
  for (const r of respostasDb ?? []) {
    respPorEntregaQuestao.set(`${r.entrega_id}|${r.questao_id}`, r);
  }

  const totalObjetivas = questoes.filter((q) => q.tipo === "multipla_escolha").length;
  const totalDissertativas = questoes.filter((q) => q.tipo === "dissertativa").length;

  let pendentesGeral = 0;
  let naoLiberadas = 0;

  // 1. Consolidado por aluno (todos os alunos da turma)
  const alunos: LinhaAlunoProva[] = (alunosDb ?? []).map((a) => {
    const entrega = entregaPorAluno.get(a.id);
    const nome = a.nome.replace(" (fictício)", "");
    if (!entrega) {
      return {
        alunoId: a.id,
        nome,
        entregou: false,
        enviadaEm: null,
        aguardandoLiberacao: false,
        desconsiderada: false,
        temPendente: false,
        notaFinal: null,
        mediaObjetivas: null,
        acertosObj: 0,
        totalObj: totalObjetivas,
        mediaDissertativas: null,
        notasPorQuestao: {},
      };
    }

    const aguardandoLiberacao = Boolean(atividade.revisar_antes_liberar && !entrega.liberada_em);
    if (aguardandoLiberacao) naoLiberadas++;

    const notasTodas: number[] = [];
    const notasObj: number[] = [];
    const notasDiss: number[] = [];
    let acertosObj = 0;
    let temPendente = false;
    const notasPorQuestao: Record<string, { nota: number | null; pendente: boolean }> = {};

    for (const q of questoes) {
      const r = respPorEntregaQuestao.get(`${entrega.id}|${q.id}`);
      const nota = r ? (r.nota_ajustada !== null ? Number(r.nota_ajustada) : r.nota_ia !== null ? Number(r.nota_ia) : null) : null;
      const pendente = Boolean(r && q.tipo === "dissertativa" && nota === null);
      if (pendente) {
        temPendente = true;
        pendentesGeral++;
      }
      notasPorQuestao[q.id] = { nota, pendente };
      if (nota !== null) {
        notasTodas.push(nota);
        if (q.tipo === "multipla_escolha") {
          notasObj.push(nota);
          if (nota >= 1) acertosObj++;
        } else {
          notasDiss.push(nota);
        }
      }
    }

    return {
      alunoId: a.id,
      nome,
      entregou: true,
      enviadaEm: entrega.enviada_em,
      aguardandoLiberacao,
      desconsiderada: Boolean(entrega.desconsiderar_diagnostico),
      temPendente,
      notaFinal: media(notasTodas),
      mediaObjetivas: media(notasObj),
      acertosObj,
      totalObj: totalObjetivas,
      mediaDissertativas: media(notasDiss),
      notasPorQuestao,
    };
  });

  // Ordena: quem entregou primeiro (menor nota primeiro para atenção rápida), depois quem não entregou
  alunos.sort((a, b) => {
    if (a.entregou !== b.entregou) return a.entregou ? -1 : 1;
    return (a.notaFinal ?? 2) - (b.notaFinal ?? 2) || a.nome.localeCompare(b.nome, "pt-BR");
  });

  // 2. Consolidado por questão (respostas de todos os alunos lado a lado / no mesmo lugar)
  const porQuestao: QuestaoResultados[] = questoes.map((q) => {
    const alts = [...q.alternativas].sort((a, b) => a.ordem - b.ordem);
    const altMeta = new Map(alts.map((a, idx) => [a.id, { ...a, letra: LETRAS[idx] ?? String(idx + 1) }]));
    const alunosPorAlt = new Map<string, string[]>();
    for (const a of alts) alunosPorAlt.set(a.id, []);

    const minhasResp = (respostasDb ?? []).filter((r) => r.questao_id === q.id);
    const itens: RespostaAlunoNaQuestao[] = [];
    const notasValidas: number[] = [];
    let pendentesQ = 0;

    for (const r of minhasResp) {
      const entrega = entregaPorId.get(r.entrega_id);
      if (!entrega) continue;
      const alunoNome = nomeAlunoPorId.get(entrega.aluno_id) ?? "Aluno";
      const notaIa = r.nota_ia === null ? null : Number(r.nota_ia);
      const notaAjustada = r.nota_ajustada === null ? null : Number(r.nota_ajustada);
      const nota = notaAjustada ?? notaIa;
      const pendente = q.tipo === "dissertativa" && nota === null;
      const desconsiderada = Boolean(entrega.desconsiderar_diagnostico);

      if (pendente) pendentesQ++;
      if (nota !== null && !desconsiderada) notasValidas.push(nota);

      const alt = r.alternativa_id ? altMeta.get(r.alternativa_id) : undefined;
      if (alt) alunosPorAlt.get(alt.id)?.push(alunoNome);

      itens.push({
        respostaId: r.id,
        entregaId: r.entrega_id,
        alunoId: entrega.aluno_id,
        alunoNome,
        nota,
        notaIa,
        notaAjustada,
        pendente,
        texto: r.texto,
        alternativaId: r.alternativa_id,
        alternativaLetra: alt?.letra ?? null,
        alternativaTexto: alt?.texto ?? null,
        alternativaCorreta: alt?.correta ?? null,
        equivoco: alt && !alt.correta ? alt.equivoco : null,
        revisadaEm: r.revisada_em,
        aguardandoLiberacao: Boolean(atividade.revisar_antes_liberar && !entrega.liberada_em),
        desconsiderada,
        telemetria: (r.telemetria as TelemetriaResumo | null) ?? null,
        correcaoV2: extrairCorrecaoV2(r.correcao),
      });
    }

    // Ordena respostas: pendentes e sinalizadas primeiro, depois por nome
    itens.sort((a, b) => {
      const pA = a.pendente ? 0 : a.telemetria?.sinal_cola ? 1 : a.correcaoV2?.precisa_revisao && !a.revisadaEm ? 2 : 3;
      const pB = b.pendente ? 0 : b.telemetria?.sinal_cola ? 1 : b.correcaoV2?.precisa_revisao && !b.revisadaEm ? 2 : 3;
      return pA - pB || a.alunoNome.localeCompare(b.alunoNome, "pt-BR");
    });

    const distribuicao: DistribuicaoAlternativa[] = alts.map((a, idx) => ({
      id: a.id,
      letra: LETRAS[idx] ?? String(idx + 1),
      texto: a.texto,
      correta: a.correta,
      equivoco: a.equivoco,
      alunos: (alunosPorAlt.get(a.id) ?? []).sort((x, y) => x.localeCompare(y, "pt-BR")),
    }));

    return {
      questaoId: q.id,
      ordem: q.ordem,
      tipo: q.tipo,
      enunciado: q.enunciado,
      topicoNome: q.topico?.nome ?? "—",
      mediaQuestao: media(notasValidas),
      respondidas: itens.length,
      pendentes: pendentesQ,
      rubrica: q.tipo === "dissertativa" ? normalizarRubrica(q.rubrica) : null,
      regrasGlobais,
      respostas: itens,
      distribuicao,
    };
  });

  const validosParaMedia = alunos.filter((a) => a.entregou && !a.desconsiderada);
  const mediasGerais = validosParaMedia.map((a) => a.notaFinal).filter((n): n is number => n !== null);
  const mediasObj = validosParaMedia.map((a) => a.mediaObjetivas).filter((n): n is number => n !== null);
  const mediasDiss = validosParaMedia.map((a) => a.mediaDissertativas).filter((n): n is number => n !== null);

  return {
    resumo: {
      totalAlunos: alunos.length,
      totalEntregas: (entregasDb ?? []).length,
      mediaGeral: media(mediasGerais),
      mediaObjetivas: media(mediasObj),
      mediaDissertativas: media(mediasDiss),
      totalObjetivas,
      totalDissertativas,
      pendentes: pendentesGeral,
      naoLiberadas,
    },
    alunos,
    porQuestao,
  };
}
