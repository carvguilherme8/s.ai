-- Busca vetorial (RAG) sobre material_trechos usando o índice HNSW (cosine) já existente.
-- Executada apenas no servidor (service_role), após validação de posse/acesso nas Server Actions.
create or replace function public.buscar_trechos_similares(
  p_material uuid,
  p_embedding extensions.vector(768),
  p_limite int default 6
)
returns table (
  id uuid,
  ordem int,
  pagina int,
  conteudo text,
  similaridade double precision
)
language sql stable security definer set search_path = public, extensions as $$
  select
    t.id,
    t.ordem,
    t.pagina,
    t.conteudo,
    (1 - (t.embedding <=> p_embedding))::double precision as similaridade
  from public.material_trechos t
  where t.material_id = p_material
    and t.embedding is not null
  order by t.embedding <=> p_embedding
  limit greatest(1, least(coalesce(p_limite, 6), 20))
$$;

revoke execute on function public.buscar_trechos_similares(uuid, extensions.vector, int) from public, anon, authenticated;
grant execute on function public.buscar_trechos_similares(uuid, extensions.vector, int) to service_role;
