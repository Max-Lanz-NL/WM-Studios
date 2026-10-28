-- Additive, namespaced migration. No existing tables or data are changed.
-- Fail on name conflicts rather than silently adopting an unknown schema.
create table public.wm_products (
 id uuid primary key, body jsonb not null,
 created_at timestamptz not null default now(),
 check ((body->>'id')::uuid = id),
 check (body->>'status' in ('draft','review','approved','scheduled','published','archived')),
 check ((body->>'price')::integer between 100 and 1000000),
 check (jsonb_array_length(body->'variants') between 1 and 100),
 check (body->>'status' <> 'scheduled' or body->>'releaseAt' is not null)
);
create unique index wm_product_slug on public.wm_products ((body->>'slug'));
create index wm_release_status on public.wm_products ((body->>'status'));
create table public.wm_skus (
 sku text primary key, product_id uuid not null references public.wm_products(id)
);
create index wm_skus_product_id on public.wm_skus(product_id);
create table public.wm_orders (
 id uuid primary key, idempotency uuid unique not null, request_hash text not null,
 body jsonb not null, created_at timestamptz not null default now()
);
create table public.wm_waitlist (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.wm_products(id),
 email text not null, created_at timestamptz not null default now(), unique(product_id,email)
);
create table public.wm_audit (
 id uuid primary key default gen_random_uuid(), action text not null, created_at timestamptz not null default now()
);
create table public.wm_settings (id text primary key, body jsonb not null);
create table public.wm_attempts (id text primary key, count integer not null, reset_at timestamptz not null);
create index wm_attempts_reset on public.wm_attempts(reset_at);
create index wm_products_created on public.wm_products(created_at desc);
create index wm_orders_created on public.wm_orders(created_at desc);
-- Separate DB-level gate: NEVER enabled by the migration or production startup.
insert into public.wm_settings values
 ('test_checkout','false'),
 ('home','{"headline":"Made for your everyday extraordinary.","subtitle":"WM Studio Collective"}');

alter table public.wm_products enable row level security;
alter table public.wm_skus enable row level security;
alter table public.wm_orders enable row level security;
alter table public.wm_waitlist enable row level security;
alter table public.wm_audit enable row level security;
alter table public.wm_settings enable row level security;
alter table public.wm_attempts enable row level security;
revoke all on public.wm_products, public.wm_skus, public.wm_orders, public.wm_waitlist,
 public.wm_audit, public.wm_settings, public.wm_attempts from anon, authenticated;
grant select on public.wm_products, public.wm_settings to anon, authenticated;
grant select on public.wm_orders, public.wm_waitlist, public.wm_audit to authenticated;
grant all on public.wm_products, public.wm_skus, public.wm_orders, public.wm_waitlist,
 public.wm_audit, public.wm_settings, public.wm_attempts to service_role;
create policy wm_catalog on public.wm_products for select to anon, authenticated
 using (body->>'status' = 'scheduled' or (body->>'status' = 'published' and
 (body->>'releaseAt' is null or (body->>'releaseAt')::timestamptz <= now())));
create policy wm_admin_products on public.wm_products for select to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy wm_home on public.wm_settings for select to anon, authenticated using (id = 'home');
create policy wm_admin_orders on public.wm_orders for select to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy wm_admin_waitlist on public.wm_waitlist for select to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy wm_admin_audit on public.wm_audit for select to authenticated
 using ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

-- All writes are server RPCs. INVOKER + service_role-only EXECUTE; no definer bypass.
-- A transaction-scoped commerce lock serializes stock edits, checkout and releases.
-- This deliberately favors correctness over throughput for this small catalog.
create function public.wm_save_product(input jsonb, product_id uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare p jsonb; pid uuid := coalesce(product_id, gen_random_uuid()); v jsonb;
begin
 perform pg_advisory_xact_lock(741026);
 if product_id is not null then
  select body into p from public.wm_products where id = product_id for update;
  if not found then raise exception 'WM:Product niet gevonden'; end if;
 end if;
 if exists(select 1 from public.wm_products where body->>'slug' = input->>'slug' and id <> pid)
 then raise exception 'WM:Deze URL bestaat al'; end if;
 p := input || jsonb_build_object('id',pid,'createdAt',coalesce(p->>'createdAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')));
 insert into public.wm_products(id,body) values(pid,p) on conflict(id) do update set body=excluded.body;
 delete from public.wm_skus where wm_skus.product_id = pid;
 for v in select value from jsonb_array_elements(input->'variants') loop
  if (v->>'stock')::integer < 0 then raise exception 'WM:Ongeldige voorraad'; end if;
  if exists(select 1 from public.wm_skus where sku=v->>'sku') then raise exception 'WM:Een SKU is al in gebruik'; end if;
  insert into public.wm_skus values(v->>'sku',pid);
 end loop;
 insert into public.wm_audit(action) values('Product opgeslagen: ' || (p->>'name'));
 return p;
end $$;

create function public.wm_publish_due(at_time timestamptz default now()) returns integer
language plpgsql security invoker set search_path = '' as $$
declare p record; n integer := 0;
begin
 perform pg_advisory_xact_lock(741026);
 for p in select id,body from public.wm_products where body->>'status'='scheduled'
 and (body->>'releaseAt')::timestamptz <= at_time for update loop
  update public.wm_products set body=jsonb_set(body,'{status}','"published"') where id=p.id;
  insert into public.wm_audit(action) values('Release gepubliceerd: ' || (p.body->>'name'));
  n := n + 1;
 end loop;
 return n;
end $$;

