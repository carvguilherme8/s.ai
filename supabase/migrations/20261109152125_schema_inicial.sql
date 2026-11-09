-- s.ai — schema inicial
-- Vocabulário: ver CONTEXT.md. Regras: ver docs/ESCOPO.md.
--
-- Convenções:
--   * Toda tabela em public tem RLS ativo e GRANTs explícitos (a exposição automática
--     de tabelas na Data API está desligada no projeto).
--   * Escritas sensíveis (correção, nota, Feedback, Entrega) são feitas pelo servidor
--     com a service_role, que ignora RLS. Alunos só leem.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.papel as enum ('professor', 'aluno');
create type public.tipo_material as enum ('pdf', 'texto');
create type public.tipo_questao as enum ('multipla_escolha', 'dissertativa');
create type public.status_atividade as enum ('rascunho', 'publicada');

-- ---------------------------------------------------------------------------
-- Pessoas e Turmas
-- ---------------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  papel      public.papel not null,
  nome       text not null,
  turma_id   uuid,  -- só Aluno; FK adicionada após criar turmas
  created_at timestamptz not null default now(),
  constraint aluno_tem_turma check (
    (papel = 'aluno' and turma_id is not null) or (papel = 'professor' and turma_id is null)
  )
);

create table public.turmas (
  id              uuid primary key default gen_random_uuid(),
  professor_id    uuid not null references public.profiles (id) on delete cascade,
  nome            text not null,
  codigo_convite  text not null unique
                  default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
  created_at      timestamptz not null default now()
);
create index on public.turmas (professor_id);

alter table public.profiles
  add constraint profiles_turma_fk foreign key (turma_id) references public.turmas (id) on delete set null;
create index on public.profiles (turma_id);

-- ---------------------------------------------------------------------------
-- Conteúdo
-- ---------------------------------------------------------------------------
create table public.materiais (
  id             uuid primary key default gen_random_uuid(),
  professor_id   uuid not null references public.profiles (id) on delete cascade,
  turma_id       uuid not null references public.turmas (id) on delete cascade,
  titulo         text not null,
  tipo           public.tipo_material not null,
  storage_path   text,           -- PDFs no bucket "materiais": {professor_id}/{material_id}.pdf
  conteudo_texto text,           -- texto colado ou extraído do PDF
  created_at     timestamptz not null default now(),
  constraint pdf_tem_arquivo check (tipo <> 'pdf' or storage_path is not null)
);
create index on public.materiais (turma_id);
create index on public.materiais (professor_id);

-- Trechos do Material para recuperação (pgvector). Gemini embeddings com 768 dimensões.
create table public.material_trechos (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais (id) on delete cascade,
  ordem       int not null,
  pagina      int,
  conteudo    text not null,
  embedding   extensions.vector(768),
  unique (material_id, ordem)
);
create index on public.material_trechos using hnsw (embedding extensions.vector_cosine_ops);

