-- تحديث 4: توزيع المصاريف (إيجار، كهرباء…) على المنتجات
alter table public.settings add column if not exists overhead_mode text not null default 'unit';
alter table public.settings add column if not exists expected_units numeric;
notify pgrst, 'reload schema';
