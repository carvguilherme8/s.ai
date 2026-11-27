import { NextResponse, type NextRequest } from "next/server";
import { getSessao } from "@/lib/supabase/server";
import { diagnosticosDoProfessor } from "@/lib/diagnostico";
import { SEM_DISCIPLINA } from "@/lib/disciplinas";

function escaparCsv(valor: string | number | null | undefined): string {
  const s = valor === null || valor === undefined ? "" : String(valor);
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const pctNum = (d: number | null | undefined) =>
  d === null || d === undefined ? "" : `${Math.round(d * 100)}%`;

/**
 * Exporta o Diagnóstico da turma em CSV compatível com Excel em PT-BR (separador `;` + UTF-8 BOM).
 */
export async function GET(request: NextRequest) {
  const sessao = await getSessao();
  if (!sessao || sessao.profile.papel !== "professor") {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const turmaParam = request.nextUrl.searchParams.get("turma") ?? "";
  const discParam = request.nextUrl.searchParams.get("disc") ?? "";

  const todas = await diagnosticosDoProfessor(sessao.profile.id);
  const comDados = todas.filter((d) => d.totalEntregas > 0);
  const diag = comDados.find((d) => d.turma.id === turmaParam) ?? comDados[0];
  if (!diag) {
    return NextResponse.json({ erro: "Sem dados de diagnóstico para exportar." }, { status: 404 });
  }

  const topicos = discParam
    ? diag.topicos.filter((t) => (t.disciplina ?? SEM_DISCIPLINA) === discParam)
    : diag.topicos;

  const cabecalho = [
    "Aluno",
    "Turma",
    "Entregou",
    "Média Geral (%)",
    "Nota Equivalente (0-10)",
    ...topicos.map((t) => `${t.nome} (%)`),
  ];

  const linhas: string[][] = [cabecalho];

  // Linha de média da turma
  linhas.push([
    "Turma (média)",
    diag.turma.nome,
    `${diag.alunos.filter((a) => a.entregou).length}/${diag.totalAlunos}`,
    "",
    "",
    ...topicos.map((t) => pctNum(diag.turmaCelulas[t.id]?.dominio)),
  ]);

  for (const a of diag.alunos) {
    const nota10 =
      a.media === null ? "" : (Math.round(a.media * 100) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    linhas.push([
      a.nome.replace(" (fictício)", ""),
      diag.turma.nome,
      a.entregou ? "Sim" : "Não",
      pctNum(a.media),
      nota10,
      ...topicos.map((t) => pctNum(a.celulas[t.id]?.dominio)),
    ]);
  }

  // UTF-8 BOM garante acentuação correta ao abrir direto no Microsoft Excel (Windows/PT-BR).
  const corpo = "\uFEFF" + linhas.map((l) => l.map(escaparCsv).join(";")).join("\r\n") + "\r\n";
  const slug = diag.turma.nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .toLowerCase();

  return new NextResponse(corpo, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="diagnostico-${slug || "turma"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
