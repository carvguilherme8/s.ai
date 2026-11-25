---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/globals.css","src/app/diagnostico/page.tsx"]
---

# Surface brief: aplicação s.ai (painel da professora, Diagnóstico, área do aluno)

Modo: **Operate**. Escopo: todas as telas de trabalho (`/`, `/materiais`, `/atividades`, `/diagnostico`, `/aluno`, `/entrar`, `/cadastro`).

Público e tarefa: professora de ensino médio público no computador, planejando aulas (ver onde a turma trava e o que revisar); aluno no celular, respondendo e lendo o retorno.

Direção (fixada pelo usuário, sem sorteio): **marca-texto** com um toque de **cartão-resposta do ENEM**. Nome s.ai definitivo. Pin do usuário, em suas palavras: "pode seguir a sugestão que você disse" (sugestão = marca-texto amarelo como assinatura; bolinhas do cartão-resposta só onde há dado).

Decisões em aberto: tipografia de títulos (Bricolage Grotesque proposta; trocar se não ler bem em PT-BR); se o modo escuro mantém o amarelo cheio nos botões.

## Direction contract

THESIS: A interface é uma folha em que a professora **grifa o que importa**. A tinta é preta, o papel é quente, e o amarelo de marca-texto aparece só onde há algo a revisar ou fazer. Recusa o painel de SaaS neutro com acento verde.

OWN-WORLD: papel off-white amarelado (#fbf9f1), tinta quase preta azulada (#16181d), marca-texto amarelo (#ffe14d) como cor de marca e gesto de assinatura, azul de caneta (#1f3fbf) para links e foco, vermelho de caneta de correção (#c8321f) para lacuna e erro, verde de "visto" (#1d7a4a) para certo e confirmado. Cabeçalho em tinta preta com o logotipo "s" + ".ai" grifado. Títulos em Bricolage Grotesque, texto em Geist. Alternativas como bolinhas de cartão-resposta (vazia, preenchida a lápis). Reconhecível sem conteúdo: barra preta, traço amarelo irregular sob o item ativo e bolinhas.

STORY: A professora entende em segundos qual tópico está grifado na turma e age (ver diagnóstico, gerar atividade). O aluno vê o que errou e **o trecho do material grifado** para revisar. Nada de cor decorativa: amarelo = olhe aqui.

FIRST VIEWPORT: (Painel, desktop) barra preta no topo com logotipo e navegação (Painel, Materiais, Atividades, Diagnóstico). Abaixo, título "Olá, Profa. Demo" com a frase "onde sua turma está travando" grifada; ação primária "Ver diagnóstico" em amarelo marca-texto; cartões das turmas com a lacuna principal grifada, a porcentagem em tipo grande e a fileira de cinco bolinhas de domínio. Em celular, a barra mantém os quatro itens numa linha.

FORM: Operate, formas padrão (barra de navegação, cartões, tabela, formulários, botões). O mundo entra só por tipo, paleta, densidade e um gesto: o grifo. Pin do usuário: `seed: none (pinned)` "pode seguir a sugestão que você disse".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
