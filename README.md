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
6. **Age sobre a lacuna:** com um clique, a IA gera uma **atividade de reforço** cujos distratores testam os equívocos daquela turma.
7. **Acompanha:** a evolução do domínio a cada atividade (o reforço fechou a lacuna?), o detalhe de cada aluno e o ajuste da nota que a IA deu às dissertativas.
8. **Leva para fora:** copia o resumo pronto para o WhatsApp ou imprime/salva em PDF.
9. **Revisão por disciplina (ENEM):** cada material tem uma disciplina (a IA sugere, a professora corrige). O aluno lê os materiais da turma, vê o domínio agrupado por disciplina e recebe um plano "Revise primeiro" com link para a página do material onde mais errou. O Diagnóstico filtra por disciplina.

O diagnóstico é calculado **sem IA**; a IA só explica os números.

## Stack

Next.js 16 + TypeScript · Supabase (Postgres, Auth, Storage, pgvector) · Gemini API · Vercel

## Rodando localmente

Requer Node 20+ e um projeto Supabase.

```bash
npm install
cp .env.example .env.local     # preencha as chaves e SEED_PROFESSOR_PASSWORD (ver docs/DEPLOY.md)
npm run seed                   # professora, turmas e alunos fictícios
npm run seed:diagnostico       # 25 alunos e entregas simuladas com lacunas
npm run seed:reforco           # reforço fictício na 2ºA, para a evolução no tempo
npm run seed:matematica        # segunda disciplina (Matemática) na demonstração
npm run dev                    # http://localhost:3000
```

O schema está em `supabase/migrations/` e precisa estar aplicado no projeto.

## Demonstração

**Demo online: https://s-ai-phi.vercel.app**

- **Professora:** `professora@demo.s-ai.dev`. A senha é informada aos avaliadores na submissão (não fica no repositório); para rodar localmente, defina `SEED_PROFESSOR_PASSWORD` antes do `npm run seed`.
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
- A professora tem uma conta única de demonstração (sem cadastro de novas professoras).
