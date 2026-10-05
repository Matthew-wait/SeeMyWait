select jsonb_build_object(
 'radius',(select value from public.app_settings where key='nearby_radius_miles'),
 'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'definer',p.prosecdef,'settings',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname='nearby_clinics_batch'),
 'rls',(select relrowsecurity from pg_class where oid='public.clinics'::regclass)
) as verification;
