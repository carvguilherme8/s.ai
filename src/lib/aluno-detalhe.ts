import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";
import {
  normalizarRegrasGlobais,
  normalizarRubrica,
  type CorrecaoDissertativaV2,
  type RegrasGlobaisProva,
  type RubricaV2,
} from "@/lib/nota-rubrica";
import { extrairCorrecaoV2, type TelemetriaResumo } from "@/lib/revisao-dissertativas";

export type CriterioCorrecao = { criterio: string; pontos: number; obtidos: number; comentario: string };

export type ItemMultiplaEscolha = {
  tipo: "multipla_escolha";
  id: string;
  atividade: string;
  topicoId: string;
  topico: string;
  enunciado: string;
  acertou: boolean;
  escolhida: string;
  equivoco: string | null;
  correta: string;
};

export type ItemDissertativa = {
  tipo: "dissertativa";
  id: string;
  entregaId: string;
  atividade: string;
  topicoId: string;
  topico: string;
  enunciado: string;
  texto: string;
  notaIa: number | null;
  notaAjustada: number | null;
  pendente: boolean;
  revisadaEm: string | null;
  aguardandoLiberacao: boolean;
  desconsiderada: boolean;
  telemetria: TelemetriaResumo | null;
  rubrica: RubricaV2;
  regrasGlobais: RegrasGlobaisProva;
  correcaoV2: CorrecaoDissertativaV2 | null;
  criterios: CriterioCorrecao[];
  comentario: string | null;
};

