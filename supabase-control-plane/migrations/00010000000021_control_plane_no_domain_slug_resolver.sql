-- DoctoLeb Control Plane · no-domain slug resolver
--
-- Adds service-role-only tenant resolution for Vercel path URLs such as:
--   https://doctoleb-patient-web.vercel.app/t/<tenant-slug>
--
-- This does not replace hostname/domain routing. It is an additive fallback
-- for tenants that are active before a real domain is purchased/verified.
-- NO PHI is returned or stored here.

create or replace function public.resolve_tenant_by_slug(
  p_slug text,
  p_surface text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_row record;
  v_canonical text;
begin
  if v_slug = ''
     or v_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$' then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  if p_surface not in ('patient','ops') then
    return jsonb_build_object('data', null, 'error', 'INVALID_REQUEST');
  end if;

  select
    t.id as tenant_id,
    t.slug,
    t.status as tenant_status,
    t.supabase_url,
    t.supabase_anon_key,
    t.schema_version
  into v_row
  from public.tenants t
  where lower(t.slug) = v_slug
  limit 1;

  if not found then
    return jsonb_build_object('data', null, 'error', 'TENANT_NOT_FOUND');
  end if;

  if v_row.tenant_status <> 'active' then
    return jsonb_build_object('data', null, 'error', 'TENANT_INACTIVE');
  end if;

  select hostname into v_canonical
  from public.tenant_domains
  where tenant_id = v_row.tenant_id
    and surface = p_surface
    and status = 'active'
  order by created_at asc
  limit 1;

  return jsonb_build_object(
    'data', jsonb_build_object(
      'tenantId', v_row.tenant_id,
      'slug', v_row.slug,
      'surface', p_surface,
      'status', v_row.tenant_status,
      'supabaseUrl', v_row.supabase_url,
      'supabaseAnonKey', v_row.supabase_anon_key,
      'schemaVersion', coalesce(v_row.schema_version, 'unknown'),
      'canonicalHost', coalesce(v_canonical, v_row.slug)
    ),
    'error', null
  );
end;
$$;

revoke all on function public.resolve_tenant_by_slug(text, text) from public;
revoke execute on function public.resolve_tenant_by_slug(text, text) from public, anon, authenticated;
grant execute on function public.resolve_tenant_by_slug(text, text) to service_role;

comment on function public.resolve_tenant_by_slug(text, text) is
  'Private service-role no-domain resolver. Public browser access goes through tenant-resolve with slug query parameter only. NO PHI.';
