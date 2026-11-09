import "server-only";
import { GoogleGenAI } from "@google/genai";

export const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/** Dimensão usada em material_trechos.embedding. */
export const EMBEDDING_DIM = 768;
