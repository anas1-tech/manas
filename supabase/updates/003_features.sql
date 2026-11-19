-- ═══════════════════════════════════════════════
-- تحديث 3: المبيعات، المصاريف، المخزون، الموردين، الإضافات والعروض،
-- الموظفين والصلاحيات، صور المنيو والإنجليزي
-- الصقه في Supabase ← SQL Editor ← Run (آمن لو انشغّل أكثر من مرة)
-- ═══════════════════════════════════════════════

-- ───── أعمدة جديدة ─────
alter table public.settings add column if not exists working_days numeric not null default 30;
alter table public.settings add column if not exists menu_lang text not null default 'ar';
alter table public.materials add column if not exists min_stock numeric;           -- أقل كمية (بالعبوات) قبل التنبيه
alter table public.products add column if not exists kind text not null default 'product'; -- product | addon | combo
alter table public.products add column if not exists name_en text default '';
alter table public.products add column if not exists description_en text default '';
alter table public.products add column if not exists image_url text default '';

-- ───── الموظفين والصلاحيات ─────
create table if not exists public.staff (
  email text primary key,
  name text default '',
  role text not null default 'staff' check (role in ('admin','staff')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
insert into public.staff (email, name, role) values ('admin@example.com', 'المدير', 'admin') on conflict (email) do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where lower(email) = lower(auth.jwt() ->> 'email') and role = 'admin')
$$;

-- ───── جداول جديدة ─────
create table if not exists public.expenses (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  category text default '',
  amount numeric not null default 0,
  period text not null default 'month' check (period in ('day','week','month','year')),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sales (
  id text primary key default gen_random_uuid()::text,
  sale_date date not null default current_date,
  product_id text not null,
  product_name text default '',
  qty numeric not null default 1,
  unit_price numeric not null default 0,   -- السعر وقت البيع (شامل)
  unit_net numeric,                         -- الإيراد بدون ضريبة
  unit_cost numeric,                        -- التكلفة وقت البيع (لو سجلها المدير)
  created_by text default (auth.jwt() ->> 'email'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists sales_date_idx on public.sales(sale_date);

create table if not exists public.stock_moves (
  id text primary key default gen_random_uuid()::text,
  material_id text not null references public.materials(id) on delete cascade,
  qty_base numeric not null,             -- موجب = دخل، سالب = طلع (بوحدة أساس المادة)
  kind text not null default 'purchase' check (kind in ('purchase','count','waste','adjust')),
  note text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists stock_moves_material_idx on public.stock_moves(material_id);

create table if not exists public.supplier_prices (
  id text primary key default gen_random_uuid()::text,
  material_id text not null references public.materials(id) on delete cascade,
  supplier text not null,
  package_price numeric not null default 0,
  units_per_package numeric not null default 1,
  unit_size numeric not null default 1,
  size_unit text not null default 'pcs',
  price_includes_vat boolean not null default true,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ───── الصلاحيات (المدير يسوي كل شي، الموظف يسجل مبيعات ويشوف الأسعار) ─────
alter table public.staff enable row level security;
alter table public.expenses enable row level security;
alter table public.sales enable row level security;
alter table public.stock_moves enable row level security;
alter table public.supplier_prices enable row level security;

do $$
declare t text;
begin
  -- جداول للمدير فقط
  foreach t in array array['materials','price_history','expenses','stock_moves','supplier_prices'] loop
    execute format('drop policy if exists "staff_all" on public.%I', t);
    execute format('drop policy if exists "admin_all" on public.%I', t);
    execute format('create policy "admin_all" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
  -- جداول يقرأها الكل ويعدلها المدير
  foreach t in array array['products','settings'] loop
    execute format('drop policy if exists "staff_all" on public.%I', t);
    execute format('drop policy if exists "read_all" on public.%I', t);
    execute format('drop policy if exists "admin_write" on public.%I', t);
    execute format('create policy "read_all" on public.%I for select to authenticated using (true)', t);
    execute format('create policy "admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

drop policy if exists "sales_read" on public.sales;
drop policy if exists "sales_insert" on public.sales;
drop policy if exists "sales_admin" on public.sales;
drop policy if exists "sales_own_delete" on public.sales;
create policy "sales_read" on public.sales for select to authenticated using (true);
create policy "sales_insert" on public.sales for insert to authenticated with check (true);
create policy "sales_admin" on public.sales for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sales_own_delete" on public.sales for delete to authenticated
  using (public.is_admin() or (created_by = auth.jwt() ->> 'email' and sale_date = current_date));

drop policy if exists "staff_self" on public.staff;
drop policy if exists "staff_admin" on public.staff;
create policy "staff_self" on public.staff for select to authenticated using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_admin());
create policy "staff_admin" on public.staff for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ───── المنيو العام (مع الإنجليزي والصور) ─────
drop view if exists public.public_menu;
create view public.public_menu as
select p.id, p.name, p.size, p.category, p.description, p.serving_ml, p.sort,
  p.kind, p.name_en, p.description_en, p.image_url,
  case when s.vat_registered and not p.price_includes_vat
       then round(p.sell_price * (1 + s.vat_rate / 100), 2)
       else p.sell_price end as shelf_price
from public.products p
cross join public.settings s
where s.id = 1 and p.on_menu and not p.is_component and p.sell_price > 0;

drop view if exists public.public_shop;
create view public.public_shop as
select shop_name, menu_note, vat_registered, menu_lang from public.settings where id = 1;

grant select on public.public_menu, public.public_shop to anon, authenticated;

-- ───── صور المنيو (تخزين عام للقراءة، الرفع للمدير) ─────
insert into storage.buckets (id, name, public) values ('menu', 'menu', true) on conflict (id) do nothing;
drop policy if exists "menu_public_read" on storage.objects;
drop policy if exists "menu_admin_write" on storage.objects;
drop policy if exists "menu_admin_update" on storage.objects;
drop policy if exists "menu_admin_delete" on storage.objects;
create policy "menu_public_read" on storage.objects for select using (bucket_id = 'menu');
create policy "menu_admin_write" on storage.objects for insert to authenticated with check (bucket_id = 'menu' and public.is_admin());
create policy "menu_admin_update" on storage.objects for update to authenticated using (bucket_id = 'menu' and public.is_admin());
create policy "menu_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'menu' and public.is_admin());

-- ───── التحديث المباشر ─────
do $$
declare t text;
begin
  foreach t in array array['expenses','sales','stock_moves','supplier_prices','staff'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

notify pgrst, 'reload schema';
