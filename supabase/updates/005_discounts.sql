-- تحديث 5: الخصومات في المبيعات (مبلغ الخصم على السطر شامل الضريبة)
alter table public.sales add column if not exists discount numeric not null default 0;
notify pgrst, 'reload schema';
