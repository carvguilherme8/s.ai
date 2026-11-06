# 0001 — Stack: Next.js + Supabase + Gemini API

**Status:** aceito (2026-11-06)

## Contexto

Projeto do Hack Brasil 2026 (trilha Acesso à educação). Prazo de submissão: 30/nov. O regulamento exige demo online durante toda a avaliação e repositório público; nenhuma ferramenta de patrocinador é obrigatória nem pontua a mais. A equipe não tinha preferência de stack.

## Decisão

- **Next.js + TypeScript** (frontend e backend no mesmo projeto, uma linguagem só).
- **Supabase**: Postgres, autenticação (Professor/Aluno), Storage para os PDFs dos Materiais de apoio e **pgvector** para recuperar trechos do material na geração de Questões e no Feedback.
- **Gemini API** com saída estruturada (JSON schema) para: extrair Tópicos, gerar Questões/Distratores/Rubricas, corrigir dissertativas, gerar Feedback e o resumo do Diagnóstico. Embeddings também via Gemini.
- **Vercel** para deploy da demo.

## Alternativas consideradas

- Claude API no lugar do Gemini: descartada por escolha da equipe.
- Backend separado (Python/FastAPI): mais peças para manter no ar e duas linguagens; não compensa em 3 semanas.
- Convex/WorkOS (patrocinadores): sem vantagem de pontuação segundo o regulamento.

## Consequências

- Tudo em camadas gratuitas; risco de limites de cota da Gemini API durante a avaliação — mitigar com cache do resumo do Diagnóstico e do Feedback (gerados uma vez por Entrega).
- Materiais restritos a PDF com texto e texto colado (sem OCR), por ser o mais simples para a demo.
