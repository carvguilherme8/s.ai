-- 1) Disciplina do Material (ex.: Física, Matemática). Os Tópicos herdam a disciplina do Material.
--    Serve para agrupar a revisão por disciplina (aluno) e filtrar o Diagnóstico (professora).
--    Texto livre; os valores permitidos ficam no app (src/lib/disciplinas.ts). Não altera dados existentes.
alter table public.materiais add column if not exists disciplina text;

-- 2) O Aluno também pode ler os Materiais usados em Atividades publicadas para a Turma dele.
--    Antes só via os Materiais cadastrados na própria Turma; mas o mesmo Material serve a várias Turmas.
create or replace function public.material_visivel_ao_aluno(p_material uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.materiais m
    where m.id = p_material
      and (
        m.turma_id = (select turma_id from public.profiles where id = auth.uid())
        or exists (
          select 1 from public.atividades a
          where a.material_id = m.id and a.status = 'publicada'
            and a.turma_id = (select turma_id from public.profiles where id = auth.uid())
        )
      )
  )
$$;
grant execute on function public.material_visivel_ao_aluno(uuid) to authenticated, service_role;

create policy "aluno vê materiais das atividades da turma" on public.materiais for select to authenticated
  using (public.material_visivel_ao_aluno(id));

create policy "aluno vê trechos das atividades da turma" on public.material_trechos for select to authenticated
  using (public.material_visivel_ao_aluno(material_id));

create policy "aluno baixa PDFs das atividades da turma" on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and exists (
    select 1 from public.materiais m
    where m.storage_path = storage.objects.name and public.material_visivel_ao_aluno(m.id)));
