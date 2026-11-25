---
name: s.ai
description: Uma folha em que a professora grifa o que importa.
colors:
  papel: "#fbf9f1"
  folha: "#fffefa"
  papel-fundo: "#f3efe1"
  linha: "#e5dfcc"
  linha-forte: "#857f6d"
  tinta: "#16181d"
  tinta-suave: "#5d5b52"
  marca-texto: "#ffe14d"
  marca-texto-hover: "#ffd51a"
  caneta-azul: "#1f3fbf"
  visto: "#1d7a4a"
  visto-fundo: "#e1f1e6"
  visto-tinta: "#14532f"
  correcao: "#b92c1a"
  correcao-fundo: "#fbe6e1"
  aviso-fundo: "#fff1b8"
  aviso-tinta: "#5c4600"
  barra: "#16181d"
  barra-tinta: "#fbf9f1"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Geist, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Bricolage Grotesque, Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
  code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    letterSpacing: "0.05em"
rounded:
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.marca-texto}"
    textColor: "{colors.tinta}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.marca-texto-hover}"
  button-secondary:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  field:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.folha}"
    textColor: "{colors.tinta}"
    rounded: "{rounded.lg}"
    padding: "20px"
  nav-bar:
    backgroundColor: "{colors.barra}"
    textColor: "{colors.barra-tinta}"
    padding: "10px 16px"
  badge-ok:
    backgroundColor: "{colors.visto-fundo}"
    textColor: "{colors.visto-tinta}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: s.ai

## 1. Overview

**North star: a folha grifada.** A interface é uma folha de papel em que a professora marca o que importa. A tinta é preta, o papel é quente, e o amarelo de marca-texto aparece só onde há algo a revisar ou a fazer. Quem usa ferramentas como esta (painel, formulário, tabela) encontra tudo onde espera; o mundo entra por **tipografia, paleta, densidade e um único gesto**: o grifo.

O produto é Operate: a professora trabalha no computador, o aluno no celular. Navegação, cartões, tabelas e formulários seguem os padrões conhecidos da web. A identidade nunca substitui a organização da tela.

**Key characteristics:**
- Cabeçalho em tinta preta com o logotipo "s.ai" (o ".ai" grifado) e o item ativo grifado.
- Um só gesto de assinatura, o **grifo**, reservado para a lacuna, o que revisar e a ação principal.
- Bolinhas de cartão-resposta (ENEM) só onde há escolha ou dado: alternativas e a fileira de domínio.
- Vermelho (caneta de correção) para lacuna e erro, azul (caneta) para link e foco, verde (visto) para certo.

## 2. Colors

Papel, tinta e três canetas. O amarelo é cor de marca e não tem papel de status: significa "olhe aqui".

### Primary
- **Marca-texto** (#ffe14d): preenchimento do botão primário, do grifo e da seleção de texto. O texto sobre ele é sempre **Tinta**.
- **Tinta** (#16181d): texto, bordas do botão primário, rádios preenchidos e a barra de cabeçalho.

### Secondary
- **Caneta azul** (#1f3fbf): links e anel de foco. Em tema escuro vira #93a8ff.
- **Correção** (#b92c1a): lacuna, erro e a porcentagem em destaque.
- **Visto** (#1d7a4a): certo, confirmado, conexão ok.

### Neutral
- **Papel** (#fbf9f1) é o fundo; **Folha** (#fffefa) é a superfície de cartões e campos; **Papel-fundo** (#f3efe1) é o rebaixo; **Linha** (#e5dfcc) separa; **Linha-forte** (#857f6d) contorna controles (contraste ≥ 3:1); **Tinta-suave** (#5d5b52) é texto secundário.

**The One Voice Rule.** O amarelo nunca vira cor de status, de gráfico ou de decoração. Se nada deve ser olhado ou feito ali, não leva amarelo.

**Mapa de calor.** O Diagnóstico usa uma escala divergente em torno da meta de 60% (vermelho abaixo, cinza no limite, azul acima), sempre com o número e um ícone na célula, nunca só cor.

**Sempre claro.** O site não segue o modo escuro do aparelho: `color-scheme: light` e nenhuma regra `prefers-color-scheme: dark`. A cor da barra do navegador no celular é a do cabeçalho (#16181d).

## 3. Typography

**Display:** Bricolage Grotesque (títulos e números em destaque). **Body/UI:** Geist. **Code:** Geist Mono (códigos de convite).

- **Display** (700, 2.25rem, -0.02em): título da página inicial; nas demais telas 1.875rem.
- **Headline** (700, 1.25rem): seções.
- **Body** (400, 0.9375rem, 1.55): texto corrido; medida máxima da prosa 65ch.
- **Label** (600, 0.8125rem): botões, selos e rótulos de formulário.
- Números alinhados usam algarismos tabulares (tabelas e mapa).

**The Display Is for Meaning Rule.** Bricolage só em títulos e em números que importam (porcentagem de domínio); texto de interface fica em Geist.

## 4. Elevation

Sem sombras. A profundidade vem de borda de 1px (cartões) e de mudança de tom (rebaixo). O foco é um anel de 2px em Caneta azul. Em estados de hover os fundos mudam de tom; nada se move além de 1px no clique.

## 5. Components

- **Botão primário:** fundo Marca-texto, texto Tinta, borda de 1px em Tinta, 8px de raio, 40px de altura mínima, peso 600. Hover escurece o amarelo.
- **Botão secundário:** Folha com borda Linha-forte; hover Papel-fundo. **Perigo:** texto Correção.
- **Campo:** Folha, borda Linha-forte, 8px de raio; foco troca a borda para Caneta azul e adiciona anel suave.
- **Cartão:** Folha, borda Linha, 12px de raio, 20px de respiro. Sem cartão dentro de cartão.
- **Selo:** pílula pequena; variantes neutro, certo, aviso, erro (fundo suave + texto escuro, contraste ≥ 4.5:1).
- **Barra de navegação:** Tinta, itens em Barra-tinta a 70%; item ativo **grifado**.
- **Rádio e bolha:** rádio de 20px com borda de 2px em Tinta, preenchido quando marcado. A "bolha" de letra (A–D) tem 24px; preenchida marca a alternativa escolhida.
- **Grifo (assinatura):** passada amarela com bordas irregulares e `box-decoration-break: clone`, seguindo o texto em várias linhas. Variante `grifo-base` só no terço inferior.
- **Fileira de bolinhas:** cinco círculos de 12px, cada um vale 20% de domínio; mostrada junto do número exato, nunca sozinha.

## 6. Do's and Don'ts

### Do:
- **Do** reservar o grifo para o que a professora ou o aluno deve olhar: lacuna, trecho a revisar, item ativo, ação principal.
- **Do** manter número e ícone ao lado de qualquer cor que carregue significado.
- **Do** usar texto Tinta sobre Marca-texto, nos dois temas.

### Don't:
- **Don't** usar amarelo como cor de status ou de série de gráfico.
- **Don't** espalhar grifo em títulos decorativos: se tudo é grifado, nada é.
- **Don't** usar bolinhas como decoração; só onde há escolha ou dado.
- **Don't** trocar controles por versões "temáticas": botões, campos, tabelas e navegação seguem o padrão da web.
