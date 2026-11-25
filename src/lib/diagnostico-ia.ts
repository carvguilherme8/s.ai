import "server-only";
import { Type } from "@google/genai";
import { gerarComFallback } from "@/lib/material-ia";
import { LIMIAR_LACUNA, lacunasDaTurma, type DiagnosticoTurma } from "@/lib/diagnostico";

export type ResumoDiagnostico = {
  resumo: string;
  focos: { topico: string; porque: string; revisar: string }[];
};

const pct = (d: number | null) => (d === null ? "sem dados" : `${Math.round(d * 100)}%`);

/** Resumo em linguagem natural a partir dos números já calculados (a IA só narra; não calcula nada). */
export async function gerarResumoIA(d: DiagnosticoTurma): Promise<ResumoDiagnostico> {
  const lacunas = lacunasDaTurma(d);
  if (!lacunas.length) {
    return {
      resumo: `Nenhum tópico da ${d.turma.nome} está abaixo de ${Math.round(LIMIAR_LACUNA * 100)}% de domínio. A turma está bem nos conteúdos avaliados até agora.`,
      focos: [],
    };
  }

  const alunosEmLacuna = (tid: string) => d.alunos.filter((a) => a.celulas[tid]?.lacuna).length;
  const fatos = lacunas
    .slice(0, 4)
    .map((l) => {
      const eqs = d.equivocos.filter((e) => e.topicoId === l.id).slice(0, 3);
      return (
        `- Tópico "${l.nome}": domínio da turma ${pct(l.dominio)}; ${alunosEmLacuna(l.id)} de ${l.alunosComDados} alunos em lacuna; ` +
        `páginas do material: ${l.paginas.length ? l.paginas.join(", ") : "não informadas"}; ` +
        `equívocos mais comuns: ${eqs.length ? eqs.map((e) => `"${e.equivoco}" (${e.vezes}x)`).join("; ") : "nenhum registrado"}`
      );
    })
    .join("\n");

  const res = await gerarComFallback({
    contents:
      `Você assessora um professor do ensino médio. Abaixo estão resultados JÁ CALCULADOS da turma ${d.turma.nome} ` +
      `(lacuna = domínio abaixo de ${Math.round(LIMIAR_LACUNA * 100)}%). Escreva, em português do Brasil, um resumo curto e acionável ` +
      `no formato "foque em X porque Y; revise com Z". Use apenas os dados fornecidos; não invente números.\n\n` +
      `${d.totalEntregas} de ${d.totalAlunos} alunos entregaram.\n${fatos}\n\n` +
      `Responda com "resumo" (2 a 3 frases, panorama geral) e "focos": um item por tópico em lacuna, com ` +
      `"topico" (nome exato), "porque" (1 frase usando os equívocos) e "revisar" (o que revisar, citando as páginas, se houver; sem começar com o verbo "revisar" nem "revise", pois a interface já escreve "Revise:" antes).`,
    config: {
      responseMimeType: "application/json",
      abortSignal: AbortSignal.timeout(90_000),
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          resumo: { type: Type.STRING },
          focos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { topico: { type: Type.STRING }, porque: { type: Type.STRING }, revisar: { type: Type.STRING } },
              required: ["topico", "porque", "revisar"],
            },
          },
        },
        required: ["resumo", "focos"],
      },
    },
  });
  const j = JSON.parse(res.text ?? "{}") as Partial<ResumoDiagnostico>;
  if (!j.resumo) throw new Error("Resposta vazia da IA");
  return { resumo: j.resumo, focos: j.focos ?? [] };
}
