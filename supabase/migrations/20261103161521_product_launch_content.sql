-- Additive: preserves existing catalog, SKUs, orders and inventory.
-- Existing permission, optimistic version and stock checks are retained.
create function private.valid_product_image(value text) returns boolean
language sql immutable set search_path='' as $$
 select length(value)<=2000 and (
 value ~ '^/products/[a-zA-Z0-9/_-]+[.](jpg|jpeg|png|webp|avif|JPG|JPEG|PNG|WEBP|AVIF)$'
 or value ~ '^https://images[.]unsplash[.]com/'
 or value ~ '^https://[a-z0-9]+[.]supabase[.]co/storage/v1/object/public/'
 )
$$;
revoke all on function private.valid_product_image(text) from public;
grant execute on function private.valid_product_image(text) to anon,authenticated,service_role;
alter table public.products drop constraint products_image_url_check;
alter table public.products add constraint products_image_url_check check(private.valid_product_image(image_url));
alter table public.products
 add column material text not null default '' check(length(material)<=2000),
 add column fit text not null default '' check(length(fit)<=2000),
 add column care text not null default '' check(length(care)<=2000),
 add column size_guide text not null default '' check(length(size_guide)<=4000);
create table public.product_images (
 product_id uuid not null references public.products(id) on delete cascade,
 position integer not null check(position between 0 and 7),
 url text not null check(private.valid_product_image(url)),
 alt text not null check(length(trim(alt)) between 1 and 200),
 primary key(product_id,position)
);
alter table public.product_images enable row level security;
revoke all on public.product_images from public,anon,authenticated;
grant select on public.product_images to anon,authenticated;
grant all on public.product_images to service_role;
create policy product_images_read on public.product_images for select to anon,authenticated
 using(exists(select 1 from public.products p where p.id=product_id));

create or replace function private.persist_product(payload jsonb, target_id uuid, expected_version integer default null) returns uuid
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
 update public.products set
 material=coalesce(payload->>'material',material), fit=coalesce(payload->>'fit',fit),
 care=coalesce(payload->>'care',care), size_guide=coalesce(payload->>'sizeGuide',size_guide)
 where id=target_id;
 if payload ? 'gallery' then
   if jsonb_typeof(payload->'gallery') <> 'array' or jsonb_array_length(payload->'gallery')>8 then raise exception 'Invalid product gallery'; end if;
   delete from public.product_images where product_id=target_id;
   insert into public.product_images(product_id,position,url,alt)
   select target_id,ordinality-1,value->>'url',value->>'alt' from jsonb_array_elements(payload->'gallery') with ordinality;
 end if;
 insert into public.audit_logs(action,actor_id) values('Product opgeslagen: '||(payload->>'name'),auth.uid());
 return target_id;
end $$;


create or replace view public.catalog with(security_invoker=true) as
select p.id, jsonb_build_object('id',p.id,'name',p.name,'slug',p.slug,'brand',b.name,'category',c.name,'gender',p.gender,
 'description',p.description,'price',p.price_cents,'status',p.status,'releaseAt',r.starts_at,'image',p.image_url,
 'material',p.material,'fit',p.fit,'care',p.care,'sizeGuide',p.size_guide,
 'gallery',coalesce((select jsonb_agg(jsonb_build_object('url',g.url,'alt',g.alt) order by g.position) from public.product_images g where g.product_id=p.id),'[]'::jsonb),
 'createdAt',p.created_at,'version',p.version,'variants',coalesce((select jsonb_agg(jsonb_build_object('size',v.size,'color',v.color,'sku',v.sku,'stock',i.on_hand-i.reserved) order by v.position)
 from public.product_variants v join public.inventory i on i.variant_id=v.id where v.product_id=p.id and v.active),'[]'::jsonb)) body
from public.products p join public.brands b on b.id=p.brand_id join public.categories c on c.id=p.category_id left join public.releases r on r.id=p.release_id;
grant select on public.catalog to anon,authenticated,service_role;

