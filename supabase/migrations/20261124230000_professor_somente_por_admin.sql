-- Segurança: só a chave administrativa pode criar uma Professora.
--
-- Antes, handle_new_user() lia o papel de raw_user_meta_data, que o próprio usuário define no
-- cadastro público (signUp com a chave publishable). Qualquer pessoa conseguiria se cadastrar como
-- 'professor'. Agora 'professor' só vale se vier de raw_app_meta_data, que só o service_role grava
-- (auth.admin.createUser). Todo cadastro público vira Aluno e exige um código de convite válido.
--
-- Aplicar no SQL Editor do Supabase (ou `supabase db push`). Não afeta contas já criadas.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_papel public.papel := case
    when new.raw_app_meta_data ->> 'papel' = 'professor' then 'professor'::public.papel
    else 'aluno'::public.papel
  end;
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