create table public.topicos (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles (id) on delete cascade,
  material_id  uuid references public.materiais (id) on delete set null,
  nome         text not null,
  descricao    text,
  confirmado   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index on public.topicos (professor_id);

create table public.atividades (
  id           uuid primary key default gen_random_uuid(),
  professor_id uuid not null references public.profiles (id) on delete cascade,
  turma_id     uuid not null references public.turmas (id) on delete cascade,
  material_id  uuid references public.materiais (id) on delete set null,
  titulo       text not null,
  status       public.status_atividade not null default 'rascunho',
  prazo        timestamptz,
  publicada_em timestamptz,
  created_at   timestamptz not null default now()
);
create index on public.atividades (turma_id, status);

create table public.questoes (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  topico_id    uuid not null references public.topicos (id) on delete restrict,
  trecho_id    uuid references public.material_trechos (id) on delete set null,
  tipo         public.tipo_questao not null,
  ordem        int not null default 0,
  enunciado    text not null,
  rubrica      jsonb,  -- só dissertativa
  constraint dissertativa_tem_rubrica check (tipo <> 'dissertativa' or rubrica is not null)
);
create index on public.questoes (atividade_id);
create index on public.questoes (topico_id);

-- Alternativas de múltipla escolha. Distrator = alternativa com correta = false; equivoco descreve o Equívoco.
create table public.alternativas (
  id         uuid primary key default gen_random_uuid(),
  questao_id uuid not null references public.questoes (id) on delete cascade,
  ordem      int not null default 0,
  texto      text not null,
  correta    boolean not null default false,
  equivoco   text,
  constraint distrator_tem_equivoco check (correta or equivoco is not null)
);
create index on public.alternativas (questao_id);

-- ---------------------------------------------------------------------------
-- Entrega e Feedback
-- ---------------------------------------------------------------------------
create table public.entregas (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades (id) on delete cascade,
  aluno_id     uuid not null references public.profiles (id) on delete cascade,
  enviada_em   timestamptz not null default now(),
  feedback     jsonb,  -- gerado uma vez por Entrega (cache)
  unique (atividade_id, aluno_id)  -- uma Entrega por Aluno por Atividade
);
create index on public.entregas (aluno_id);

create table public.respostas (
  id             uuid primary key default gen_random_uuid(),
  entrega_id     uuid not null references public.entregas (id) on delete cascade,
  questao_id     uuid not null references public.questoes (id) on delete cascade,
  alternativa_id uuid references public.alternativas (id) on delete set null,
  texto          text,
  nota_ia        numeric(4, 3) check (nota_ia between 0 and 1),
  nota_ajustada  numeric(4, 3) check (nota_ajustada between 0 and 1),  -- Professor ajusta
  correcao       jsonb,
  unique (entrega_id, questao_id)
);
create index on public.respostas (questao_id);

-- Resumo IA do Diagnóstico (sob demanda, com cache)
create table public.diagnostico_resumos (
  turma_id  uuid primary key references public.turmas (id) on delete cascade,
  conteudo  jsonb not null,
  gerado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Funções auxiliares (security definer evita recursão nas policies)
-- ---------------------------------------------------------------------------
create or replace function public.meu_papel()
returns public.papel language sql stable security definer set search_path = '' as $$
  select papel from public.profiles where id = auth.uid()
$$;

create or replace function public.minha_turma()
returns uuid language sql stable security definer set search_path = '' as $$
  select turma_id from public.profiles where id = auth.uid()
$$;

create or replace function public.sou_professor_da_turma(p_turma uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.turmas where id = p_turma and professor_id = auth.uid())
$$;

create or replace function public.ja_entreguei(p_atividade uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.entregas where atividade_id = p_atividade and aluno_id = auth.uid())
$$;

-- Atividade publicada na Turma do Aluno logado?
create or replace function public.atividade_visivel_ao_aluno(p_atividade uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.atividades a
    where a.id = p_atividade and a.status = 'publicada'
      and a.turma_id = (select turma_id from public.profiles where id = auth.uid())
  )
$$;

-- Questões para o Aluno responder, SEM gabarito, rubrica nem equívocos.
create or replace function public.questoes_para_responder(p_atividade uuid)
returns table (
  questao_id uuid, ordem int, tipo public.tipo_questao, enunciado text, topico text,
  alternativas jsonb
) language sql stable security definer set search_path = '' as $$
  select q.id, q.ordem, q.tipo, q.enunciado, t.nome,
         coalesce((
           select jsonb_agg(jsonb_build_object('id', al.id, 'texto', al.texto) order by al.ordem)
           from public.alternativas al where al.questao_id = q.id
         ), '[]'::jsonb)
  from public.questoes q
  join public.topicos t on t.id = q.topico_id
  where q.atividade_id = p_atividade
    and public.atividade_visivel_ao_aluno(p_atividade)
  order by q.ordem
$$;

-- ---------------------------------------------------------------------------
-- Cadastro: cria o profile a partir dos metadados do signUp.
--   Professor: { papel: 'professor', nome }
--   Aluno:     { papel: 'aluno', nome, codigo_convite }
-- Código de convite inválido faz o cadastro falhar.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_papel public.papel := coalesce(new.raw_user_meta_data ->> 'papel', 'aluno')::public.papel;
  v_nome  text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
  v_turma uuid;
begin
  if v_papel = 'aluno' then
    select id into v_turma from public.turmas
    where codigo_convite = upper(trim(new.raw_user_meta_data ->> 'codigo_convite'));
    if v_turma is null then
      raise exception 'Código de convite inválido' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, papel, nome, turma_id) values (new.id, v_papel, v_nome, v_turma);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Publicação: carimba a data.
create or replace function public.carimbar_publicacao()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'publicada' and old.status = 'rascunho' then
    new.publicada_em := now();
  end if;
  return new;
end;
$$;

create trigger atividades_publicacao
  before update of status on public.atividades
  for each row execute function public.carimbar_publicacao();

-- Uma Atividade publicada não volta a Rascunho.
create or replace function public.impedir_despublicar()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status = 'publicada' and new.status = 'rascunho' then
    raise exception 'Atividade publicada não pode voltar a Rascunho';
  end if;
  return new;
end;
$$;

create trigger atividades_sem_despublicar
  before update of status on public.atividades
  for each row execute function public.impedir_despublicar();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.turmas              enable row level security;
alter table public.materiais           enable row level security;
alter table public.material_trechos    enable row level security;
alter table public.topicos             enable row level security;
alter table public.atividades          enable row level security;
alter table public.questoes            enable row level security;
alter table public.alternativas        enable row level security;
alter table public.entregas            enable row level security;
alter table public.respostas           enable row level security;
alter table public.diagnostico_resumos enable row level security;

-- profiles: cada um vê o próprio; Professor vê os Alunos das suas Turmas.
create policy "ver próprio profile" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "professor vê alunos das suas turmas" on public.profiles for select to authenticated
  using (turma_id is not null and public.sou_professor_da_turma(turma_id));
create policy "editar próprio nome" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- turmas
create policy "professor gerencia suas turmas" on public.turmas for all to authenticated
  using (professor_id = (select auth.uid()))
  with check (professor_id = (select auth.uid()) and public.meu_papel() = 'professor');
create policy "aluno vê sua turma" on public.turmas for select to authenticated
  using (id = public.minha_turma());

-- materiais
create policy "professor gerencia seus materiais" on public.materiais for all to authenticated
  using (professor_id = (select auth.uid()))
  with check (professor_id = (select auth.uid()) and public.sou_professor_da_turma(turma_id));
create policy "aluno vê materiais da turma" on public.materiais for select to authenticated
  using (turma_id = public.minha_turma());

-- material_trechos
create policy "professor gerencia trechos" on public.material_trechos for all to authenticated
  using (exists (select 1 from public.materiais m where m.id = material_id and m.professor_id = (select auth.uid())))
  with check (exists (select 1 from public.materiais m where m.id = material_id and m.professor_id = (select auth.uid())));
create policy "aluno vê trechos da turma" on public.material_trechos for select to authenticated
  using (exists (select 1 from public.materiais m where m.id = material_id and m.turma_id = public.minha_turma()));

-- topicos
create policy "professor gerencia seus tópicos" on public.topicos for all to authenticated
  using (professor_id = (select auth.uid()))
  with check (professor_id = (select auth.uid()));
create policy "aluno vê tópicos confirmados das questões da turma" on public.topicos for select to authenticated
  using (confirmado and exists (
    select 1 from public.questoes q join public.atividades a on a.id = q.atividade_id
    where q.topico_id = topicos.id and a.status = 'publicada' and a.turma_id = public.minha_turma()
  ));

-- atividades: Aluno nunca vê Rascunho.
create policy "professor gerencia suas atividades" on public.atividades for all to authenticated
  using (professor_id = (select auth.uid()))
  with check (professor_id = (select auth.uid()) and public.sou_professor_da_turma(turma_id));
create policy "aluno vê atividades publicadas da turma" on public.atividades for select to authenticated
  using (status = 'publicada' and turma_id = public.minha_turma());

-- questoes / alternativas: Aluno só lê direto (com gabarito) DEPOIS da Entrega.
-- Antes disso, usa a função questoes_para_responder().
create policy "professor gerencia questões" on public.questoes for all to authenticated
  using (exists (select 1 from public.atividades a where a.id = atividade_id and a.professor_id = (select auth.uid())))
  with check (exists (select 1 from public.atividades a where a.id = atividade_id and a.professor_id = (select auth.uid())));
create policy "aluno vê questões após entrega" on public.questoes for select to authenticated
  using (public.ja_entreguei(atividade_id));

create policy "professor gerencia alternativas" on public.alternativas for all to authenticated
  using (exists (
    select 1 from public.questoes q join public.atividades a on a.id = q.atividade_id
    where q.id = questao_id and a.professor_id = (select auth.uid())))
  with check (exists (
    select 1 from public.questoes q join public.atividades a on a.id = q.atividade_id
    where q.id = questao_id and a.professor_id = (select auth.uid())));
create policy "aluno vê alternativas após entrega" on public.alternativas for select to authenticated
  using (exists (select 1 from public.questoes q where q.id = questao_id and public.ja_entreguei(q.atividade_id)));

-- entregas / respostas: escrita via servidor (service_role). Leitura:
create policy "aluno vê suas entregas" on public.entregas for select to authenticated
  using (aluno_id = (select auth.uid()));
create policy "professor vê entregas das suas atividades" on public.entregas for select to authenticated
  using (exists (select 1 from public.atividades a where a.id = atividade_id and a.professor_id = (select auth.uid())));

create policy "aluno vê suas respostas" on public.respostas for select to authenticated
  using (exists (select 1 from public.entregas e where e.id = entrega_id and e.aluno_id = (select auth.uid())));
create policy "professor vê respostas das suas atividades" on public.respostas for select to authenticated
  using (exists (
    select 1 from public.entregas e join public.atividades a on a.id = e.atividade_id
    where e.id = entrega_id and a.professor_id = (select auth.uid())));
create policy "professor ajusta nota" on public.respostas for update to authenticated
  using (exists (
    select 1 from public.entregas e join public.atividades a on a.id = e.atividade_id
    where e.id = entrega_id and a.professor_id = (select auth.uid())));

-- diagnostico_resumos: só o Professor da Turma lê; escrita via servidor.
create policy "professor vê resumo da turma" on public.diagnostico_resumos for select to authenticated
  using (public.sou_professor_da_turma(turma_id));

-- ---------------------------------------------------------------------------
-- GRANTs (Data API) — anon não acessa nenhuma tabela.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;

grant select, update (nome)               on public.profiles            to authenticated;
grant select, insert, update, delete      on public.turmas              to authenticated;
grant select, insert, update, delete      on public.materiais           to authenticated;
grant select, insert, update, delete      on public.material_trechos    to authenticated;
grant select, insert, update, delete      on public.topicos             to authenticated;
grant select, insert, update, delete      on public.atividades          to authenticated;
grant select, insert, update, delete      on public.questoes            to authenticated;
grant select, insert, update, delete      on public.alternativas        to authenticated;
grant select                              on public.entregas            to authenticated;
grant select, update (nota_ajustada)      on public.respostas           to authenticated;
grant select                              on public.diagnostico_resumos to authenticated;

grant all on all tables in schema public to service_role;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.meu_papel(), public.minha_turma(),
  public.sou_professor_da_turma(uuid), public.ja_entreguei(uuid),
  public.atividade_visivel_ao_aluno(uuid), public.questoes_para_responder(uuid)
  to authenticated;
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado "materiais", caminho {professor_id}/{material_id}.pdf
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

create policy "professor envia PDFs na própria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.meu_papel() = 'professor');
create policy "professor gerencia seus PDFs" on storage.objects for all to authenticated
  using (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "aluno baixa PDFs da turma" on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and exists (
    select 1 from public.materiais m
    where m.storage_path = storage.objects.name and m.turma_id = public.minha_turma()));
