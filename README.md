# s.ai

> Descubra em segundos onde sua turma está travando — e o que revisar.

Projeto do **Hack Brasil 2026** — trilha **Acesso à educação**.

Plataforma para professores do ensino médio público (foco em ENEM). O professor envia seus materiais de apoio, a IA gera questões a partir deles e, com as respostas dos alunos, o sistema mostra **onde estão as lacunas** de cada aluno e da turma — e o que revisar para cobri-las.

## Como funciona

1. **Professor** cria turmas e compartilha um código de convite com os alunos.
2. Envia **materiais de apoio** (PDF ou texto); a IA extrai os tópicos.
3. A IA gera **questões** (múltipla escolha e dissertativas) a partir do material; o professor revisa e publica uma **atividade**.
4. **Aluno** responde e recebe **feedback** personalizado, apontando o trecho do material a revisar.
5. Professor vê o **diagnóstico**: mapa de domínio por tópico × aluno e recomendações de onde focar.

## Stack

Next.js + TypeScript · Supabase (Postgres, Auth, Storage, pgvector) · Gemini API · Vercel

## Documentação

- [Escopo](docs/ESCOPO.md) — regras do produto, fora do escopo, cronograma
- [Glossário do domínio](CONTEXT.md)
- [Decisões de arquitetura](docs/adr/)

## Status

🚧 Em definição de escopo. Nome do projeto provisório.
