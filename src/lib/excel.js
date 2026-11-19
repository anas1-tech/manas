import * as XLSX from 'xlsx';
import { UNITS, parseUnit, baseOf, adaptUnit, unitsForMaterial, unitsForBase } from './units.js';

// أسماء الأعمدة ثابتة — الاستيراد يعتمد عليها
export const MAT_COLS = ['اسم المادة', 'التصنيف', 'نوع العبوة', 'سعر العبوة', 'شامل الضريبة', 'عدد الحبات في العبوة', 'حجم الحبة', 'وحدة الحجم', 'كثافة (جرام لكل 1 مل)', 'المورد', 'ملاحظات'];
export const PROD_COLS = ['اسم المنتج', 'الحجم', 'التصنيف', 'سعر البيع', 'شامل الضريبة', 'حجم الكوب', 'وحدة الكوب', 'نسبة الهدر %', 'يظهر في المنيو', 'مكوّن يُدمج', 'الكمية الناتجة', 'وحدة الناتج', 'الوصف'];
export const RECIPE_COLS = ['اسم المنتج', 'الحجم', 'المكوّن', 'الكمية', 'الوحدة'];

const yes = (v) => ['نعم', 'yes', 'y', '1', 'true', 'صح', '✓'].includes(String(v ?? '').trim().toLowerCase());
const yn = (b) => (b ? 'نعم' : 'لا');
const s = (v) => String(v ?? '').trim();
const n = (v) => {
  const t = String(v ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.').trim();
  return t === '' ? NaN : Number(t);
};

function sheet(rows, cols, widths) {
  const ws = XLSX.utils.aoa_to_sheet([cols, ...rows]);
  ws['!cols'] = (widths || cols.map(() => 16)).map((w) => ({ wch: w }));
  return ws;
}

function book(sheets) {
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  for (const [name, ws] of sheets) XLSX.utils.book_append_sheet(wb, ws, name);
  return wb;
}

const HELP = [
  ['طريقة التعبئة'],
  [''],
  ['1) ورقة «المواد»: كل شي تشتريه (حليب، شاي، أكواب...).'],
  ['   مثال: كرتون حليب فيه 12 علبة كل علبة 1 لتر بسعر 66 ← سعر العبوة 66، عدد الحبات 12، حجم الحبة 1، وحدة الحجم لتر.'],
  ['   إذا الشي يُحسب بالحبة (أكواب، أغطية) ← حجم الحبة 1 ووحدة الحجم حبة.'],
  ['   الوحدات المقبولة:'],
  ['     الحجم: مل، سنتيلتر، لتر، أونصة (سائلة)، شوت، ملعقة صغيرة، ملعقة كبيرة، كوب قياس، باينت، كوارت، جالون'],
  ['     الوزن: جرام، مليجرام، كيلو، أونصة وزن، باوند'],
  ['     العدد: حبة، درزن'],
  ['   «كثافة» اختيارية: كم جرام في 1 مل. مثلاً السكر 0.85، وبعدها تقدر تكتب السكر في الوصفة بالملعقة.'],
  [''],
  ['2) ورقة «المنتجات»: اللي تبيعه للزبون، وكل حجم في سطر (كرك صغير، كرك وسط).'],
  ['   «مكوّن يُدمج» = نعم إذا هو خلطة تستخدمها داخل منتجات ثانية (مثل خلطة كرك تطلع 2 لتر).'],
  [''],
  ['3) ورقة «الوصفات»: كم يدخل في الكوب الواحد من كل مكوّن.'],
  ['   كل مكوّن في سطر: اسم المنتج + الحجم + اسم المادة (أو اسم الخلطة) + الكمية + الوحدة.'],
  ['   مثال: كرك | وسط | خلطة كرك | 270 | مل'],
  ['   مثال: لاتيه | وسط | حليب طازج | 8 | أونصة'],
  ['   «حجم الكوب» في المنتجات تقدر تكتبه بالمل أو الأونصة: 12 + أونصة، أو 350 + مل.'],
  [''],
  ['الأسماء لازم تكون نفسها بالضبط بين الأوراق.'],
  ['إذا رفعت الملف مرة ثانية، الموقع يحدّث الموجود بنفس الاسم ويضيف الجديد.'],
];

function rowsFrom(materials, products) {
  const matName = new Map(materials.map((m) => [m.id, m.name]));
  const prodName = new Map(products.map((p) => [p.id, p.name]));
  const mRows = materials.map((m) => [m.name, m.category, m.package_name, m.package_price, yn(m.price_includes_vat), m.units_per_package, m.unit_size, UNITS[m.size_unit]?.label ?? 'حبة', m.density || '', m.supplier, m.notes]);
  const pRows = products.map((p) => [p.name, p.size, p.category, p.sell_price, yn(p.price_includes_vat), p.serving_ml ? +(p.serving_ml / UNITS[p.serving_unit || 'ml'].f).toFixed(2) : '', p.serving_ml ? UNITS[p.serving_unit || 'ml'].label : '', p.waste_pct ?? 0, yn(p.on_menu), yn(p.is_component), p.is_component ? p.yield_qty : '', p.is_component ? UNITS[p.yield_unit]?.label : '', p.description]);
  const rRows = products.flatMap((p) => (p.items || []).map((it) => [p.name, p.size, (it.type === 'product' ? prodName : matName).get(it.id) ?? '', it.qty, UNITS[it.unit]?.label ?? it.unit]));
  return { mRows, pRows, rRows };
}

export function downloadTemplate(materials = [], products = [], filename = 'نموذج-التكاليف.xlsx') {
  const { mRows, pRows, rRows } = rowsFrom(materials, products);
  const wb = book([
    ['طريقة التعبئة', sheet(HELP.slice(1), HELP[0], [110])],
    ['المواد', sheet(mRows, MAT_COLS, [26, 14, 12, 12, 12, 18, 12, 14, 20, 16, 20])],
    ['المنتجات', sheet(pRows, PROD_COLS, [22, 10, 16, 10, 12, 12, 14, 12, 14, 12, 14, 14, 26])],
    ['الوصفات', sheet(rRows, RECIPE_COLS, [22, 10, 26, 10, 10])],
  ]);
  XLSX.writeFile(wb, filename);
}

/** تقرير تكاليف جاهز للمحاسب */
export function downloadReport(calc, products, filename = 'تقرير-التكاليف.xlsx') {
  const rows = products.filter((p) => !p.is_component).map((p) => {
    const c = calc.product(p.id);
    return [p.name, p.size, p.category, +c.total.toFixed(3), +c.shelf.toFixed(2), +c.net.toFixed(2), +c.profit.toFixed(2), c.margin == null ? '' : +(c.margin * 100).toFixed(1)];
  });
  const wb = book([['التكاليف', sheet(rows, ['المنتج', 'الحجم', 'التصنيف', 'التكلفة', 'سعر البيع', 'الإيراد بدون ضريبة', 'الربح', 'هامش الربح %'], [22, 10, 16, 10, 10, 16, 10, 12])]]);
  XLSX.writeFile(wb, filename);
}

/**
 * يقرأ ملف Excel ويرجع معاينة: ايش بينضاف وايش بيتحدث والأخطاء.
 */
export async function parseWorkbook(file, existing) {
  const wb = XLSX.read(await file.arrayBuffer());
  const get = (name) => {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : [];
  };
  const errors = [];
  const out = { materials: [], products: [], history: [], summary: { matNew: 0, matUpd: 0, prodNew: 0, prodUpd: 0, recipes: 0 }, errors };

  if (!wb.Sheets['المواد'] && !wb.Sheets['المنتجات']) {
    errors.push('الملف ما فيه ورقة «المواد» أو «المنتجات». حمّل النموذج من الموقع واستخدمه.');
    return out;
  }

  // المواد
  const matByName = new Map(existing.materials.map((m) => [m.name.trim(), m]));
  get('المواد').forEach((r, i) => {
    const row = i + 2;
    const name = s(r['اسم المادة']);
    if (!name) return;
    const price = n(r['سعر العبوة']);
    const units = n(r['عدد الحبات في العبوة'] || 1);
    const size = n(r['حجم الحبة'] || 1);
    const unit = parseUnit(r['وحدة الحجم'] || 'حبة');
    if (!Number.isFinite(price) || price < 0) { errors.push(`المواد سطر ${row}: سعر العبوة غير صحيح لـ «${name}»`); return; }
    if (!Number.isFinite(units) || units <= 0) { errors.push(`المواد سطر ${row}: عدد الحبات غير صحيح لـ «${name}»`); return; }
    if (!Number.isFinite(size) || size <= 0) { errors.push(`المواد سطر ${row}: حجم الحبة غير صحيح لـ «${name}»`); return; }
    if (!unit) { errors.push(`المواد سطر ${row}: الوحدة «${s(r['وحدة الحجم'])}» مو معروفة (شوف ورقة طريقة التعبئة)`); return; }
    const dens = n(r['كثافة (جرام لكل 1 مل)']);
    const prev = matByName.get(name);
    const m = {
      ...(prev || {}),
      id: prev?.id || crypto.randomUUID(),
      name, category: s(r['التصنيف']), package_name: s(r['نوع العبوة']) || 'كرتون',
      package_price: price, price_includes_vat: r['شامل الضريبة'] === '' ? true : yes(r['شامل الضريبة']),
      units_per_package: units, unit_size: size, size_unit: unit,
      density: Number.isFinite(dens) && dens > 0 && baseOf(unit) !== 'pcs' ? dens : null,
      supplier: s(r['المورد']), notes: s(r['ملاحظات']),
    };
    matByName.set(name, m);
    out.materials.push(m);
    if (!prev || Number(prev.package_price) !== price)
      out.history.push({ id: crypto.randomUUID(), material_id: m.id, package_price: price, recorded_at: new Date().toISOString() });
    prev ? out.summary.matUpd++ : out.summary.matNew++;
  });

  // المنتجات
  const pk = (name, size) => `${s(name)}|${s(size)}`;
  const prodByKey = new Map(existing.products.map((p) => [pk(p.name, p.size), p]));
  const touched = new Map();
  get('المنتجات').forEach((r, i) => {
    const row = i + 2;
    const name = s(r['اسم المنتج']);
    if (!name) return;
    const key = pk(name, r['الحجم']);
    const prev = prodByKey.get(key);
    const comp = yes(r['مكوّن يُدمج']);
    const price = n(r['سعر البيع']);
    const yUnit = parseUnit(r['وحدة الناتج']) || (comp ? 'ml' : 'pcs');
    if (!comp && r['سعر البيع'] !== '' && !Number.isFinite(price)) errors.push(`المنتجات سطر ${row}: سعر البيع غير صحيح لـ «${name}»`);
    const p = {
      size: '', category: '', description: '', serving_ml: null, waste_pct: 0, sell_price: 0, price_includes_vat: true,
      on_menu: true, is_component: false, yield_qty: 1, yield_unit: 'pcs', sort: existing.products.length + i, items: [],
      ...(prev || {}),
      id: prev?.id || crypto.randomUUID(),
      name, size: s(r['الحجم']), category: s(r['التصنيف']),
      sell_price: Number.isFinite(price) ? price : 0,
      price_includes_vat: r['شامل الضريبة'] === '' ? true : yes(r['شامل الضريبة']),
      ...serving(r),
      waste_pct: Number.isFinite(n(r['نسبة الهدر %'])) ? n(r['نسبة الهدر %']) : 0,
      on_menu: comp ? false : r['يظهر في المنيو'] === '' ? true : yes(r['يظهر في المنيو']),
      is_component: comp,
      yield_qty: comp ? n(r['الكمية الناتجة']) || 1 : 1,
      yield_unit: comp ? yUnit : 'pcs',
      description: s(r['الوصف']),
    };
    prodByKey.set(key, p);
    touched.set(key, p);
    prev ? out.summary.prodUpd++ : out.summary.prodNew++;
  });

  function serving(r) {
    const v = n(r['حجم الكوب'] !== undefined ? r['حجم الكوب'] : r['حجم الكوب (مل)']);
    let u = parseUnit(r['وحدة الكوب']) || 'ml';
    u = adaptUnit(u, 'ml');
    if (baseOf(u) !== 'ml') u = 'ml';
    return Number.isFinite(v) && v > 0 ? { serving_ml: +(v * UNITS[u].f).toFixed(1), serving_unit: u } : { serving_ml: null, serving_unit: 'ml' };
  }

  // الوصفات: تستبدل مكونات أي منتج مذكور فيها
  const recipeRows = get('الوصفات');
  const newItems = new Map();
  const compByName = new Map([...prodByKey.values()].filter((p) => p.is_component).map((p) => [p.name, p]));
  recipeRows.forEach((r, i) => {
    const row = i + 2;
    const name = s(r['اسم المنتج']);
    if (!name) return;
    const key = pk(name, r['الحجم']);
    const p = prodByKey.get(key);
    if (!p) { errors.push(`الوصفات سطر ${row}: المنتج «${name}${s(r['الحجم']) ? ' ' + s(r['الحجم']) : ''}» مو موجود في ورقة المنتجات`); return; }
    const ing = s(r['المكوّن']);
    const q = n(r['الكمية']);
    let unit = parseUnit(r['الوحدة']);
    const mat = matByName.get(ing);
    const comp = compByName.get(ing);
    if (!mat && !comp) { errors.push(`الوصفات سطر ${row}: المكوّن «${ing}» مو موجود في المواد ولا الخلطات`); return; }
    if (!Number.isFinite(q) || q <= 0) { errors.push(`الوصفات سطر ${row}: الكمية غير صحيحة`); return; }
    if (!unit) { errors.push(`الوصفات سطر ${row}: الوحدة «${s(r['الوحدة'])}» مو معروفة`); return; }
    const targetBase = mat ? baseOf(mat.size_unit) : baseOf(comp.yield_unit);
    unit = adaptUnit(unit, targetBase);
    const allowed = mat ? unitsForMaterial(mat) : unitsForBase(targetBase);
    if (!allowed.includes(unit)) { errors.push(`الوصفات سطر ${row}: «${ing}» تنقاس بـ${targetBase === 'g' ? 'الوزن' : targetBase === 'ml' ? 'الحجم' : 'العدد'}، فما ينفع ${UNITS[unit].label}${mat && targetBase !== 'pcs' ? ' إلا لو حطيت لها كثافة' : ''}`); return; }
    if (!newItems.has(key)) newItems.set(key, []);
    newItems.get(key).push(mat ? { type: 'material', id: mat.id, qty: q, unit } : { type: 'product', id: comp.id, qty: q, unit });
    out.summary.recipes++;
  });
  for (const [key, items] of newItems) {
    const p = touched.get(key) || { ...prodByKey.get(key) };
    p.items = items;
    touched.set(key, p);
  }
  out.products = [...touched.values()];
  return out;
}
