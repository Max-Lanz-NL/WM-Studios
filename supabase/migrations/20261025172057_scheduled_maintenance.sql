create function private.run_maintenance() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare released integer; expired integer:=0; o record;
begin
 -- Database time is authoritative. Checkout enforces the same boundary even during scheduler delays.
 perform 1 from public.products p join public.releases r on r.id=p.release_id
 where p.status='scheduled' and r.state='scheduled' and r.starts_at<=now() order by p.id for update of p;
 update public.products p set status='published',version=version+1,updated_at=now()
 from public.releases r where p.release_id=r.id and p.status='scheduled' and r.state='scheduled' and r.starts_at<=now();
 get diagnostics released=row_count;
 update public.releases r set state='published',published_at=coalesce(published_at,now()),updated_at=now()
 where r.state='scheduled' and r.starts_at<=now() and exists(select 1 from public.products p where p.release_id=r.id and p.status='published');
 for o in select id from public.orders where payment_status='pending_payment' and expires_at<=now() order by id loop
  perform public.settle_reservation(o.id,'expired');expired:=expired+1;
 end loop;
 delete from private.rate_limits where reset_at<now()-interval '1 day';
 return jsonb_build_object('published',released,'expired',expired);
end $$;
revoke all on function private.run_maintenance() from public,anon,authenticated;
grant execute on function private.run_maintenance() to service_role;

create function public.maintenance_status() returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('schedulerInstalled',exists(select 1 from pg_catalog.pg_extension where extname='pg_cron'),
 'dueReleases',(select count(*) from public.releases where state='scheduled' and starts_at<=now()),
 'expiredOrders',(select count(*) from public.orders where payment_status='pending_payment' and expires_at<=now()))
$$;
revoke all on function public.maintenance_status() from public,anon,authenticated;
grant execute on function public.maintenance_status() to service_role;

-- SCHEDULER INSTALLATION (requires Supabase's pg_cron extension).
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('wm-commerce-maintenance','* * * * *','select private.run_maintenance();');
