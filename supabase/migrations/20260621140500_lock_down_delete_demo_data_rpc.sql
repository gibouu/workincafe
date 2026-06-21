-- Keep destructive demo cleanup callable only from trusted server code.
--
-- delete_demo_data() is SECURITY DEFINER and deletes all rows marked
-- is_demo=true across several tables. PostgREST exposes executable
-- public-schema functions as RPC endpoints, so client roles must not be
-- able to invoke this function directly.

set search_path = public, extensions;

revoke execute on function public.delete_demo_data()
  from public, anon, authenticated;

grant execute on function public.delete_demo_data()
  to service_role;

comment on function public.delete_demo_data() is
  'Deletes demo rows across public tables. SECURITY DEFINER; service_role-only execution.';
