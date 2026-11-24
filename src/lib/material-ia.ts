import "server-only";
import { Type } from "@google/genai";
import { EMBEDDING_DIM, gemini } from "@/lib/gemini";

export const MODELO = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const MODELO_EMBEDDING = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

export function geminiConfigurado() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Extrai o texto de um PDF (com texto, sem OCR) usando o próprio Gemini. */
export async function extrairTextoDoPdf(pdf: Buffer): Promise<string> {
  const res = await gemini.models.generateContent({
    model: MODELO,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
          {
            text:
              "Transcreva fielmente todo o texto deste PDF, na ordem de leitura. " +
              "Antes do texto de cada página escreva uma linha '[página N]'. " +
              "Não resuma, não comente e não traduza.",
          },
        ],
      },
    ],
  });
  return (res.text ?? "").trim();
}

export type TopicoSugerido = { nome: string; descricao: string };

/** Pede à IA os Tópicos (unidades de conhecimento) do Material. */
export async function extrairTopicos(titulo: string, texto: string): Promise<TopicoSugerido[]> {
  const res = await gemini.models.generateContent({
    model: MODELO,
    contents:
      `Material de apoio de ensino médio (foco ENEM): "${titulo}".\n\n` +
      `Extraia de 3 a 8 Tópicos: unidades de conhecimento pequenas e específicas o bastante para ` +
      `que se possa medir o domínio de um aluno (ex.: "Função do 2º grau – vértice", e não "Matemática"). ` +
      `Para cada um dê um nome curto em português e uma descrição de uma frase.\n\n--- MATERIAL ---\n` +
      texto.slice(0, 60_000),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: { nome: { type: Type.STRING }, descricao: { type: Type.STRING } },
          required: ["nome", "descricao"],
        },
      },
    },
  });
  const lista = JSON.parse(res.text ?? "[]") as TopicoSugerido[];
  return lista.filter((t) => t.nome?.trim()).slice(0, 10);
}

/** Divide o texto em trechos de ~1200 caracteres, respeitando parágrafos e marcadores de página. */
export function dividirEmTrechos(texto: string, alvo = 1200) {
  const trechos: { pagina: number | null; conteudo: string }[] = [];
  let pagina: number | null = null;
  let atual = "";
  const fechar = () => {
    if (atual.trim()) trechos.push({ pagina, conteudo: atual.trim() });
    atual = "";
  };
  for (const par of texto.split(/\n{2,}|\n(?=\[página \d+\])/)) {
    const m = par.match(/^\s*\[página (\d+)\]/);
    if (m) {
      fechar();
      pagina = Number(m[1]);
    }
    if (atual.length + par.length > alvo) fechar();
    atual += (atual ? "\n\n" : "") + par;
  }
  fechar();
  return trechos;
}

/** Embeddings (768 dimensões) para busca por similaridade. */
export async function gerarEmbeddings(textos: string[]): Promise<number[][]> {
  const saida: number[][] = [];
  for (let i = 0; i < textos.length; i += 50) {
    const res = await gemini.models.embedContent({
      model: MODELO_EMBEDDING,
      contents: textos.slice(i, i + 50),
      config: { outputDimensionality: EMBEDDING_DIM, taskType: "RETRIEVAL_DOCUMENT" },
    });
    for (const e of res.embeddings ?? []) saida.push(e.values ?? []);
  }
  return saida;
}
