-- Sessões de reforço individual do aluno: o gabarito fica no servidor, nunca vai ao navegador.
-- Não entra no Diagnóstico (não toca em entregas/respostas). Só a chave de serviço acessa.
create table public.reforco_sessoes (
  id          uuid primary key default gen_random_uuid(),
  aluno_id    uuid not null references public.profiles (id) on delete cascade,
  topico_id   uuid not null references public.topicos (id) on delete cascade,
  gabarito    jsonb not null,
  expira_em   timestamptz not null,
  usada_em    timestamptz,
  created_at  timestamptz not null default now()
);
create index on public.reforco_sessoes (aluno_id, created_at desc);

-- RLS ligado e sem nenhuma política: aluno e professor não leem nem gravam por aqui.
alter table public.reforco_sessoes enable row level security;
revoke all on public.reforco_sessoes from anon, authenticated;
