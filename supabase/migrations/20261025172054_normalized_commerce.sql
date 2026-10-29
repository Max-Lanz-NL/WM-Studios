-- Staging foundation. No production credentials or demo catalog in migrations.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create table public.roles (name text primary key);
create table public.role_permissions (
  role text not null references public.roles(name),
  permission text not null check (permission in ('catalog.write','orders.read','orders.write','content.write','customers.read','staff.manage')),
  primary key(role, permission)
);
insert into public.roles values ('owner'),('admin'),('designer'),('warehouse'),('support');
insert into public.role_permissions
select r.name,p.permission from public.roles r cross join (values ('catalog.write'),('orders.read'),('orders.write'),('content.write'),('customers.read'),('staff.manage')) p(permission) where r.name in ('owner','admin');
insert into public.role_permissions values ('designer','catalog.write'),('warehouse','orders.read'),('warehouse','orders.write'),('support','orders.read'),('support','customers.read');
create table public.staff_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null references public.roles(name), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index staff_role_idx on public.staff_members(role);
-- Lives outside the exposed API schema; no user-editable JWT metadata is trusted.
create function private.can(required_permission text) returns boolean
language sql stable security definer set search_path = '' as $$
 select auth.uid() is not null and exists (
 select 1 from public.staff_members s join public.role_permissions p on p.role=s.role
 where s.user_id=auth.uid() and s.active and p.permission=required_permission)
$$;
revoke all on function private.can(text) from public;
grant execute on function private.can(text) to anon,authenticated,service_role;

create table public.brands (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 100),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique check(length(name) between 1 and 100));
create table public.releases (
 id uuid primary key default gen_random_uuid(), name text not null, brand_id uuid not null references public.brands(id),
 starts_at timestamptz not null, timezone text not null default 'Europe/Amsterdam' check(timezone='Europe/Amsterdam'),
 state text not null default 'scheduled' check(state in ('scheduled','published','cancelled')),
 published_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index releases_due_idx on public.releases(starts_at) where state='scheduled';
create index releases_brand_idx on public.releases(brand_id);
create table public.products (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 120),
 slug text not null unique check(length(slug)<=120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 brand_id uuid not null references public.brands(id), category_id uuid not null references public.categories(id),
 gender text not null check(gender in ('Unisex','Men','Women')), description text not null default '' check(length(description)<=5000),
 price_cents integer not null check(price_cents between 100 and 1000000),
 status text not null check(status in ('draft','review','approved','scheduled','published','archived')),
 release_id uuid references public.releases(id), image_url text not null check(image_url like 'https://images.unsplash.com/%'),
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(status<>'scheduled' or release_id is not null)
);
create index products_brand_idx on public.products(brand_id);
create index products_category_idx on public.products(category_id);
create index products_release_idx on public.products(release_id);
create index products_status_idx on public.products(status);
create table public.product_variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 size text not null check(length(size) between 1 and 20), color text not null check(length(color) between 1 and 40),
 sku text not null unique check(length(sku) between 1 and 80), position integer not null default 0,
 active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(position>=0)
);
create unique index active_variant_dimensions_idx on public.product_variants(product_id,size,color) where active;
create index variants_product_idx on public.product_variants(product_id);
create table public.inventory (
 variant_id uuid primary key references public.product_variants(id),
 on_hand integer not null default 0 check(on_hand>=0),
 reserved integer not null default 0 check(reserved>=0 and reserved<=on_hand),
 updated_at timestamptz not null default now()
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), user_id uuid unique references auth.users(id) on delete set null,
 email text not null unique check(email=lower(email) and length(email)<=200), name text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), number text not null unique,
 idempotency_key uuid not null unique, request_fingerprint text not null,
 customer_id uuid not null references public.customers(id),
 customer_name text not null, customer_email text not null, shipping_address text not null,
 subtotal_cents integer not null check(subtotal_cents>=0), shipping_cents integer not null check(shipping_cents>=0),
 total_cents integer not null check(total_cents=subtotal_cents+shipping_cents),
 payment_status text not null check(payment_status in ('pending_payment','paid_demo','paid','cancelled','expired')),
 fulfillment_status text not null default 'unfulfilled' check(fulfillment_status in ('unfulfilled','packed','shipped')),
 is_test boolean not null default true, expires_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id);
