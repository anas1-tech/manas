// الوحدات: كل وحدة ترجع لوحدة أساس (جرام / مل / حبة)
// الترتيب هنا هو ترتيبها في القوائم
export const UNITS = {
  // ── الحجم (الأساس: مل) ──
  ml: { label: 'مل', short: 'مل', base: 'ml', f: 1 },
  cl: { label: 'سنتيلتر', short: 'سل', base: 'ml', f: 10 },
  L: { label: 'لتر', short: 'لتر', base: 'ml', f: 1000 },
  oz: { label: 'أونصة سائلة', short: 'oz', base: 'ml', f: 29.5735 },
  shot: { label: 'شوت (30 مل)', short: 'شوت', base: 'ml', f: 30 },
  tsp: { label: 'ملعقة صغيرة (5 مل)', short: 'م.ص', base: 'ml', f: 5 },
  tbsp: { label: 'ملعقة كبيرة (15 مل)', short: 'م.ك', base: 'ml', f: 15 },
  cup: { label: 'كوب قياس (240 مل)', short: 'كوب قياس', base: 'ml', f: 240 },
  pt: { label: 'باينت', short: 'pt', base: 'ml', f: 473.176 },
  qt: { label: 'كوارت', short: 'qt', base: 'ml', f: 946.353 },
  gal: { label: 'جالون أمريكي (3.79 لتر)', short: 'جالون', base: 'ml', f: 3785.41 },
  // ── الوزن (الأساس: جرام) ──
  g: { label: 'جرام', short: 'جم', base: 'g', f: 1 },
  mg: { label: 'مليجرام', short: 'ملجم', base: 'g', f: 0.001 },
  kg: { label: 'كيلو', short: 'كجم', base: 'g', f: 1000 },
  ozw: { label: 'أونصة (وزن)', short: 'oz', base: 'g', f: 28.3495 },
  lb: { label: 'باوند', short: 'lb', base: 'g', f: 453.592 },
  // ── العدد (الأساس: حبة) ──
  pcs: { label: 'حبة', short: 'حبة', base: 'pcs', f: 1 },
  dozen: { label: 'درزن (12)', short: 'درزن', base: 'pcs', f: 12 },
};

export const BASE_NAME = { ml: 'الحجم', g: 'الوزن', pcs: 'العدد' };
export const BASE_BIG = { g: 'kg', ml: 'L', pcs: 'pcs' };

export const unitsForBase = (base) => Object.keys(UNITS).filter((k) => UNITS[k].base === base);
export const baseOf = (unit) => UNITS[unit]?.base ?? 'pcs';
export const toBase = (qty, unit) => (Number(qty) || 0) * (UNITS[unit]?.f ?? 1);

/** الكثافة: كم جرام في 1 مل. لو موجودة نقدر نحوّل بين الوزن والحجم */
export const hasDensity = (m) => Number(m?.density) > 0 && baseOf(m.size_unit) !== 'pcs';

/** الوحدات المسموحة لمادة في الوصفة */
export function unitsForMaterial(m) {
  const b = baseOf(m?.size_unit);
  if (hasDensity(m)) return [...unitsForBase(b), ...unitsForBase(b === 'g' ? 'ml' : 'g')];
  return unitsForBase(b);
}

/** يحوّل كمية بأي وحدة إلى وحدة أساس المادة (مع الكثافة لو لزم). يرجع NaN لو ما ينفع */
export function toMaterialBase(qty, unit, m) {
  const q = toBase(qty, unit);
  const ub = baseOf(unit);
  const mb = baseOf(m.size_unit);
  if (ub === mb) return q;
  const d = Number(m.density);
  if (d > 0 && ub === 'ml' && mb === 'g') return q * d;
  if (d > 0 && ub === 'g' && mb === 'ml') return q / d;
  return NaN;
}

/** يضبط الأونصة حسب نوع المادة (سائلة أو وزن) */
export function adaptUnit(unit, targetBase) {
  if (unit === 'oz' && targetBase === 'g') return 'ozw';
  if (unit === 'ozw' && targetBase === 'ml') return 'oz';
  return unit;
}

// قراءة الوحدة من نص عربي/إنجليزي (للاستيراد من Excel)
const ALIASES = {
  ml: ['ml', 'مل', 'ملي', 'مللي', 'ملل', 'مليلتر', 'ملليلتر'],
  cl: ['cl', 'سنتيلتر', 'سل'],
  L: ['l', 'lt', 'ltr', 'liter', 'litre', 'لتر', 'ل', 'ليتر'],
  oz: ['oz', 'fl oz', 'floz', 'أونصة', 'اونصة', 'اونص', 'أونصة سائلة', 'اونصة سائلة', 'أونز', 'اونز'],
  shot: ['shot', 'شوت', 'شوتات'],
  tsp: ['tsp', 'ملعقة صغيرة', 'ملعقه صغيره', 'م.ص', 'م ص', 'ملعقة شاي'],
  tbsp: ['tbsp', 'ملعقة كبيرة', 'ملعقه كبيره', 'م.ك', 'م ك', 'ملعقة طعام'],
  cup: ['cup', 'كوب قياس', 'كوب قياسي'],
  pt: ['pt', 'pint', 'باينت'],
  qt: ['qt', 'quart', 'كوارت'],
  gal: ['gal', 'gallon', 'جالون', 'غالون', 'جالون أمريكي'],
  g: ['g', 'gm', 'gr', 'جرام', 'جم', 'غرام', 'غ', 'جرامات'],
  mg: ['mg', 'ملجم', 'مليجرام', 'ملغ', 'مليغرام'],
  kg: ['kg', 'كيلو', 'كجم', 'كغ', 'كيلوجرام', 'كيلوغرام'],
  ozw: ['ozw', 'oz wt', 'أونصة (وزن)', 'أونصة وزن', 'اونصة وزن'],
  lb: ['lb', 'lbs', 'pound', 'باوند', 'رطل'],
  pcs: ['pcs', 'pc', 'piece', 'حبة', 'حبه', 'قطعة', 'قطعه', 'عدد', 'كوب', 'غطاء', 'حبات'],
  dozen: ['dozen', 'درزن', 'دزينة', 'دستة', 'درزينة'],
};
export function parseUnit(text) {
  const t = String(text ?? '').trim().toLowerCase();
  if (!t) return null;
  for (const [k, u] of Object.entries(UNITS)) if (u.label.toLowerCase() === t) return k;
  for (const [k, list] of Object.entries(ALIASES)) if (list.includes(t)) return k;
  return null;
}

/** كثافات جاهزة (جرام لكل 1 مل) — تقريبية */
export const DENSITY_PRESETS = [
  ['ماء / شاي / قهوة', 1],
  ['حليب', 1.03],
  ['حليب مبخر', 1.07],
  ['سكر', 0.85],
  ['حليب بودرة', 0.5],
  ['بن مطحون', 0.4],
  ['كاكاو', 0.5],
  ['سيرب / شيرة', 1.3],
  ['عسل', 1.42],
];
