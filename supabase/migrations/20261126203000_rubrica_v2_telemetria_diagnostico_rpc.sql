-- s.ai — Rubrica v2 (blocos/pílulas), Regras Globais, Presets do Professor,
-- Trava Humana de Revisão, Telemetria Cognitiva e SQL RPC de Diagnóstico (sem limite de 1000 linhas).

-- ---------------------------------------------------------------------------
-- 1. Novas colunas em atividades, entregas e respostas (retrocompatíveis)
-- ---------------------------------------------------------------------------
alter table public.atividades
  add column if not exists regras_globais jsonb not null default '{}'::jsonb,
  add column if not exists revisar_antes_liberar boolean not null default false;

alter table public.entregas
  add column if not exists liberada_em timestamptz,
  add column if not exists desconsiderar_diagnostico boolean not null default false;

-- Backfill: entregas já existentes permanecem liberadas para os alunos.
update public.entregas
set liberada_em = enviada_em
where liberada_em is null;

alter table public.respostas
  add column if not exists telemetria jsonb,
  add column if not exists revisada_em timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Presets reutilizáveis de rubrica/regras do professor por disciplina
-- ---------------------------------------------------------------------------
create table if not exists public.professor_rubrica_presets (
  id             uuid primary key default gen_random_uuid(),
  professor_id   uuid not null references public.profiles (id) on delete cascade,
  disciplina     text,
  nome           text not null,
  regras_globais jsonb not null default '{}'::jsonb,
  pilulas_padrao jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists professor_rubrica_presets_prof_disc_idx
  on public.professor_rubrica_presets (professor_id, disciplina);

alter table public.professor_rubrica_presets enable row level security;

drop policy if exists "professor gerencia seus presets" on public.professor_rubrica_presets;
create policy "professor gerencia seus presets"
  on public.professor_rubrica_presets for all to authenticated
  using (professor_id = (select auth.uid()))
  with check (professor_id = (select auth.uid()));

grant select, insert, update, delete on public.professor_rubrica_presets to authenticated;
grant all on public.professor_rubrica_presets to service_role;

-- ---------------------------------------------------------------------------
-- 3. SQL RPC agregada de Diagnóstico (elimina truncamento max_rows=1000 do PostgREST
--    e unifica distratores de múltipla escolha + falhas/penalidades das dissertativas)
-- ---------------------------------------------------------------------------
create or replace function public.diagnostico_agregado_professor(p_professor uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with turmas_prof as (
  select t.id, t.nome
  from public.turmas t
  where t.professor_id = p_professor
  order by t.nome
),
alunos_prof as (
  select p.id, p.nome, p.turma_id
  from public.profiles p
  join turmas_prof tp on tp.id = p.turma_id
  where p.papel = 'aluno'
),
atividades_pub as (
  select
    a.id,
    a.turma_id,
    a.titulo,
    coalesce(a.publicada_em, a.created_at) as data_ref,
    a.eh_reforco
  from public.atividades a
  join turmas_prof tp on tp.id = a.turma_id
  where a.professor_id = p_professor
    and a.status = 'publicada'
),
entregas_validas as (
  select
    e.id,
    e.aluno_id,
    e.atividade_id,
    e.enviada_em,
    a.turma_id
  from public.entregas e
  join atividades_pub a on a.id = e.atividade_id
  where coalesce(e.desconsiderar_diagnostico, false) = false
),
respostas_base as (
  select
    ev.turma_id,
    ev.aluno_id,
    ev.atividade_id,
    ev.id as entrega_id,
    q.topico_id,
    q.tipo as questao_tipo,
    mt.pagina,
    coalesce(r.nota_ajustada, r.nota_ia)::double precision as nota_efetiva,
    al.correta as alt_correta,
    al.equivoco as alt_equivoco,
    r.correcao
  from public.respostas r
  join entregas_validas ev on ev.id = r.entrega_id
  join public.questoes q on q.id = r.questao_id
  left join public.material_trechos mt on mt.id = q.trecho_id
  left join public.alternativas al on al.id = r.alternativa_id
),
topicos_por_turma as (
  select
    rb.turma_id,
    rb.topico_id,
    t.nome,
    m.disciplina,
    coalesce(
      array_agg(distinct rb.pagina order by rb.pagina) filter (where rb.pagina is not null),
      '{}'::int[]
    ) as paginas
  from respostas_base rb
  join public.topicos t on t.id = rb.topico_id
  left join public.materiais m on m.id = t.material_id
  group by rb.turma_id, rb.topico_id, t.nome, m.disciplina
  order by rb.turma_id, t.nome
),
celulas_aluno as (
  select
    rb.turma_id,
    rb.aluno_id,
    rb.topico_id,
    count(*)::int as respondidas,
    (count(*) filter (where rb.nota_efetiva >= 1))::int as acertos,
    avg(rb.nota_efetiva)::double precision as media
  from respostas_base rb
  where rb.nota_efetiva is not null
  group by rb.turma_id, rb.aluno_id, rb.topico_id
),
evolucao_por_aluno as (
  select
    rb.turma_id,
    rb.atividade_id,
    rb.topico_id,
    rb.aluno_id,
    avg(rb.nota_efetiva)::double precision as media_aluno
  from respostas_base rb
  where rb.nota_efetiva is not null
  group by rb.turma_id, rb.atividade_id, rb.topico_id, rb.aluno_id
),
evolucao_turma as (
  select
    epa.turma_id,
    epa.atividade_id,
    epa.topico_id,
    count(*)::int as alunos_com_dados,
    avg(epa.media_aluno)::double precision as media_turma
  from evolucao_por_aluno epa
  group by epa.turma_id, epa.atividade_id, epa.topico_id
),
equivocos_unificados as (
  select turma_id, topico_id, equivoco, count(*)::int as vezes
  from (
    -- Múltipla escolha: distrator escolhido
    select
      rb.turma_id,
      rb.topico_id,
      rb.alt_equivoco as equivoco
    from respostas_base rb
    where rb.alt_correta = false
      and rb.alt_equivoco is not null
      and length(trim(rb.alt_equivoco)) > 0

    union all

    -- Dissertativa (Rubrica v2): critérios não atingidos e penalidades acionadas
    select
      rb.turma_id,
      rb.topico_id,
      f.falha as equivoco
    from respostas_base rb
    cross join lateral jsonb_array_elements_text(
      case
        when rb.correcao is not null and jsonb_typeof(rb.correcao -> 'falhas_diagnostico') = 'array'
          then rb.correcao -> 'falhas_diagnostico'
        else '[]'::jsonb
      end
    ) as f(falha)
    where rb.questao_tipo = 'dissertativa'
      and length(trim(f.falha)) > 0
  ) todos
  group by turma_id, topico_id, equivoco
  order by vezes desc, equivoco asc
),
entregas_stats as (
  select
    ev.turma_id,
    count(*)::int as total_entregas,
    max(ev.enviada_em) as ultima_entrega,
    coalesce(array_agg(distinct ev.aluno_id), '{}'::uuid[]) as alunos_entregaram,
    coalesce(array_agg(distinct ev.atividade_id), '{}'::uuid[]) as atividades_com_entrega
  from entregas_validas ev
  group by ev.turma_id
)
select jsonb_build_object(
  'turmas', coalesce((select jsonb_agg(to_jsonb(t) order by t.nome) from turmas_prof t), '[]'::jsonb),
  'alunos', coalesce((select jsonb_agg(to_jsonb(a)) from alunos_prof a), '[]'::jsonb),
  'atividades', coalesce((select jsonb_agg(to_jsonb(at) order by at.data_ref) from atividades_pub at), '[]'::jsonb),
  'topicos', coalesce((select jsonb_agg(to_jsonb(tp)) from topicos_por_turma tp), '[]'::jsonb),
  'celulas_aluno', coalesce((select jsonb_agg(to_jsonb(ca)) from celulas_aluno ca), '[]'::jsonb),
  'evolucao', coalesce((select jsonb_agg(to_jsonb(et)) from evolucao_turma et), '[]'::jsonb),
  'equivocos', coalesce((select jsonb_agg(to_jsonb(eq)) from equivocos_unificados eq), '[]'::jsonb),
  'entregas_stats', coalesce((select jsonb_agg(to_jsonb(es)) from entregas_stats es), '[]'::jsonb)
);
$$;

revoke execute on function public.diagnostico_agregado_professor(uuid) from public, anon, authenticated;
grant execute on function public.diagnostico_agregado_professor(uuid) to service_role;
