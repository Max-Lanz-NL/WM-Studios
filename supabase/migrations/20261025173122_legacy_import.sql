-- Service-only import into an empty staging catalog. One PostgreSQL transaction.
create function public.import_legacy(payload jsonb,source_digest text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare source text:=payload->>'sourceId'; previous text; row jsonb; body jsonb; item jsonb; customer uuid; variant uuid; table_entry record; imported_products integer:=0; imported_orders integer:=0;
begin
 if payload->>'formatVersion'<>'1' or length(source)<1 or length(source_digest)<>64 then raise exception 'Ongeldig importbestand'; end if;
 if not exists(select 1 from private.platform_settings where environment in ('local','staging')) then raise exception 'Alleen staging toegestaan'; end if;
 perform pg_advisory_xact_lock(hashtextextended('wm-legacy-import',0));
 select digest into previous from private.legacy_imports where source_id=source;
 if found then
  if previous<>source_digest then raise exception 'Deze importbron is gewijzigd; import afgebroken'; end if;
  return jsonb_build_object('alreadyImported',true);
 end if;
 if exists(select 1 from public.products) or exists(select 1 from public.orders) then raise exception 'Import vereist een lege doelcatalogus en orderdatabase'; end if;
 insert into private.legacy_imports(source_id,digest,original) values(source,source_digest,payload);
 for table_entry in select * from jsonb_each(payload->'tables') loop
  for row in select value from jsonb_array_elements(table_entry.value) loop
   insert into private.legacy_records(source_id,table_name,record) values(source,table_entry.key,row);
  end loop;
 end loop;
 for row in select value from jsonb_array_elements(payload->'tables'->'products') loop
  body:=(row->>'body')::jsonb;
  perform private.persist_product(body,(body->>'id')::uuid);
  imported_products:=imported_products+1;
 end loop;
 for row in select value from jsonb_array_elements(payload->'tables'->'orders') loop
  body:=(row->>'body')::jsonb;
  insert into public.customers(email,name,created_at) values(lower(body->>'email'),body->>'name',(body->>'createdAt')::timestamptz)
   on conflict(email) do update set updated_at=now() returning id into customer;
  insert into public.orders(id,number,idempotency_key,request_fingerprint,customer_id,customer_name,customer_email,shipping_address,subtotal_cents,shipping_cents,total_cents,payment_status,fulfillment_status,created_at)
  values((body->>'id')::uuid,body->>'number',(row->>'idempotency')::uuid,'legacy:'||source_digest,customer,body->>'name',lower(body->>'email'),body->>'address',(body->>'total')::integer-(body->>'shipping')::integer,(body->>'shipping')::integer,(body->>'total')::integer,'paid_demo',case when body->>'status' in ('packed','shipped') then body->>'status' else 'unfulfilled' end,(body->>'createdAt')::timestamptz);
  for item in select value from jsonb_array_elements(body->'items') loop
   variant:=null;
   select id into variant from public.product_variants where sku=item->>'sku' and product_id=(item->>'productId')::uuid;
   if variant is null then
    insert into public.product_variants(product_id,size,color,sku,active) values((item->>'productId')::uuid,item->>'size',item->>'color',item->>'sku',false) returning id into variant;
    insert into public.inventory(variant_id,on_hand) values(variant,0);
   end if;
   insert into public.order_items(order_id,product_id,variant_id,product_name,sku,size,color,quantity,price_cents) values((body->>'id')::uuid,(item->>'productId')::uuid,variant,item->>'name',item->>'sku',item->>'size',item->>'color',(item->>'quantity')::integer,(item->>'price')::integer);
  end loop;
  insert into public.order_events(order_id,event,created_at) values((body->>'id')::uuid,'legacy_import',(body->>'createdAt')::timestamptz);
  imported_orders:=imported_orders+1;
 end loop;
 for row in select value from jsonb_array_elements(payload->'tables'->'waitlist') loop
  insert into public.release_waitlist(id,product_id,email,consent_at,created_at) values((row->>'id')::uuid,(row->>'product_id')::uuid,lower(row->>'email'),(row->>'created_at')::timestamptz,(row->>'created_at')::timestamptz);
 end loop;
 for row in select value from jsonb_array_elements(payload->'tables'->'settings') loop
  if row->>'id'='home' then update public.content_settings set body=(row->>'body')::jsonb,updated_at=now() where id='home'; end if;
 end loop;
 for row in select value from jsonb_array_elements(payload->'tables'->'audit') loop
  insert into public.audit_logs(id,action,created_at) values((row->>'id')::uuid,row->>'action',(row->>'created_at')::timestamptz);
 end loop;
 insert into public.audit_logs(action) values('Legacy-import voltooid: '||source);
 return jsonb_build_object('products',imported_products,'orders',imported_orders,'archivedRecords',(select count(*) from private.legacy_records where source_id=source));
end $$;
revoke all on function public.import_legacy(jsonb,text) from public,anon,authenticated;
grant execute on function public.import_legacy(jsonb,text) to service_role;
