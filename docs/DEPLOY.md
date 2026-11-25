# Deploy (Vercel + Supabase)

Passo a passo para colocar a demo no ar e mantê-la funcionando durante toda a avaliação.

## 1. Variáveis de ambiente

Configure no painel da Vercel (Project → Settings → Environment Variables), para **Production**:

| Variável | Onde obter | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys | pública |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys | **só servidor**; ignora RLS. Nunca no front |
| `GEMINI_API_KEY` | https://aistudio.google.com/apikey | sem ela a IA não funciona |
| `GEMINI_MODEL` | opcional | padrão `gemini-3.5-flash` |
| `SEED_PROFESSOR_PASSWORD` | você define | usada só pelo `npm run seed`; **não** precisa estar na Vercel |

O arquivo `.env.local` **não** vai para o repositório (está no `.gitignore`).

## 2. Banco de dados

1. O schema está em `supabase/migrations/` e precisa estar aplicado no projeto Supabase.
2. **Aplique as migrations em `supabase/migrations/`** (incluindo `20261124230000_professor_somente_por_admin.sql`,
   `20261125120000_disciplina_em_materiais.sql`, `20261125164500_busca_trechos_pgvector.sql` ,
   `20261125173500_eh_reforco_em_atividades.sql` e `20261125190000_turmas_nome_unico.sql`, `20261125200000_reforco_sessoes.sql` e `20261125210000_reforco_sessoes_grants.sql`).
   Rode-as no SQL Editor do Supabase. A primeira impede que alguém
   se cadastre como professor pelo cadastro público. Em Authentication → Sign In / Providers, desligue também
   "Allow new users to sign up" (o cadastro de alunos usa a chave administrativa e continua funcionando).
3. Com `SEED_PROFESSOR_PASSWORD` definida no `.env.local` (senha forte): `npm run seed` (professora, turmas e alunos) e `npm run seed:diagnostico`
   (25 alunos fictícios e entregas simuladas com lacunas desenhadas) e, para a evolução no tempo, `npm run seed:reforco`
   (um reforço fictício na 2ºA) e `npm run seed:matematica` (segunda disciplina, para o agrupamento por disciplina ter o que mostrar).
4. Depois do seed, abra o Diagnóstico das duas turmas e clique em **Gerar resumo com IA** uma vez em cada.
   O resumo fica guardado e a demo não depende da cota do Gemini para mostrá-lo.

## 3. Publicar

```bash
npx vercel login      # uma vez
npx vercel link       # liga ao projeto
npx vercel --prod
```

Ou conecte o repositório do GitHub na Vercel e cada `push` na `main` publica.

### Duração das ações de IA

A geração de questões leva cerca de 1 minuto e a correção de uma entrega, de 20 a 40 s. As páginas com
essas ações declaram `maxDuration` (`/atividades` e `/aluno/atividades/[id]`: 300 s; `/materiais` e
`/diagnostico`: 120 s). **Se o plano da Vercel não permitir esses valores, o build falha e aponta o limite**:
reduza os números nessas páginas e verifique se a geração ainda cabe no tempo.

## 4. Manter o Supabase ativo

O plano gratuito do Supabase **pausa o projeto após alguns dias sem uso**. Já aconteceu durante o
desenvolvimento. O `vercel.json` agenda uma chamada diária a `/api/saude`, que faz uma consulta leve ao
banco. Confirme em Vercel → Settings → Cron Jobs que o job aparece. Se pausar mesmo assim, restaure em
supabase.com/dashboard e a demo volta.

## 5. Riscos conhecidos (leia antes de enviar o link)

- **A professora tem login real**, com uma senha só sua (`SEED_PROFESSOR_PASSWORD`). Entregue essa senha aos
  avaliadores **só na submissão**, nunca no repositório. Quem a tiver pode gerar questões e gastar a cota do Gemini.
  O vídeo e o repositório são públicos; o painel da professora não.
- **Cadastro público do Supabase:** sem a migration acima, alguém poderia criar uma conta de professor pela API.
- **Cota gratuita do Gemini:** 20 requisições por dia por modelo. O código tenta outros modelos quando um
  esgota, e o feedback do aluno tem plano B sem IA, mas a geração de questões pode falhar. Considere
  ativar o faturamento na chave durante a avaliação.
- **Dados fictícios apenas.** Nenhum dado pessoal real deve estar no banco da demo.

## 6. Lista de conferência

- [ ] Build local: `npm run build`
- [ ] Variáveis configuradas na Vercel
- [ ] Seed rodado e resumos do Diagnóstico gerados nas duas turmas
- [ ] Migration de segurança aplicada e "Allow new users to sign up" desligado
- [ ] Abrir o site em janela anônima: tudo (menos /entrar e /cadastro) deve mandar para a entrada
- [ ] Entrar como professora e como aluno fictício
- [ ] Entrar como aluno fictício e responder uma atividade ponta a ponta
- [ ] `/api/saude` responde `{"ok":true}`
- [ ] Cron aparece no painel da Vercel
- [ ] Vídeo (≤ 3 min) hospedado e com acesso sem login
