-- تحديث: الوحدات الجديدة (كثافة المواد + وحدة حجم الكوب)
alter table public.materials add column if not exists density numeric;
alter table public.products add column if not exists serving_unit text not null default 'ml';
alter table public.materials drop constraint if exists materials_size_unit_check;
notify pgrst, 'reload schema';
