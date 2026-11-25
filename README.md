# s.ai

> Descubra em segundos onde sua turma está travando — e o que revisar.

Projeto do **Hack Brasil 2026** — trilha **Acesso à educação**.

Plataforma para professores do ensino médio público (foco em ENEM). O professor envia seus materiais de apoio, a IA gera questões a partir deles e, com as respostas dos alunos, o sistema mostra **onde estão as lacunas** de cada aluno e da turma — e o que revisar para cobri-las.

## Como funciona

1. **Professor** cria turmas e compartilha um código de convite com os alunos.
2. Envia **materiais de apoio** (PDF com texto ou texto colado); a IA sugere os tópicos e o professor confirma.
3. A IA gera **questões** (múltipla escolha, com cada alternativa errada ligada a um equívoco, e dissertativas com rubrica); o professor revisa e publica uma **atividade**.
4. **Aluno** responde pelo celular e, depois de enviar tudo, recebe **feedback** personalizado, apontando o trecho do material a revisar.
5. Professor vê o **diagnóstico**: mapa de domínio por tópico × aluno, lacunas, equívocos mais frequentes e um resumo da IA com o que revisar.

O diagnóstico é calculado **sem IA**; a IA só explica os números.

## Stack

Next.js 16 + TypeScript · Supabase (Postgres, Auth, Storage, pgvector) · Gemini API · Vercel

## Rodando localmente

Requer Node 20+ e um projeto Supabase.

```bash
npm install
cp .env.example .env.local     # preencha as chaves (ver docs/DEPLOY.md)
npm run seed                   # professora, turmas e alunos fictícios
npm run seed:diagnostico       # 25 alunos e entregas simuladas com lacunas
npm run dev                    # http://localhost:3000
```

O schema está em `supabase/migrations/` e precisa estar aplicado no projeto.

## Demonstração

- **Professora:** o login é **simulado** (entra direto como a professora demo), para a demo funcionar sem cadastro. Veja os limites disso em [docs/DEPLOY.md](docs/DEPLOY.md).
- **Aluno:** entre em `/entrar` com uma conta fictícia do seed (`<nome>@demo.s-ai.dev`, por exemplo `rafael@demo.s-ai.dev`; a senha está em `scripts/seed.mjs`) ou crie a sua em `/cadastro` com o código de convite da turma (visível no painel da professora).
- Todos os dados da demo são fictícios.

## Documentação

- [Escopo](docs/ESCOPO.md) — regras do produto, fora do escopo, cronograma
- [Glossário do domínio](CONTEXT.md)
- [Decisões de arquitetura](docs/adr/)
- [Deploy](docs/DEPLOY.md) — variáveis, banco, cron e riscos conhecidos
- [PRODUCT.md](PRODUCT.md) e [DESIGN.md](DESIGN.md) — contexto do produto e sistema visual

## Limites conhecidos

- Materiais: só PDF com texto e texto colado (sem OCR, vídeo ou links).
- A cota gratuita da Gemini API limita a IA; o feedback do aluno tem plano B sem IA.
- Login real existe só para o aluno; a professora é simulada nesta versão.
