# s.ai

Plataforma para professores do ensino médio público (foco em ENEM) descobrirem onde suas turmas e alunos têm lacunas de aprendizado e o que revisar para cobri-las.

## Pessoas e organização

**Professor**:
Usuário que mantém Turmas, envia Materiais de apoio e publica Questões.
_Avoid_: Docente, instrutor, admin

**Aluno**:
Usuário que pertence a exatamente uma Turma e responde às Questões publicadas para ela.
_Avoid_: Estudante, usuário

**Turma**:
Grupo de Alunos sob um único Professor (ex.: "2ºA"); é o destino de Materiais e Questões.
_Avoid_: Classe, sala, grupo

**Código de convite**:
Código gerado pelo Professor para uma Turma, usado pelo Aluno para se cadastrar nela.
_Avoid_: Token, link de acesso

## Conteúdo

**Material de apoio**:
Conteúdo enviado pelo Professor e acessível aos Alunos; é a fonte principal das Questões e Tópicos.
_Avoid_: Arquivo, documento, conteúdo

**Tópico**:
Unidade de conhecimento extraída pela IA de um Material de apoio e confirmada pelo Professor; é a unidade em que as Lacunas são medidas.
_Avoid_: Assunto, habilidade, tag

**Questão**:
Item avaliativo, de múltipla escolha ou dissertativo, gerado pela IA a partir de um Material de apoio (ou de um tema digitado) e ligado a um Tópico.
_Avoid_: Pergunta, exercício

**Rubrica**:
Critérios esperados de resposta de uma Questão dissertativa, gerados junto com ela e revisáveis pelo Professor; base da correção.
_Avoid_: Gabarito, critério

**Atividade**:
Conjunto de Questões publicado de uma vez para uma Turma, com prazo opcional.
_Avoid_: Lista, prova, tarefa, quiz

**Rascunho**:
Estado de uma Atividade (e suas Questões) que o Professor ainda não revisou; Alunos nunca veem Rascunhos.
_Avoid_: Pendente, sugestão

**Publicação**:
Ato do Professor de liberar uma Atividade revisada para uma Turma.
_Avoid_: Envio, disparo

**Entrega**:
Conjunto das respostas de um Aluno a uma Atividade; cada Aluno faz uma única Entrega por Atividade.
_Avoid_: Submissão, tentativa, envio

**Distrator**:
Alternativa errada de uma Questão de múltipla escolha, ligada a um Equívoco específico.
_Avoid_: Alternativa falsa, pegadinha

**Equívoco**:
Erro conceitual conhecido que um Distrator representa; escolher o Distrator indica esse Equívoco.
_Avoid_: Erro, confusão

## Diagnóstico

**Domínio**:
Medida, por Tópico, de quanto um Aluno ou uma Turma acerta das Questões daquele Tópico; calculada, nunca estimada pela IA.
_Avoid_: Nota, score, proficiência

**Lacuna**:
Tópico em que um Aluno ou uma Turma demonstra domínio insuficiente, segundo suas respostas.
_Avoid_: Dificuldade, deficiência, gap

**Diagnóstico**:
Visão entregue ao Professor que indica as Lacunas da Turma e dos Alunos e onde focar para cobri-las. É o diferencial central do produto.
_Avoid_: Relatório, insights, analytics

**Feedback**:
Retorno personalizado gerado pela IA para o Aluno após sua Entrega: explica os erros e aponta o trecho do Material de apoio a revisar.
_Avoid_: Correção, comentário

**Questão de reforço**:
Questão gerada para um Aluno sobre suas Lacunas, para praticar; não entra no Domínio nem no Diagnóstico.
_Avoid_: Exercício extra, treino