create index orders_created_idx on public.orders(created_at desc);
create index orders_expiry_idx on public.orders(expires_at) where payment_status='pending_payment';
create table public.order_items (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 product_id uuid not null references public.products(id), variant_id uuid not null references public.product_variants(id),
 product_name text not null, sku text not null, size text not null, color text not null,
 quantity integer not null check(quantity between 1 and 20), price_cents integer not null check(price_cents>=0),
 unique(order_id,variant_id)
);
create index order_items_product_idx on public.order_items(product_id);
create index order_items_variant_idx on public.order_items(variant_id);
create table public.inventory_reservations (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 variant_id uuid not null references public.product_variants(id), quantity integer not null check(quantity>0),
 state text not null check(state in ('active','consumed','released')), expires_at timestamptz not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(order_id,variant_id)
);
create index reservations_variant_idx on public.inventory_reservations(variant_id);
create index reservations_expiry_idx on public.inventory_reservations(expires_at) where state='active';
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants(id),
 order_id uuid references public.orders(id), kind text not null check(kind in ('import','adjustment','reserve','release','sale')),
 on_hand_delta integer not null default 0, reserved_delta integer not null default 0,
 created_at timestamptz not null default now(), actor_id uuid references auth.users(id) on delete set null
);
create index movements_variant_idx on public.inventory_movements(variant_id);
create index movements_order_idx on public.inventory_movements(order_id);
create index movements_actor_idx on public.inventory_movements(actor_id);
create table public.order_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
 event text not null, actor_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
create index events_order_idx on public.order_events(order_id);
create index events_actor_idx on public.order_events(actor_id);
create table public.release_waitlist (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), email text not null,
 consent_at timestamptz not null, created_at timestamptz not null default now(), unique(product_id,email)
);
create table public.content_settings (id text primary key, body jsonb not null, updated_at timestamptz not null default now());
insert into public.content_settings values ('home','{"headline":"Made for your\neveryday extraordinary.","subtitle":"Een onafhankelijke kijk op de garderobe van morgen. Ontdek de eerste editie van WM Studio Collective."}',now());
create table private.platform_settings (singleton boolean primary key default true check(singleton), environment text not null check(environment in ('local','staging')));
insert into private.platform_settings values(true,'staging');
create table public.audit_logs (id uuid primary key default gen_random_uuid(), action text not null, actor_id uuid references auth.users(id) on delete set null, created_at timestamptz not null default now());
create index audit_actor_idx on public.audit_logs(actor_id);
create table private.rate_limits (key text primary key, count integer not null, reset_at timestamptz not null);
create table private.legacy_imports (source_id text primary key, digest text not null, imported_at timestamptz not null default now(), original jsonb not null);
create table private.legacy_records (source_id text not null references private.legacy_imports(source_id), table_name text not null, record jsonb not null);

