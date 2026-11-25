-- Nome de turma único por professora (sem diferenciar maiúsculas/minúsculas).
-- O app já checa antes de gravar; este índice fecha a corrida entre dois envios simultâneos.
-- Se já existirem turmas duplicadas, renomeie-as antes de aplicar.
create unique index if not exists turmas_professor_nome_unico
  on public.turmas (professor_id, lower(nome));