create function public.wm_checkout(input jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p jsonb; v jsonb; line jsonb; items jsonb := '[]'; o jsonb; old public.wm_orders;
 seen text[] := '{}'; qty integer; idx integer; subtotal integer := 0; shipping integer; oid uuid := gen_random_uuid();
 fingerprint text := md5(input::text);
begin
 if not exists(select 1 from public.wm_settings where id='test_checkout' and body='true'::jsonb)
 then raise exception 'WM:Testbestellingen zijn uitgeschakeld'; end if;
 perform pg_advisory_xact_lock(741026);
 select * into old from public.wm_orders where idempotency=(input->>'key')::uuid;
 if found then
  if old.request_hash <> fingerprint then raise exception 'WM:Bestelsleutel is al gebruikt'; end if;
  return old.body;
 end if;
 if jsonb_array_length(input->'items') not between 1 and 30 then raise exception 'WM:Ongeldige bestelling'; end if;
 for line in select value from jsonb_array_elements(input->'items') loop
  if line->>'sku' = any(seen) then raise exception 'WM:Dubbele variant'; end if;
  seen := array_append(seen,line->>'sku');
  qty := (line->>'quantity')::integer;
  if qty not between 1 and 20 then raise exception 'WM:Ongeldige hoeveelheid'; end if;
  select body into p from public.wm_products where id=(line->>'productId')::uuid for update;
  if not found or p->>'status' not in ('published','scheduled') or (p->>'releaseAt')::timestamptz > now()
  then raise exception 'WM:Dit product is nog niet beschikbaar'; end if;
  select value, (ordinality-1)::integer into v,idx from jsonb_array_elements(p->'variants') with ordinality where value->>'sku'=line->>'sku';
  if v is null or (v->>'stock')::integer < qty then raise exception 'WM:Onvoldoende voorraad'; end if;
  items := items || jsonb_build_array(jsonb_build_object('productId',p->>'id','name',p->>'name','sku',v->>'sku',
    'size',v->>'size','color',v->>'color','quantity',qty,'price',(p->>'price')::integer));
  subtotal := subtotal + (p->>'price')::integer * qty;
  p := jsonb_set(p,array['variants',idx::text,'stock'],to_jsonb((v->>'stock')::integer-qty));
  update public.wm_products set body=p where id=(line->>'productId')::uuid;
 end loop;
 shipping := case when subtotal >= 15000 then 0 else 495 end;
 o := jsonb_build_object('id',oid,'number','WM-' || upper(substr(oid::text,1,8)),
  'email',input->>'email','name',input->>'name','address',input->>'address','total',subtotal+shipping,
  'shipping',shipping,'status','paid_demo','createdAt',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'items',items);
 insert into public.wm_orders values(oid,(input->>'key')::uuid,fingerprint,o,now());
 insert into public.wm_audit(action) values('Testorder geplaatst: ' || (o->>'number'));
 return o;
end $$;

create function public.wm_update_order(order_id uuid, next_status text) returns void
language plpgsql security invoker set search_path = '' as $$
declare o jsonb;
begin
 select body into o from public.wm_orders where id=order_id for update;
 if not found then raise exception 'WM:Order niet gevonden'; end if;
 if not ((next_status='packed' and o->>'status'='paid_demo') or (next_status='shipped' and o->>'status'='packed'))
 then raise exception 'WM:Ongeldige statusovergang'; end if;
 update public.wm_orders set body=jsonb_set(body,'{status}',to_jsonb(next_status)) where id=order_id;
 insert into public.wm_audit(action) values((o->>'number') || ': ' || next_status);
end $$;
create function public.wm_save_home(content jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
begin
 update public.wm_settings set body=content where id='home';
 insert into public.wm_audit(action) values('Homepage gewijzigd');
end $$;
create function public.wm_join_waitlist(product_id uuid, email_address text) returns void
language plpgsql security invoker set search_path = '' as $$
begin
 if not exists(select 1 from public.wm_products where id=product_id and body->>'status'='scheduled')
 then raise exception 'WM:Release niet gevonden'; end if;
 insert into public.wm_waitlist(product_id,email) values(product_id,lower(email_address)) on conflict do nothing;
end $$;
create function public.wm_rate_limit(bucket text, maximum integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
 delete from public.wm_attempts where reset_at < now() - interval '1 hour';
 insert into public.wm_attempts values(bucket,1,now()+interval '1 minute')
 on conflict(id) do update set
 count=case when wm_attempts.reset_at <= now() then 1 else wm_attempts.count+1 end,
 reset_at=case when wm_attempts.reset_at <= now() then now()+interval '1 minute' else wm_attempts.reset_at end
 returning count into n;
 return n <= maximum;
end $$;

revoke all on function public.wm_save_product(jsonb,uuid),public.wm_publish_due(timestamptz),
 public.wm_checkout(jsonb),public.wm_update_order(uuid,text),public.wm_save_home(jsonb),
 public.wm_join_waitlist(uuid,text),public.wm_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.wm_save_product(jsonb,uuid),public.wm_publish_due(timestamptz),
 public.wm_checkout(jsonb),public.wm_update_order(uuid,text),public.wm_save_home(jsonb),
 public.wm_join_waitlist(uuid,text),public.wm_rate_limit(text,integer) to service_role;

create function public.wm_seed(catalog jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare p jsonb;
begin
 perform pg_advisory_xact_lock(741026);
 if exists(select 1 from public.wm_products) then raise exception 'WM:Seed vereist een lege catalogus'; end if;
 for p in select value from jsonb_array_elements(catalog) loop
  perform public.wm_save_product(p - 'id' - 'createdAt',null);
 end loop;
end $$;
revoke all on function public.wm_seed(jsonb) from public,anon,authenticated;
grant execute on function public.wm_seed(jsonb) to service_role;
