# Escopo — Hack Brasil 2026

Vocabulário em [CONTEXT.md](../CONTEXT.md). Stack em [ADR 0001](adr/0001-stack-nextjs-supabase-gemini.md).

## Enquadramento

- **Trilha:** Acesso à educação (5.2) — "apoio a professores e escolas".
- **Público:** Professores de ensino médio público, foco em ENEM.
- **Diferencial (o que o jurado deve lembrar):** o **Diagnóstico** — o Professor descobre em segundos onde a Turma está travando e o que revisar. Geração de Questões e Feedback existem para alimentá-lo.
- **Nome / tagline:** _em aberto_ (nome de trabalho: s.ai). Sugestão: "Descubra em segundos onde sua turma está travando — e o que revisar."

## Restrições do regulamento

- Submissão até **30/11 23:59**; final presencial 12/12 (SP).
- Repositório GitHub público, primeiro commit após 04/11 21h, público até 15/12.
- Demo online durante toda a avaliação.
- Vídeo ≤ 3 min, sem login (inglês preferido).
- Sem dados pessoais reais na demo.
- Excluídos da trilha: assistentes de uso geral; ferramentas para colar.
- Critérios com peso igual: execução, implementação técnica, impacto, comunicação. Desempate por execução → **completo e polido > grande e quebrado**.

## Regras de produto

### Pessoas e Turmas
- Professor tem várias Turmas; Aluno pertence a exatamente uma Turma.
- Aluno entra na Turma via **Código de convite**.

### Materiais e Tópicos
- Formatos: **PDF com texto e texto colado** (sem OCR, vídeo ou links — mais simples para a demo).
- IA extrai Tópicos do Material; Professor confirma/edita.
- Tópicos pertencem ao Professor (compartilhados entre suas Turmas).
- Alunos podem ler/baixar Materiais da sua Turma.

### Questões e Atividades
- Geradas pela IA a partir de um Material (principal) ou de um tema digitado (alternativa).
- Tipos: **múltipla escolha** (cada Distrator ligado a um Equívoco) e **dissertativa** (com Rubrica).
- Cada Questão ligada a **exatamente um** Tópico.
- Questões são agrupadas em **Atividades** (prazo opcional), criadas como Rascunho.
- Professor revisa/edita Questões e Rubricas e só então publica a Atividade para uma Turma.

### Entrega e Feedback
- **Uma Entrega por Aluno por Atividade.**
- Feedback só aparece **após a Entrega completa** (evita uso para colar; mantém o Diagnóstico honesto).
- Múltipla escolha: correção automática; Distrator escolhido registra o Equívoco.
- Dissertativa: IA corrige pela Rubrica; Professor pode ajustar a nota.
- Feedback = explicação dos erros + trecho/página do Material de apoio a revisar.

### Diagnóstico
- **Camada calculada (sem IA)**, atualizada a cada Entrega: mapa de calor Tópico × Aluno por Turma, comparação entre Turmas, Equívocos mais frequentes.
- **Camada IA**, sob demanda com cache: resumo "foque em X porque Y; revise com Z".
- **Lacuna:** Domínio < 60% em um Tópico com ≥ 3 Questões respondidas; abaixo disso, "dados insuficientes". Domínio da Turma = média dos Alunos. Limiares configuráveis no código.
- Aluno vê o próprio Domínio por Tópico (lista com barras).

## Fora do escopo

- Chat do Aluno com IA sobre o material.
- OCR, imagens, vídeo, links como Material.
- Aluno em várias Turmas; Turma com vários Professores.
- Múltiplas tentativas por Atividade.
- Tela de configuração de limiares.
- Integrações (Google Classroom, SEDUC etc.).

## Prioridade e cronograma

Ordem de corte: o último item sai primeiro. **1–4 = demo mínima.**

| # | Entrega | Marco |
|---|---------|-------|
| 1 | Autenticação Professor/Aluno, Turmas, Código de convite | até 13/11 |
| 2 | Upload de Material → Tópicos → geração de Questões (com Distratores e Rubricas) → revisão → Publicação da Atividade | até 13/11 |
| 3 | Aluno responde → correção → Feedback | até 20/11 |
| 4 | Diagnóstico (mapa de calor + resumo IA) + seed de dados fictícios | até 26/11 |
| 5 | Professor ajusta nota da IA | stretch |
| 6 | Domínio visível ao Aluno | stretch |
| 7 | Questões de reforço | stretch |
| — | Vídeo, polimento, submissão com folga | 27–30/11 |

## Demo e vídeo

- **Seed:** 1 Professor, 2 Turmas, ~25 Alunos fictícios, Entregas simuladas com padrões claros de Lacuna (para o mapa de calor ter contraste).
- Interface em **PT-BR**; vídeo **narrado em inglês** com legendas/anotações.
- Roteiro sugerido: problema (Professor com 200 alunos) → upload de Material → Questões geradas e revisadas → Aluno responde e recebe Feedback → **Diagnóstico** (clímax).
