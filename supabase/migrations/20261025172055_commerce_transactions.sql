create function private.persist_product(payload jsonb, target_id uuid, expected_version integer default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare brand uuid; category uuid; release uuid; old public.products; line jsonb; variant uuid; previous integer;
begin
 if jsonb_array_length(payload->'variants') not between 1 and 100 then raise exception 'Ongeldige varianten'; end if;
 select * into old from public.products where id=target_id for update;
 if found and expected_version is distinct from old.version then raise exception 'Product is gewijzigd. Herlaad de pagina.'; end if;
 insert into public.brands(name,slug) values(payload->>'brand',lower(replace(payload->>'brand',' ','-'))) on conflict(name) do nothing;
 select id into brand from public.brands where name=payload->>'brand';
 insert into public.categories(name) values(payload->>'category') on conflict(name) do nothing;
 select id into category from public.categories where name=payload->>'category';
 if nullif(payload->>'releaseAt','') is not null then
   release:=old.release_id;
   if release is null then
    insert into public.releases(name,brand_id,starts_at,state) values(payload->>'name',brand,(payload->>'releaseAt')::timestamptz,case when payload->>'status' in ('scheduled','published') then payload->>'status' else 'cancelled' end) returning id into release;
   else
    update public.releases set name=payload->>'name',brand_id=brand,starts_at=(payload->>'releaseAt')::timestamptz,
     state=case when payload->>'status' in ('scheduled','published') then payload->>'status' else 'cancelled' end,updated_at=now() where id=release;
   end if;
 elsif old.release_id is not null then
   update public.releases set state='cancelled',updated_at=now() where id=old.release_id;
 end if;
 insert into public.products(id,name,slug,brand_id,category_id,gender,description,price_cents,status,release_id,image_url,created_at)
 values(target_id,payload->>'name',payload->>'slug',brand,category,payload->>'gender',payload->>'description',(payload->>'price')::integer,payload->>'status',release,payload->>'image',coalesce((payload->>'createdAt')::timestamptz,now()))
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,brand_id=excluded.brand_id,category_id=excluded.category_id,gender=excluded.gender,
 description=excluded.description,price_cents=excluded.price_cents,status=excluded.status,release_id=excluded.release_id,image_url=excluded.image_url,version=products.version+1,updated_at=now();
 perform 1 from public.inventory i join public.product_variants v on v.id=i.variant_id where v.product_id=target_id order by i.variant_id for update of i;
 if exists(select 1 from public.product_variants v join public.inventory i on i.variant_id=v.id where v.product_id=target_id and i.reserved>0 and not exists(select 1 from jsonb_array_elements(payload->'variants') x where x->>'sku'=v.sku)) then
   raise exception 'Variant heeft actieve reserveringen';
 end if;
 update public.product_variants set active=false,updated_at=now() where product_id=target_id;
 for line in select value from jsonb_array_elements(payload->'variants') loop
   if exists(select 1 from public.product_variants where sku=line->>'sku' and product_id<>target_id) then raise exception 'Een SKU is al in gebruik'; end if;
   insert into public.product_variants(product_id,size,color,sku,position) values(target_id,line->>'size',line->>'color',line->>'sku',(select ordinality-1 from jsonb_array_elements(payload->'variants') with ordinality where value=line))
   on conflict(sku) do update set size=excluded.size,color=excluded.color,position=excluded.position,active=true,updated_at=now() returning id into variant;
   select on_hand into previous from public.inventory where variant_id=variant;
   insert into public.inventory(variant_id,on_hand) values(variant,(line->>'stock')::integer)
   on conflict(variant_id) do update set on_hand=(line->>'stock')::integer+inventory.reserved,updated_at=now();
   insert into public.inventory_movements(variant_id,kind,on_hand_delta,actor_id)
   select variant,'adjustment',i.on_hand-coalesce(previous,0),auth.uid() from public.inventory i where i.variant_id=variant and i.on_hand<>coalesce(previous,0);
 end loop;
 insert into public.audit_logs(action,actor_id) values('Product opgeslagen: '||(payload->>'name'),auth.uid());
 return target_id;
end $$;

create function private.staff_save_product(payload jsonb,target_id uuid,expected_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.can('catalog.write') then raise exception 'FORBIDDEN'; end if;
 return private.persist_product(payload,target_id,expected_version);
end $$;
create function public.save_product(payload jsonb,target_id uuid,expected_version integer default null) returns uuid
language sql security invoker set search_path='' as $$ select private.staff_save_product(payload,target_id,expected_version) $$;

create function private.staff_action(action text,payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders; next_status text;
begin
 if auth.uid() is null then raise exception 'UNAUTHORIZED'; end if;
 if action='home' then
  if not private.can('content.write') then raise exception 'FORBIDDEN'; end if;
  if length(payload->>'headline') not between 2 and 150 or length(payload->>'subtitle')>500 then raise exception 'Ongeldige inhoud'; end if;
  update public.content_settings set body=payload,updated_at=now() where id='home';
 elsif action='order' then
  if not private.can('orders.write') then raise exception 'FORBIDDEN'; end if;
  select * into o from public.orders where id=(payload->>'id')::uuid for update;
  next_status:=payload->>'status';
  if o.id is null or o.payment_status not in ('paid_demo','paid') or not ((next_status='packed' and o.fulfillment_status='unfulfilled') or(next_status='shipped' and o.fulfillment_status='packed')) then raise exception 'Ongeldige statusovergang'; end if;
  update public.orders set fulfillment_status=next_status,updated_at=now() where id=o.id;
  insert into public.order_events(order_id,event,actor_id) values(o.id,next_status,auth.uid());
 else raise exception 'Onbekende actie'; end if;
 insert into public.audit_logs(action,actor_id) values(action,auth.uid());
end $$;
create function public.staff_action(action text,payload jsonb) returns void
language sql security invoker set search_path='' as $$ select private.staff_action(action,payload) $$;

-- Privileged guest checkout entrypoint: service_role only. Prices come from locked rows.
create function public.checkout_staging(payload jsonb,reserve_only boolean default false) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare existing public.orders; customer uuid; order_id uuid:=gen_random_uuid(); fingerprint text; line record; p public.products; v public.product_variants; inv public.inventory; subtotal integer:=0; shipping integer; qty integer; starts timestamptz; release_state text; order_number text; expiry timestamptz:=now()+interval '15 minutes';
begin
 if not exists(select 1 from private.platform_settings where environment in ('local','staging')) then raise exception 'Alleen staging toegestaan'; end if;
 if jsonb_array_length(payload->'items') not between 1 and 30 then raise exception 'Ongeldige winkelmand'; end if;
 if (select count(*)<>count(distinct value->>'sku') from jsonb_array_elements(payload->'items')) then raise exception 'Dubbele variant'; end if;
 fingerprint:=encode(sha256(convert_to((payload-'key')::text||reserve_only::text,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(payload->>'key',0));
 select * into existing from public.orders where idempotency_key=(payload->>'key')::uuid;
 if found then
  if existing.request_fingerprint<>fingerprint then raise exception 'Idempotentiesleutel hoort bij een andere bestelling'; end if;
  return jsonb_build_object('id',existing.id,'number',existing.number,'total',existing.total_cents,'status',existing.payment_status);
 end if;
 -- A stable product lock order prevents deadlocks with product editing and other carts.
 perform 1 from public.products where id in(select (value->>'productId')::uuid from jsonb_array_elements(payload->'items')) order by id for update;
 perform 1 from public.inventory i join public.product_variants pv on pv.id=i.variant_id where pv.sku in(select value->>'sku' from jsonb_array_elements(payload->'items')) order by i.variant_id for update of i;
 for line in select value as item from jsonb_array_elements(payload->'items') loop
  qty:=(line.item->>'quantity')::integer;
  if qty not between 1 and 20 then raise exception 'Ongeldig aantal'; end if;
  select * into p from public.products where id=(line.item->>'productId')::uuid;
  starts:=null;release_state:=null;
  if p.release_id is not null then select starts_at,state into starts,release_state from public.releases where id=p.release_id; end if;
  if p.id is null or p.status not in ('published','scheduled') or (p.release_id is not null and (starts>now() or release_state='cancelled')) then raise exception 'Dit product is nog niet beschikbaar'; end if;
  select * into v from public.product_variants where product_id=p.id and sku=line.item->>'sku' and active;
  select * into inv from public.inventory where variant_id=v.id;
  if inv.variant_id is null or inv.on_hand-inv.reserved<qty then raise exception 'Onvoldoende voorraad'; end if;
  subtotal:=subtotal+p.price_cents*qty;
 end loop;
 shipping:=case when subtotal>=15000 then 0 else 495 end;
 insert into public.customers(email,name) values(lower(payload->>'email'),payload->>'name') on conflict(email) do update set updated_at=now() returning id into customer;
 order_number:='WM-'||upper(replace(order_id::text,'-',''));
 insert into public.orders(id,number,idempotency_key,request_fingerprint,customer_id,customer_name,customer_email,shipping_address,subtotal_cents,shipping_cents,total_cents,payment_status,expires_at)
 values(order_id,order_number,(payload->>'key')::uuid,fingerprint,customer,payload->>'name',lower(payload->>'email'),payload->>'address',subtotal,shipping,subtotal+shipping,case when reserve_only then 'pending_payment' else 'paid_demo' end,case when reserve_only then expiry end);
 for line in select value as item from jsonb_array_elements(payload->'items') loop
  qty:=(line.item->>'quantity')::integer;
  select * into p from public.products where id=(line.item->>'productId')::uuid;
  select * into v from public.product_variants where sku=line.item->>'sku';
  insert into public.order_items(order_id,product_id,variant_id,product_name,sku,size,color,quantity,price_cents) values(order_id,p.id,v.id,p.name,v.sku,v.size,v.color,qty,p.price_cents);
  insert into public.inventory_reservations(order_id,variant_id,quantity,state,expires_at) values(order_id,v.id,qty,case when reserve_only then 'active' else 'consumed' end,expiry);
  if reserve_only then update public.inventory set reserved=reserved+qty,updated_at=now() where variant_id=v.id;
  else update public.inventory set on_hand=on_hand-qty,updated_at=now() where variant_id=v.id; end if;
  insert into public.inventory_movements(variant_id,order_id,kind,on_hand_delta,reserved_delta) values(v.id,order_id,case when reserve_only then 'reserve' else 'sale' end,case when reserve_only then 0 else -qty end,case when reserve_only then qty else 0 end);
 end loop;
 update public.products set version=version+1,updated_at=now() where id in(select (value->>'productId')::uuid from jsonb_array_elements(payload->'items'));
 insert into public.order_events(order_id,event) values(order_id,case when reserve_only then 'reserved' else 'paid_demo' end);
 return jsonb_build_object('id',order_id,'number',order_number,'total',subtotal+shipping,'status',case when reserve_only then 'pending_payment' else 'paid_demo' end);
end $$;

-- Payment callbacks must eventually call this only after verifying provider status.
-- No browser/API route currently exposes this function.
create function public.settle_reservation(target_order uuid,outcome text) returns text
language plpgsql security invoker set search_path='' as $$
declare o public.orders; r record; consume boolean;
begin
 if outcome not in ('paid','failed','expired','cancelled') then raise exception 'Ongeldige betaalstatus'; end if;
 select * into o from public.orders where id=target_order for update;
 if o.id is null then raise exception 'Order niet gevonden'; end if;
 if o.payment_status<>'pending_payment' then return o.payment_status; end if;
 consume:=outcome='paid' and o.expires_at>now();
 perform 1 from public.products where id in(select product_id from public.order_items where order_id=target_order) order by id for update;
 perform 1 from public.inventory i where i.variant_id in(select variant_id from public.inventory_reservations where order_id=target_order) order by i.variant_id for update;
 for r in select * from public.inventory_reservations where order_id=target_order and state='active' order by variant_id for update loop
  update public.inventory set reserved=reserved-r.quantity,on_hand=on_hand-case when consume then r.quantity else 0 end,updated_at=now() where variant_id=r.variant_id;
  update public.inventory_reservations set state=case when consume then 'consumed' else 'released' end,updated_at=now() where id=r.id;
  insert into public.inventory_movements(variant_id,order_id,kind,on_hand_delta,reserved_delta) values(r.variant_id,target_order,case when consume then 'sale' else 'release' end,case when consume then -r.quantity else 0 end,-r.quantity);
 end loop;
 update public.products set version=version+1,updated_at=now() where id in(select product_id from public.order_items where order_id=target_order);
 update public.orders set payment_status=case when consume then 'paid' when o.expires_at<=now() or outcome='expired' then 'expired' else 'cancelled' end,updated_at=now() where id=target_order returning payment_status into o.payment_status;
 insert into public.order_events(order_id,event) values(target_order,o.payment_status);
 return o.payment_status;
end $$;

create function public.join_waitlist(product uuid,email_address text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.products where id=product and status='scheduled') then raise exception 'Release niet gevonden'; end if;
 insert into public.release_waitlist(product_id,email,consent_at) values(product,lower(email_address),now()) on conflict(product_id,email) do nothing;
end $$;
create function public.check_rate_limit(bucket text,max_requests integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare attempts integer;
begin
 insert into private.rate_limits(key,count,reset_at) values(bucket,1,now()+interval '1 minute')
 on conflict(key) do update set count=case when rate_limits.reset_at<=now() then 1 else rate_limits.count+1 end,reset_at=case when rate_limits.reset_at<=now() then now()+interval '1 minute' else rate_limits.reset_at end returning count into attempts;
 return attempts<=max_requests;
end $$;

-- Reset all new function defaults; grant only the explicitly supported call paths.
revoke all on function private.persist_product(jsonb,uuid,integer),private.staff_save_product(jsonb,uuid,integer),private.staff_action(text,jsonb) from public,anon,authenticated;
grant execute on function private.can(text) to anon,authenticated,service_role;
grant execute on function private.staff_save_product(jsonb,uuid,integer),private.staff_action(text,jsonb) to authenticated;
grant execute on function private.persist_product(jsonb,uuid,integer),private.staff_save_product(jsonb,uuid,integer),private.staff_action(text,jsonb) to service_role;
revoke all on function public.save_product(jsonb,uuid,integer),public.staff_action(text,jsonb),public.checkout_staging(jsonb,boolean),public.settle_reservation(uuid,text),public.join_waitlist(uuid,text),public.check_rate_limit(text,integer) from public,anon,authenticated;
grant execute on function public.save_product(jsonb,uuid,integer),public.staff_action(text,jsonb) to authenticated;
grant execute on function public.checkout_staging(jsonb,boolean),public.settle_reservation(uuid,text),public.join_waitlist(uuid,text),public.check_rate_limit(text,integer) to service_role;