-- Every table is closed before any grants are issued.
do $$ declare t text; begin
 foreach t in array array['roles','role_permissions','staff_members','brands','categories','releases','products','product_variants','inventory','customers','orders','order_items','inventory_reservations','inventory_movements','order_events','release_waitlist','content_settings','audit_logs'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['platform_settings','rate_limits','legacy_imports','legacy_records'] loop
 execute format('alter table private.%I enable row level security',t);
 execute format('revoke all on private.%I from public,anon,authenticated',t);
 execute format('grant all on private.%I to service_role',t);
 end loop;
end $$;
grant select on public.roles,public.role_permissions,public.staff_members to authenticated;
create policy own_membership on public.staff_members for select to authenticated using(user_id=(select auth.uid()));
create policy own_role on public.roles for select to authenticated using(exists(select 1 from public.staff_members where user_id=(select auth.uid()) and active and role=roles.name));
create policy own_permissions on public.role_permissions for select to authenticated using(exists(select 1 from public.staff_members where user_id=(select auth.uid()) and active and role=role_permissions.role));
grant select on public.brands,public.categories,public.releases,public.products,public.product_variants,public.inventory,public.content_settings to anon,authenticated;
create policy public_brands on public.brands for select to anon,authenticated using(true);
create policy public_categories on public.categories for select to anon,authenticated using(true);
create policy release_read on public.releases for select to anon,authenticated using(state in ('scheduled','published') or private.can('catalog.write'));
create policy product_read on public.products for select to anon,authenticated using(status in ('scheduled','published') or private.can('catalog.write'));
create policy variant_read on public.product_variants for select to anon,authenticated using((active and exists(select 1 from public.products p where p.id=product_id)) or private.can('catalog.write'));
create policy inventory_read on public.inventory for select to anon,authenticated using(exists(select 1 from public.product_variants v where v.id=variant_id));
create policy content_read on public.content_settings for select to anon,authenticated using(true);
grant select on public.customers,public.orders,public.order_items,public.inventory_reservations,public.inventory_movements,public.order_events,public.release_waitlist,public.audit_logs to authenticated;
create policy customer_read on public.customers for select to authenticated using(private.can('customers.read'));
create policy order_read on public.orders for select to authenticated using(private.can('orders.read'));
create policy item_read on public.order_items for select to authenticated using(private.can('orders.read'));
create policy event_read on public.order_events for select to authenticated using(private.can('orders.read'));
create policy reservation_read on public.inventory_reservations for select to authenticated using(private.can('orders.read'));
create policy movement_read on public.inventory_movements for select to authenticated using(private.can('catalog.write'));
create policy waitlist_read on public.release_waitlist for select to authenticated using(private.can('catalog.write'));
create policy audit_read on public.audit_logs for select to authenticated using(private.can('staff.manage'));
-- No direct client writes: transactional, permission-checked functions are the only mutation interface.

create view public.catalog with(security_invoker=true) as
select p.id, jsonb_build_object('id',p.id,'name',p.name,'slug',p.slug,'brand',b.name,'category',c.name,'gender',p.gender,
 'description',p.description,'price',p.price_cents,'status',p.status,'releaseAt',r.starts_at,'image',p.image_url,
 'createdAt',p.created_at,'version',p.version,'variants',coalesce((select jsonb_agg(jsonb_build_object('size',v.size,'color',v.color,'sku',v.sku,'stock',i.on_hand-i.reserved) order by v.position)
 from public.product_variants v join public.inventory i on i.variant_id=v.id where v.product_id=p.id and v.active),'[]'::jsonb)) body
from public.products p join public.brands b on b.id=p.brand_id join public.categories c on c.id=p.category_id left join public.releases r on r.id=p.release_id;
grant select on public.catalog to anon,authenticated,service_role;

create view public.order_overview with(security_invoker=true) as
select o.id,jsonb_build_object('id',o.id,'number',o.number,'name',o.customer_name,'email',o.customer_email,'address',o.shipping_address,
 'total',o.total_cents,'shipping',o.shipping_cents,'createdAt',o.created_at,'status',case when o.fulfillment_status<>'unfulfilled' then o.fulfillment_status else o.payment_status end,
 'items',coalesce((select jsonb_agg(jsonb_build_object('productId',i.product_id,'name',i.product_name,'sku',i.sku,'size',i.size,'color',i.color,'quantity',i.quantity,'price',i.price_cents) order by i.id) from public.order_items i where i.order_id=o.id),'[]'::jsonb)) body
from public.orders o;
grant select on public.order_overview to authenticated,service_role;
