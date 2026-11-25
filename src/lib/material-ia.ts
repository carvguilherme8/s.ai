import "server-only";
import { Type, type GenerateContentParameters } from "@google/genai";
import { EMBEDDING_DIM, gemini } from "@/lib/gemini";
import { NOMES_DISCIPLINAS, disciplinaValida } from "@/lib/disciplinas";

/** Modelo preferido; os demais entram em ordem quando a cota (por modelo) do plano gratuito acaba. */
export const MODELO = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
const MODELOS = [...new Set([MODELO, "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.7-flash"])];

/** generateContent com fallback entre modelos em caso de cota esgotada (429) ou modelo indisponível. */
export async function gerarComFallback(params: Omit<GenerateContentParameters, "model">) {
  let ultimoErro: unknown;
  for (const model of MODELOS) {
    try {
      return await gemini.models.generateContent({ ...params, model });
    } catch (e) {
      ultimoErro = e;
      const status = (e as { status?: number }).status;
      if (status !== 429 && status !== 503 && status !== 404) throw e;
      console.warn(`Gemini ${model} indisponível (${status}); tentando o próximo modelo.`);
    }
  }
  throw ultimoErro;
}
const MODELO_EMBEDDING = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";

export function geminiConfigurado() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/** Extrai o texto de um PDF (com texto, sem OCR) usando o próprio Gemini. */
export async function extrairTextoDoPdf(pdf: Buffer): Promise<string> {
  const res = await gerarComFallback({
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

/** Pede à IA a disciplina do Material e os Tópicos (unidades de conhecimento) dele. */
export async function extrairTopicos(titulo: string, texto: string): Promise<{ disciplina: string | null; topicos: TopicoSugerido[] }> {
  const res = await gerarComFallback({
    contents:
      `Material de apoio de ensino médio (foco ENEM): "${titulo}".

` +
      `1) Diga a disciplina do material, escolhendo UMA entre: ${NOMES_DISCIPLINAS.join(", ")}.
` +
      `2) Extraia de 3 a 8 Tópicos: unidades de conhecimento pequenas e específicas o bastante para ` +
      `que se possa medir o domínio de um aluno (ex.: "Função do 2º grau – vértice", e não "Matemática"). ` +
      `Para cada um dê um nome curto em português e uma descrição de uma frase.

--- MATERIAL ---
` +
      texto.slice(0, 60_000),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          disciplina: { type: Type.STRING, enum: NOMES_DISCIPLINAS },
          topicos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { nome: { type: Type.STRING }, descricao: { type: Type.STRING } },
              required: ["nome", "descricao"],
            },
          },
        },
        required: ["disciplina", "topicos"],
      },
    },
  });
  const j = JSON.parse(res.text ?? "{}") as { disciplina?: string; topicos?: TopicoSugerido[] };
  return {
    disciplina: disciplinaValida(j.disciplina),
    topicos: (j.topicos ?? []).filter((t) => t.nome?.trim()).slice(0, 10),
  };
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

/** Embeddings (768 dimensões) dos trechos de um Material para indexação no pgvector. */
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

/** Embedding (768 dimensões) de uma consulta de busca (tópico, equívoco ou questão) para RAG. */
export async function gerarEmbeddingConsulta(consulta: string): Promise<number[]> {
  const res = await gemini.models.embedContent({
    model: MODELO_EMBEDDING,
    contents: consulta.slice(0, 8_000),
    config: { outputDimensionality: EMBEDDING_DIM, taskType: "RETRIEVAL_QUERY" },
  });
  const vetor = res.embeddings?.[0]?.values ?? [];
  if (vetor.length !== EMBEDDING_DIM) {
    throw new Error(`Embedding de consulta inválido (${vetor.length} dimensões).`);
  }
  return vetor;
}