export type DetalheAluno = {
  aluno: { id: string; nome: string };
  turma: { id: string; nome: string };
  entregas: number;
  porTopico: { topicoId: string; nome: string; dominio: number | null; respondidas: number; acertos: number; lacuna: boolean }[];
  equivocos: { topico: string; equivoco: string; vezes: number }[];
  erradas: ItemMultiplaEscolha[];
  dissertativas: ItemDissertativa[];
};

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Tudo o que a Professora precisa para entender um Aluno. Só devolve alunos das turmas dela. */
export async function detalheDoAluno(professorId: string, alunoId: string): Promise<DetalheAluno | null> {
  const db = createAdminClient();

  const { data: aluno } = await db
    .from("profiles")
    .select("id, nome, turma:turmas!profiles_turma_fk(id, nome, professor_id)")
    .eq("id", alunoId)
    .eq("papel", "aluno")
    .maybeSingle();
  if (!aluno || !aluno.turma || aluno.turma.professor_id !== professorId) return null;

  const { data: entregas } = await db
    .from("entregas")
    .select(
      "id, liberada_em, desconsiderar_diagnostico, atividade:atividades(titulo, professor_id, regras_globais, revisar_antes_liberar)",
    )
    .eq("aluno_id", alunoId);
  const minhas = (entregas ?? []).filter((e) => e.atividade?.professor_id === professorId);
  const entregaPorId = new Map(minhas.map((e) => [e.id, e]));

  const { data: respostas } = minhas.length
    ? await db
        .from("respostas")
        .select(
          `id, entrega_id, alternativa_id, texto, nota_ia, nota_ajustada, correcao, telemetria, revisada_em,
           questao:questoes(tipo, enunciado, rubrica, topico:topicos(id, nome), alternativas(id, texto, correta, equivoco))`,
        )
        .in("entrega_id", minhas.map((e) => e.id))
    : { data: [] };

  const notasPorTopico = new Map<string, { nome: string; notas: number[] }>();
  const equivocos = new Map<string, { topico: string; equivoco: string; vezes: number }>();
  const erradas: ItemMultiplaEscolha[] = [];
  const dissertativas: ItemDissertativa[] = [];

  for (const r of respostas ?? []) {
    const q = r.questao;
    if (!q?.topico) continue;
    const entrega = entregaPorId.get(r.entrega_id);
    const desconsiderada = Boolean(entrega?.desconsiderar_diagnostico);
    const nota = r.nota_ajustada ?? r.nota_ia;

    if (nota !== null && !desconsiderada) {
      const t =
        notasPorTopico.get(q.topico.id) ??
        notasPorTopico.set(q.topico.id, { nome: q.topico.nome, notas: [] }).get(q.topico.id)!;
      t.notas.push(Number(nota));
    }
    const atividade = entrega?.atividade?.titulo ?? "";

    if (q.tipo === "multipla_escolha") {
      const escolhida = q.alternativas.find((a) => a.id === r.alternativa_id);
      const correta = q.alternativas.find((a) => a.correta);
      if (!escolhida || !correta || escolhida.correta) continue;
      erradas.push({
        tipo: "multipla_escolha",
        id: r.id,
        atividade,
        topicoId: q.topico.id,
        topico: q.topico.nome,
        enunciado: q.enunciado,
        acertou: false,
        escolhida: escolhida.texto,
        equivoco: escolhida.equivoco,
        correta: correta.texto,
      });
      if (escolhida.equivoco && !desconsiderada) {
        const chave = `${q.topico.id}|${escolhida.equivoco}`;
        const e = equivocos.get(chave) ?? { topico: q.topico.nome, equivoco: escolhida.equivoco, vezes: 0 };
        e.vezes++;
        equivocos.set(chave, e);
      }
    } else {
      const correcaoV2 = extrairCorrecaoV2(r.correcao);
      const c = r.correcao as { criterios?: CriterioCorrecao[]; comentario?: string; pendente?: boolean } | null;
      if (correcaoV2 && !desconsiderada) {
        for (const falha of correcaoV2.falhas_diagnostico) {
          const chave = `${q.topico.id}|${falha}`;
          const e = equivocos.get(chave) ?? { topico: q.topico.nome, equivoco: falha, vezes: 0 };
          e.vezes++;
          equivocos.set(chave, e);
        }
      }
      dissertativas.push({
        tipo: "dissertativa",
        id: r.id,
        entregaId: r.entrega_id,
        atividade,
        topicoId: q.topico.id,
        topico: q.topico.nome,
        enunciado: q.enunciado,
        texto: r.texto ?? "",
        notaIa: r.nota_ia === null ? null : Number(r.nota_ia),
        notaAjustada: r.nota_ajustada === null ? null : Number(r.nota_ajustada),
        pendente: r.nota_ia === null && r.nota_ajustada === null,
        revisadaEm: r.revisada_em,
        aguardandoLiberacao: Boolean(entrega?.atividade?.revisar_antes_liberar && !entrega?.liberada_em),
        desconsiderada,
        telemetria: (r.telemetria as TelemetriaResumo | null) ?? null,
        rubrica: normalizarRubrica(q.rubrica),
        regrasGlobais: normalizarRegrasGlobais(entrega?.atividade?.regras_globais),
        correcaoV2,
        criterios: c?.criterios ?? [],
        comentario: c?.comentario ?? null,
      });
    }
  }

  return {
    aluno: { id: aluno.id, nome: aluno.nome },
    turma: { id: aluno.turma.id, nome: aluno.turma.nome },
    entregas: minhas.length,
    porTopico: [...notasPorTopico.entries()]
      .map(([topicoId, t]) => {
        const suficiente = t.notas.length >= MIN_QUESTOES;
        const dominio = suficiente ? (media(t.notas) as number) : null;
        return {
          topicoId,
          nome: t.nome,
          dominio,
          respondidas: t.notas.length,
          acertos: t.notas.filter((n) => n >= 1).length,
          lacuna: dominio !== null && dominio < LIMIAR_LACUNA,
        };
      })
      .sort((a, b) => (a.dominio ?? 2) - (b.dominio ?? 2)),
    equivocos: [...equivocos.values()].sort((a, b) => b.vezes - a.vezes),
    erradas,
    dissertativas,
  };
}
