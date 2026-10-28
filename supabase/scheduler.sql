-- Optional infrastructure setup, run as postgres ONLY in the approved WM project.
-- First enable pg_cron using Supabase Dashboard > Integrations > Cron.
-- Keep this separate from commerce migrations: PGlite/vanilla PG need no extension.
begin;
do $$ begin
 if exists(select 1 from cron.job where jobname='wm-studios-publish-releases')
 then raise exception 'WM release job already exists: inspect it before changing schedules'; end if;
end $$;
select cron.schedule('wm-studios-publish-releases','* * * * *','select public.wm_publish_due();');
commit;
