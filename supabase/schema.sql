-- ═══════════════════════════════════════════════
-- مانس كوفي: حاسبة التكاليف
-- انسخ هذا الملف كامل والصقه في Supabase ← SQL Editor ← Run
-- ═══════════════════════════════════════════════

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  shop_name text not null default 'مانس كوفي',
  menu_note text default '',
  vat_rate numeric not null default 15,
  vat_registered boolean not null default false,
  target_margin numeric not null default 65,
  default_waste numeric not null default 0,
  updated_at timestamptz default now()
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.materials (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  category text default '',
  package_name text default 'كرتون',
  package_price numeric not null default 0,
  price_includes_vat boolean not null default true,
  units_per_package numeric not null default 1,
  unit_size numeric not null default 1,
  size_unit text not null default 'pcs',
  density numeric,
  supplier text default '',
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.price_history (
  id text primary key default gen_random_uuid()::text,
  material_id text not null references public.materials(id) on delete cascade,
  package_price numeric not null,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz default now()
);
create index if not exists price_history_material_idx on public.price_history(material_id, recorded_at);

create table if not exists public.products (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  size text default '',
  category text default '',
  description text default '',
  serving_ml numeric,
  serving_unit text not null default 'ml',
  waste_pct numeric not null default 0,
  sell_price numeric not null default 0,
  price_includes_vat boolean not null default true,
  on_menu boolean not null default true,
  is_component boolean not null default false,
  yield_qty numeric not null default 1,
  yield_unit text not null default 'pcs',
  sort numeric default 0,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ───── الحماية: البيانات للمستخدمين المسجلين بس ─────
alter table public.settings enable row level security;
alter table public.materials enable row level security;
alter table public.price_history enable row level security;
alter table public.products enable row level security;

do $$
declare t text;
begin
  foreach t in array array['settings','materials','price_history','products'] loop
    execute format('drop policy if exists "staff_all" on public.%I', t);
    execute format('create policy "staff_all" on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ───── المنيو العام: أسماء وأسعار فقط (بدون تكاليف) ─────
create or replace view public.public_menu as
select p.id, p.name, p.size, p.category, p.description, p.serving_ml, p.sort,
  case when s.vat_registered and not p.price_includes_vat
       then round(p.sell_price * (1 + s.vat_rate / 100), 2)
       else p.sell_price end as shelf_price
from public.products p
cross join public.settings s
where s.id = 1 and p.on_menu and not p.is_component and p.sell_price > 0;

create or replace view public.public_shop as
select shop_name, menu_note, vat_registered from public.settings where id = 1;

revoke all on public.public_menu, public.public_shop from anon;
grant select on public.public_menu, public.public_shop to anon, authenticated;

-- ───── التحديث المباشر بين الأجهزة ─────
do $$
declare t text;
begin
  foreach t in array array['settings','materials','price_history','products'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
