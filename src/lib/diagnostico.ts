import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Limiares do Diagnóstico (ver docs/ESCOPO.md). Configuráveis aqui, sem tela de configuração. */
export const LIMIAR_LACUNA = 0.6; // Domínio abaixo disso é Lacuna
export const MIN_QUESTOES = 3; // Questões respondidas no Tópico para o Domínio do Aluno contar
export const MIN_ALUNOS_TURMA = 3; // Alunos com dados no Tópico para a Turma ter veredito (evita lacuna de 1 aluno)

export type Celula = {
  dominio: number | null; // 0..1; null = dados insuficientes
  respondidas: number;
  acertos: number;
  lacuna: boolean;
};

/** Atividade de reforço: criada a partir de uma lacuna (título começa com "Reforço"). */
export const ehReforco = (titulo: string) => titulo.startsWith("Reforço");

export type Evolucao = {
  atividades: { id: string; titulo: string; data: string; reforco: boolean }[];
  /** Domínio da Turma por tópico em cada atividade, na mesma ordem de `atividades`; null = dados insuficientes. */
  linhas: { topicoId: string; nome: string; valores: (number | null)[] }[];
};

export type DiagnosticoTurma = {
  turma: { id: string; nome: string };
  topicos: { id: string; nome: string; paginas: number[]; disciplina: string | null }[];
  alunos: { id: string; nome: string; entregou: boolean; media: number | null; celulas: Record<string, Celula> }[];
  turmaCelulas: Record<string, { dominio: number | null; alunosComDados: number; lacuna: boolean }>;
  equivocos: { topicoId: string; topico: string; equivoco: string; vezes: number }[];
  totalAlunos: number;
  totalEntregas: number;
  ultimaEntrega: string | null;
  evolucao: Evolucao;
};

