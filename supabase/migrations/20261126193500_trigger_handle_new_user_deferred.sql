-- Correção: no GoTrue (Supabase Auth), `auth.admin.createUser({ app_metadata })` primeiro faz
-- `INSERT INTO auth.users` (ainda sem o `app_metadata` customizado) e só depois faz `UPDATE`
-- na mesma transação para gravar `raw_app_meta_data`.
--
-- Como o trigger `on_auth_user_created` rodava imediatamente no `AFTER INSERT`, ele não enxergava
-- `raw_app_meta_data ->> 'papel' = 'professor'` em um banco novo, tratava a professora como aluna
-- e falhava com "Código de convite inválido".
--
-- Tornando o trigger `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` e lendo
-- `raw_app_meta_data` atualizado de `auth.users` no momento do COMMIT, o `app_metadata` já está
-- gravado — mantendo intacta a regra de que cadastro público nunca vira professor.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_app_meta jsonb;
  v_papel    public.papel;
  v_nome     text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1));
  v_turma    uuid;
begin
  select raw_app_meta_data into v_app_meta from auth.users where id = new.id;
  if not found then
    return null;
  end if;

  v_papel := case
    when v_app_meta ->> 'papel' = 'professor' then 'professor'::public.papel
    else 'aluno'::public.papel
  end;

  if v_papel = 'aluno' then
    select id into v_turma from public.turmas
    where codigo_convite = upper(trim(new.raw_user_meta_data ->> 'codigo_convite'));
    if v_turma is null then
      raise exception 'Código de convite inválido' using errcode = 'P0001';
    end if;
  end if;

  insert into public.profiles (id, papel, nome, turma_id) values (new.id, v_papel, v_nome, v_turma);
  return null;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create constraint trigger on_auth_user_created
  after insert on auth.users
  deferrable initially deferred
  for each row execute function public.handle_new_user();
