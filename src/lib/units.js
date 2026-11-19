// الوحدات: كل وحدة ترجع لوحدة أساس (جرام / مل / حبة)
export const UNITS = {
  g: { label: 'جرام', short: 'جم', base: 'g', f: 1 },
  kg: { label: 'كيلو', short: 'كجم', base: 'g', f: 1000 },
  ml: { label: 'مل', short: 'مل', base: 'ml', f: 1 },
  L: { label: 'لتر', short: 'لتر', base: 'ml', f: 1000 },
  oz: { label: 'أونصة', short: 'oz', base: 'ml', f: 29.5735 },
  pcs: { label: 'حبة', short: 'حبة', base: 'pcs', f: 1 },
};

export const BASE_BIG = { g: 'kg', ml: 'L', pcs: 'pcs' };

export const unitsForBase = (base) =>
  Object.keys(UNITS).filter((k) => UNITS[k].base === base);

export const baseOf = (unit) => UNITS[unit]?.base ?? 'pcs';

export const toBase = (qty, unit) => (Number(qty) || 0) * (UNITS[unit]?.f ?? 1);

// قراءة الوحدة من نص عربي/إنجليزي (للاستيراد من Excel)
const ALIASES = {
  g: ['g', 'gm', 'gr', 'جرام', 'جم', 'غرام', 'غ', 'جرامات'],
  kg: ['kg', 'كيلو', 'كجم', 'كغ', 'كيلوجرام', 'كيلوغرام'],
  ml: ['ml', 'مل', 'ملي', 'مللي', 'ملل', 'مليلتر'],
  L: ['l', 'lt', 'ltr', 'liter', 'litre', 'لتر', 'ل'],
  oz: ['oz', 'أونصة', 'اونصة', 'اونص'],
  pcs: ['pcs', 'pc', 'piece', 'حبة', 'حبه', 'قطعة', 'قطعه', 'عدد', 'كوب', 'غطاء'],
};
export function parseUnit(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  for (const [k, list] of Object.entries(ALIASES)) if (list.includes(t)) return k;
  return null;
}
