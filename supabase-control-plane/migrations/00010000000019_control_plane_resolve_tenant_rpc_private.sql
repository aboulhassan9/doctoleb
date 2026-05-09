-- DoctoLeb Control Plane · keep resolver RPC private to Edge Functions
--
-- The public interface is the tenant-resolve Edge Function. Browser callers
-- should not call the SECURITY DEFINER resolve_tenant RPC directly through
-- PostgREST because that bypasses function-level headers, logging, and future
-- rate limiting. The Edge Function calls this RPC with service-role access.

revoke all on function public.resolve_tenant(text, text) from public;
revoke execute on function public.resolve_tenant(text, text) from public, anon, authenticated;
grant execute on function public.resolve_tenant(text, text) to service_role;

comment on function public.resolve_tenant(text, text) is
  'Private service-role resolver RPC. Public browser access goes through the tenant-resolve Edge Function only.';

insert into public.tenant_events (tenant_id, event_type, metadata)
select null, 'control_plane.resolve_tenant_rpc_private_applied', jsonb_build_object(
  'publicInterface', 'tenant-resolve edge function',
  'directRpcRolesRevoked', array['public', 'anon', 'authenticated'],
  'serviceRoleOnly', true,
  'phi', false
)
where not exists (
  select 1
  from public.tenant_events
  where event_type = 'control_plane.resolve_tenant_rpc_private_applied'
);
