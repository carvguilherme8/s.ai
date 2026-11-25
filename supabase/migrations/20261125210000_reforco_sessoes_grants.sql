-- Neste projeto as tabelas de public não recebem GRANT automático (ver schema inicial):
-- sem isto, a chave de serviço recebe "permission denied" em reforco_sessoes.
grant select, insert, update on public.reforco_sessoes to service_role;
