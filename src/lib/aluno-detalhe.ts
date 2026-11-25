import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { LIMIAR_LACUNA, MIN_QUESTOES } from "@/lib/diagnostico";

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
  atividade: string;
  topicoId: string;
  topico: string;
  enunciado: string;
  texto: string;
  notaIa: number | null;
  notaAjustada: number | null;
  pendente: boolean;
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
    .select("id, atividade:atividades(titulo, professor_id)")
    .eq("aluno_id", alunoId);
  const minhas = (entregas ?? []).filter((e) => e.atividade?.professor_id === professorId);
  const tituloDaEntrega = new Map(minhas.map((e) => [e.id, e.atividade?.titulo ?? ""]));

  const { data: respostas } = minhas.length
    ? await db
        .from("respostas")
        .select(
          `id, entrega_id, alternativa_id, texto, nota_ia, nota_ajustada, correcao,
           questao:questoes(tipo, enunciado, topico:topicos(id, nome), alternativas(id, texto, correta, equivoco))`,
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
    const nota = r.nota_ajustada ?? r.nota_ia;
    if (nota !== null) {
      const t = notasPorTopico.get(q.topico.id) ?? notasPorTopico.set(q.topico.id, { nome: q.topico.nome, notas: [] }).get(q.topico.id)!;
      t.notas.push(Number(nota));
    }
    const atividade = tituloDaEntrega.get(r.entrega_id) ?? "";

    if (q.tipo === "multipla_escolha") {
      const escolhida = q.alternativas.find((a) => a.id === r.alternativa_id);
      const correta = q.alternativas.find((a) => a.correta);
      if (!escolhida || !correta || escolhida.correta) continue;
      erradas.push({
        tipo: "multipla_escolha", id: r.id, atividade, topicoId: q.topico.id, topico: q.topico.nome, enunciado: q.enunciado,
        acertou: false, escolhida: escolhida.texto, equivoco: escolhida.equivoco, correta: correta.texto,
      });
      if (escolhida.equivoco) {
        const chave = `${q.topico.id}|${escolhida.equivoco}`;
        const e = equivocos.get(chave) ?? { topico: q.topico.nome, equivoco: escolhida.equivoco, vezes: 0 };
        e.vezes++;
        equivocos.set(chave, e);
      }
    } else {
      const c = r.correcao as { criterios?: CriterioCorrecao[]; comentario?: string; pendente?: boolean } | null;
      dissertativas.push({
        tipo: "dissertativa", id: r.id, atividade, topicoId: q.topico.id, topico: q.topico.nome, enunciado: q.enunciado,
        texto: r.texto ?? "", notaIa: r.nota_ia === null ? null : Number(r.nota_ia),
        notaAjustada: r.nota_ajustada === null ? null : Number(r.nota_ajustada),
        pendente: r.nota_ia === null, criterios: c?.criterios ?? [], comentario: c?.comentario ?? null,
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
        return { topicoId, nome: t.nome, dominio, respondidas: t.notas.length, acertos: t.notas.filter((n) => n >= 1).length, lacuna: dominio !== null && dominio < LIMIAR_LACUNA };
      })
      .sort((a, b) => (a.dominio ?? 2) - (b.dominio ?? 2)),
    equivocos: [...equivocos.values()].sort((a, b) => b.vezes - a.vezes),
    erradas,
    dissertativas,
  };
}
