# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Professor de ensino médio público (foco ENEM)**, com várias turmas e pouco tempo. Usa o painel e o Diagnóstico **no computador, planejando aulas** (confirmado). Precisa saber "em segundos" onde a turma trava e o que revisar.
- **Aluno do ensino médio público**, que responde as atividades **principalmente no celular** (confirmado), às vezes com internet limitada. Entra com código de convite da turma.

## Product Purpose

Descobrir onde cada aluno e a turma têm lacunas de aprendizado. O professor envia materiais; a IA gera questões a partir deles; o aluno responde e recebe feedback; o sistema mostra o Diagnóstico (mapa de domínio tópico × aluno, lacunas, equívocos mais frequentes e um resumo "foque em X; revise com Z"). Projeto do Hack Brasil 2026, trilha Acesso à educação.

## Positioning

O Diagnóstico é o diferencial: não é um gerador de questões nem um chat de IA. Geração de questões e feedback existem para alimentar o diagnóstico. A IA narra números calculados sem IA; não inventa nota.

## Operating Context

- Interface em **PT-BR**. Vídeo de demonstração em português (legendas), ≤ 3 min, acessível sem login; demo online durante toda a avaliação.
- Sem dados pessoais reais na demo (alunos fictícios).
- Materiais: PDF com texto ou texto colado. Sem OCR, vídeo ou links.
- Login real para professora (conta única de demonstração, senha entregue só na submissão) e para alunos (cadastro com código de convite).
- Prazo de submissão: 30/11/2026.

## Capabilities and Constraints

- Vocabulário do domínio em `CONTEXT.md` (Professor, Aluno, Turma, Código de convite, Material de apoio, Tópico, Questão, Rubrica, Distrator, Equívoco, Entrega, Feedback, Diagnóstico, Lacuna, Domínio).
- Lacuna: domínio < 60% em um tópico com ≥ 3 questões respondidas; turma exige ≥ 3 alunos com dados.
- Feedback só aparece após a Entrega completa; uma Entrega por Aluno por Atividade.
- Cotas gratuitas do Gemini limitam a IA; há plano B sem IA no feedback.
- Excluídos da trilha: assistentes de uso geral e ferramentas para colar respostas.

## Brand Commitments

- **O nome é s.ai e é definitivo** (confirmado pelo usuário).
- Tagline em uso: "Descubra em segundos onde sua turma está travando — e o que revisar."
- Direção de identidade visual aprovada pelo usuário: **marca-texto** (grifar o que importa) com um toque de **cartão-resposta do ENEM** (bolinhas) onde houver dado.

## Evidence on Hand

- Seed fictício: 25 alunos, 2 turmas e 23 entregas simuladas com lacunas desenhadas (2ºA trava em F = m·a; 3ºB em Ação e Reação).
- Não há depoimentos, escolas parceiras, métricas de impacto ou logotipo. Nada disso deve ser inventado.

## Product Principles

- O Diagnóstico vem primeiro: tudo o mais serve para alimentá-lo ou agir sobre ele.
- Mostrar o que revisar, não só o que errou.
- Honestidade com números: o que é cálculo é cálculo; a IA só explica.
- O aluno recebe retorno útil mesmo sem IA disponível.
- Completo e polido vale mais que grande e quebrado.

## Accessibility & Inclusion

- Aluno em celular e com conexão limitada: telas leves, alvos de toque confortáveis.
- Contraste mínimo AA; a informação nunca depende só da cor (mapa de calor usa número e ícone).
