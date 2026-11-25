-- Marca explicitamente atividades de reforço (em vez de depender apenas do prefixo no título).
alter table public.atividades add column if not exists eh_reforco boolean not null default false;

update public.atividades
set eh_reforco = true
where titulo like 'Reforço%' and eh_reforco = false;
