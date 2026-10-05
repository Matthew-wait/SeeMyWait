select jsonb_build_object(
 'functions',(select jsonb_agg(jsonb_build_object('function',p.oid::regprocedure::text,'security_definer',p.prosecdef,'config',p.proconfig,'public_execute_revoked',not exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='nearby_clinics_page' and n.nspname in ('public','clinic_search_internal')),
 'rls_enabled',(select relrowsecurity from pg_class where oid='public.clinics'::regclass),
 'anon_can_create',has_schema_privilege('anon','clinic_search_internal','CREATE'),
 'anon_can_search',has_function_privilege('anon','public.nearby_clinics_page(double precision,double precision,double precision,integer,integer,uuid)','EXECUTE')
) as verification;