const media = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Calcula o Diagnóstico de todas as Turmas do Professor. Sem IA. */
export async function diagnosticosDoProfessor(professorId: string): Promise<DiagnosticoTurma[]> {
  const db = createAdminClient();

  const { data: turmas } = await db.from("turmas").select("id, nome").eq("professor_id", professorId).order("nome");
  if (!turmas?.length) return [];

  const [{ data: atividades }, { data: alunos }] = await Promise.all([
    db.from("atividades").select("id, turma_id, titulo, publicada_em, created_at").eq("professor_id", professorId).eq("status", "publicada"),
    db.from("profiles").select("id, nome, turma_id").eq("papel", "aluno").in("turma_id", turmas.map((t) => t.id)),
  ]);
  const atividadeIds = (atividades ?? []).map((a) => a.id);
  const turmaDaAtividade = new Map((atividades ?? []).map((a) => [a.id, a.turma_id]));

  const { data: entregas } = atividadeIds.length
    ? await db.from("entregas").select("id, aluno_id, atividade_id, enviada_em").in("atividade_id", atividadeIds)
    : { data: [] };
  const entregaIds = (entregas ?? []).map((e) => e.id);

  const { data: respostas } = entregaIds.length
    ? await db
        .from("respostas")
        .select(
          `entrega_id, nota_ia, nota_ajustada,
           questao:questoes(topico_id, trecho:material_trechos(pagina)),
           alternativa:alternativas(correta, equivoco)`,
        )
        .in("entrega_id", entregaIds)
    : { data: [] };

  const topicoIds = [...new Set((respostas ?? []).map((r) => r.questao?.topico_id).filter((x): x is string => !!x))];
  const { data: topicosDb } = topicoIds.length
    ? await db.from("topicos").select("id, nome, material:materiais(disciplina)").in("id", topicoIds)
    : { data: [] };
  const nomeTopico = new Map((topicosDb ?? []).map((t) => [t.id, t.nome]));
  const disciplinaDoTopico = new Map((topicosDb ?? []).map((t) => [t.id, t.material?.disciplina ?? null]));

  const entregaPorId = new Map((entregas ?? []).map((e) => [e.id, e]));

  return turmas.map((turma) => {
    const alunosDaTurma = (alunos ?? []).filter((a) => a.turma_id === turma.id);
    const respostasDaTurma = (respostas ?? []).filter((r) => {
      const e = entregaPorId.get(r.entrega_id);
      return e && turmaDaAtividade.get(e.atividade_id) === turma.id;
    });
    const entregasDaTurma = (entregas ?? []).filter((e) => turmaDaAtividade.get(e.atividade_id) === turma.id);

    // Tópicos presentes nesta turma, na ordem em que aparecem
    const topicosDaTurma = [...new Set(respostasDaTurma.map((r) => r.questao?.topico_id).filter((x): x is string => !!x))];
    const paginasPorTopico = new Map<string, Set<number>>();
    for (const r of respostasDaTurma) {
      const tid = r.questao?.topico_id;
      const pg = r.questao?.trecho?.pagina;
      if (tid && pg) (paginasPorTopico.get(tid) ?? paginasPorTopico.set(tid, new Set()).get(tid)!).add(pg);
    }

    const alunosDiag = alunosDaTurma.map((aluno) => {
      const entregasAluno = new Set(entregasDaTurma.filter((e) => e.aluno_id === aluno.id).map((e) => e.id));
      const minhas = respostasDaTurma.filter((r) => entregasAluno.has(r.entrega_id));
      const celulas: Record<string, Celula> = {};
      for (const tid of topicosDaTurma) {
        const doTopico = minhas.filter((r) => r.questao?.topico_id === tid && (r.nota_ajustada ?? r.nota_ia) !== null);
        const notas = doTopico.map((r) => Number(r.nota_ajustada ?? r.nota_ia));
        const suficiente = notas.length >= MIN_QUESTOES;
        const dominio = suficiente ? (media(notas) as number) : null;
        celulas[tid] = {
          dominio,
          respondidas: notas.length,
          acertos: notas.filter((n) => n >= 1).length,
          lacuna: dominio !== null && dominio < LIMIAR_LACUNA,
        };
      }
      const dominios = Object.values(celulas).map((c) => c.dominio).filter((d): d is number => d !== null);
      return { id: aluno.id, nome: aluno.nome, entregou: entregasAluno.size > 0, media: media(dominios), celulas };
    });

    const turmaCelulas: DiagnosticoTurma["turmaCelulas"] = {};
    for (const tid of topicosDaTurma) {
      const ds = alunosDiag.map((a) => a.celulas[tid]?.dominio).filter((d): d is number => d !== null && d !== undefined);
      const dominio = ds.length >= MIN_ALUNOS_TURMA ? media(ds) : null; // Domínio da Turma = média dos Alunos
      turmaCelulas[tid] = { dominio, alunosComDados: ds.length, lacuna: dominio !== null && dominio < LIMIAR_LACUNA };
    }

    // Equívocos mais frequentes (distratores escolhidos)
    const contagem = new Map<string, { topicoId: string; equivoco: string; vezes: number }>();
    for (const r of respostasDaTurma) {
      const eq = r.alternativa && !r.alternativa.correta ? r.alternativa.equivoco : null;
      const tid = r.questao?.topico_id;
      if (!eq || !tid) continue;
      const chave = `${tid}|${eq}`;
      const atual = contagem.get(chave) ?? { topicoId: tid, equivoco: eq, vezes: 0 };
      atual.vezes++;
      contagem.set(chave, atual);
    }

    // Evolução: domínio da Turma por tópico em cada atividade, em ordem cronológica.
    const atividadesDaTurma = (atividades ?? [])
      .filter((a) => a.turma_id === turma.id && entregasDaTurma.some((e) => e.atividade_id === a.id))
      .sort((a, b) => (a.publicada_em ?? a.created_at).localeCompare(b.publicada_em ?? b.created_at));
    const linhasEvolucao = topicosDaTurma.map((tid) => ({
      topicoId: tid,
      nome: nomeTopico.get(tid) ?? "—",
      valores: atividadesDaTurma.map((a) => {
        const porAluno = new Map<string, number[]>();
        for (const r of respostasDaTurma) {
          const e = entregaPorId.get(r.entrega_id);
          const nota = r.nota_ajustada ?? r.nota_ia;
          if (!e || e.atividade_id !== a.id || r.questao?.topico_id !== tid || nota === null) continue;
          (porAluno.get(e.aluno_id) ?? porAluno.set(e.aluno_id, []).get(e.aluno_id)!).push(Number(nota));
        }
        const dominios = [...porAluno.values()].map((ns) => media(ns) as number);
        return dominios.length >= MIN_ALUNOS_TURMA ? (media(dominios) as number) : null;
      }),
    })).filter((l) => l.valores.some((v) => v !== null));

    return {
      turma,
      evolucao: {
        atividades: atividadesDaTurma.map((a) => ({
          id: a.id, titulo: a.titulo, data: a.publicada_em ?? a.created_at, reforco: ehReforco(a.titulo),
        })),
        linhas: linhasEvolucao,
      },
      topicos: topicosDaTurma.map((id) => ({
        id, nome: nomeTopico.get(id) ?? "—", disciplina: disciplinaDoTopico.get(id) ?? null, paginas: [...(paginasPorTopico.get(id) ?? [])].sort((a, b) => a - b),
      })),
      alunos: alunosDiag.sort((a, b) => (a.media ?? 2) - (b.media ?? 2) || a.nome.localeCompare(b.nome)),
      turmaCelulas,
      equivocos: [...contagem.values()]
        .sort((a, b) => b.vezes - a.vezes)
        .map((e) => ({ ...e, topico: nomeTopico.get(e.topicoId) ?? "—" })),
      totalAlunos: alunosDaTurma.length,
      totalEntregas: entregasDaTurma.length,
      ultimaEntrega: entregasDaTurma.map((e) => e.enviada_em).sort().at(-1) ?? null,
    };
  });
}

/** Tópicos em Lacuna da Turma, do mais fraco para o mais forte. */
export function lacunasDaTurma(d: DiagnosticoTurma) {
  return d.topicos
    .map((t) => ({ ...t, ...d.turmaCelulas[t.id] }))
    .filter((t) => t.lacuna)
    .sort((a, b) => (a.dominio ?? 0) - (b.dominio ?? 0));
}
