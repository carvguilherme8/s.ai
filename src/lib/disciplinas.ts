/** Disciplinas do ensino médio, agrupadas nas áreas do ENEM. A ordem aqui é a ordem de exibição. */
export const DISCIPLINAS = [
  { nome: "Matemática", area: "Matemática" },
  { nome: "Física", area: "Ciências da Natureza" },
  { nome: "Química", area: "Ciências da Natureza" },
  { nome: "Biologia", area: "Ciências da Natureza" },
  { nome: "História", area: "Ciências Humanas" },
  { nome: "Geografia", area: "Ciências Humanas" },
  { nome: "Filosofia e Sociologia", area: "Ciências Humanas" },
  { nome: "Português e Literatura", area: "Linguagens" },
  { nome: "Inglês e Espanhol", area: "Linguagens" },
  { nome: "Redação", area: "Linguagens" },
] as const;

export const NOMES_DISCIPLINAS: string[] = DISCIPLINAS.map((d) => d.nome);
export const SEM_DISCIPLINA = "Sem disciplina";

/** Devolve a disciplina se for uma das conhecidas; senão null. */
export function disciplinaValida(valor: unknown): string | null {
  return typeof valor === "string" && NOMES_DISCIPLINAS.includes(valor) ? valor : null;
}

export function areaDaDisciplina(nome: string | null): string | null {
  return DISCIPLINAS.find((d) => d.nome === nome)?.area ?? null;
}

/** Posição para ordenar grupos: disciplinas conhecidas na ordem acima, "sem disciplina" por último. */
export function ordemDaDisciplina(nome: string | null): number {
  const i = NOMES_DISCIPLINAS.indexOf(nome ?? "");
  return i === -1 ? NOMES_DISCIPLINAS.length : i;
}
