import { UNITS, toBase, baseOf, toMaterialBase } from './units.js';

export const DEFAULT_SETTINGS = {
  id: 1,
  shop_name: 'مانس كوفي',
  menu_note: '',
  vat_rate: 15,
  vat_registered: false,
  target_margin: 65,
  default_waste: 0,
};

export const vatFactor = (s) => 1 + (Number(s?.vat_rate) || 0) / 100;

/**
 * سعر العبوة الفعلي اللي يدخل في التكلفة.
 * - المسجل بالضريبة يسترجع ضريبة المشتريات ← التكلفة بدون ضريبة.
 * - غير المسجل ما يسترجعها ← التكلفة شاملة الضريبة.
 */
export function effectivePackagePrice(m, s) {
  const f = vatFactor(s);
  let p = Number(m.package_price) || 0;
  if (s.vat_registered) {
    if (m.price_includes_vat) p = p / f;
  } else if (!m.price_includes_vat) {
    p = p * f;
  }
  return p;
}

/** كمية العبوة كاملة بوحدة الأساس (جرام/مل/حبة) */
export function packageBaseQty(m) {
  const units = Number(m.units_per_package) || 0;
  return units * toBase(m.unit_size ?? 1, m.size_unit || 'pcs');
}

export const materialBase = (m) => baseOf(m.size_unit || 'pcs');

/** تكلفة جرام/مل/حبة واحدة */
export function costPerBase(m, s) {
  const q = packageBaseQty(m);
  return q > 0 ? effectivePackagePrice(m, s) / q : 0;
}

/** تكلفة الحبة الواحدة من العبوة (مثل علبة الحليب الوحدة) */
export function costPerPiece(m, s) {
  const n = Number(m.units_per_package) || 0;
  return n > 0 ? effectivePackagePrice(m, s) / n : 0;
}

/** سعر البيع: الصافي (الإيراد الفعلي) والمعروض للزبون */
export function priceParts(p, s) {
  const f = vatFactor(s);
  const price = Number(p.sell_price) || 0;
  if (!s.vat_registered) return { net: price, shelf: price, vat: 0 };
  const net = p.price_includes_vat ? price / f : price;
  const shelf = p.price_includes_vat ? price : price * f;
  return { net, shelf, vat: shelf - net };
}

export function marginStatus(margin, s) {
  if (margin == null) return 'none';
  const target = (Number(s.target_margin) || 0) / 100;
  if (margin >= target) return 'good';
  if (margin >= target - 0.15) return 'warn';
  return 'bad';
}

/** يقترح سعر بيع يحقق الهامش المستهدف، مقرّب لأقرب نص ريال للأعلى */
export function suggestPrice(cost, s, marginPct = s.target_margin) {
  const m = Math.min(Number(marginPct) || 0, 95) / 100;
  const net = cost / (1 - m);
  const shelf = s.vat_registered ? net * vatFactor(s) : net;
  return { net, shelf, rounded: Math.ceil(shelf * 2 - 1e-9) / 2 };
}

/**
 * يبني حاسبة لكل المنتجات (مع دعم المنتجات المدموجة داخل بعض).
 * overrides: { [materialId]: package_price } للمحاكاة.
 */
export function makeCalc(materials, products, s, overrides = {}) {
  const mats = new Map(materials.map((m) => [m.id, overrides[m.id] != null ? { ...m, package_price: overrides[m.id] } : m]));
  const prods = new Map(products.map((p) => [p.id, p]));
  const cache = new Map();

  function product(id, stack = []) {
    if (cache.has(id)) return cache.get(id);
    const p = prods.get(id);
    if (!p) return null;
    if (stack.includes(id)) return { total: 0, raw: 0, waste: 0, lines: [], issues: ['دمج دائري: المنتج يحتوي نفسه'] };

    const lines = [];
    const issues = [];
    let raw = 0;
    for (const it of p.items || []) {
      const qtyBase = toBase(it.qty, it.unit);
      const ub = baseOf(it.unit);
      if (!it.id) { lines.push({ ...it, name: '', cost: 0, baseQty: 0, empty: true }); continue; }
      if (it.type === 'product') {
        const sp = prods.get(it.id);
        if (!sp) { issues.push('مكوّن محذوف'); lines.push({ ...it, name: 'مكوّن محذوف', cost: 0, missing: true }); continue; }
        const sub = product(it.id, [...stack, id]);
        const yBase = toBase(sp.yield_qty || 1, sp.yield_unit || 'pcs');
        const yb = baseOf(sp.yield_unit || 'pcs');
        if (yb !== ub) issues.push(`وحدة ${sp.name} لازم تكون ${UNITS[sp.yield_unit || 'pcs'].label}`);
        const cost = yBase > 0 && yb === ub ? (sub.total / yBase) * qtyBase : 0;
        raw += cost;
        lines.push({ ...it, name: sp.name + (sp.size ? ` (${sp.size})` : ''), cost, base: yb, baseQty: qtyBase, isProduct: true });
      } else {
        const m = mats.get(it.id);
        if (!m) { issues.push('مادة محذوفة'); lines.push({ ...it, name: 'مادة محذوفة', cost: 0, missing: true }); continue; }
        const mb = materialBase(m);
        const q = toMaterialBase(it.qty, it.unit, m);
        if (Number.isNaN(q)) issues.push(`«${m.name}» تنقاس بـ${mb === 'g' ? 'الوزن' : mb === 'ml' ? 'الحجم' : 'العدد'}. لو تبي تقيسها بـ${ub === 'g' ? 'الوزن' : 'الحجم'}، حط لها كثافة في صفحة المواد`);
        const cost = Number.isNaN(q) ? 0 : costPerBase(m, s) * q;
        raw += cost;
        lines.push({ ...it, name: m.name, cost, base: mb, baseQty: Number.isNaN(q) ? 0 : q });
      }
    }
    const waste = raw * ((Number(p.waste_pct) || 0) / 100);
    const total = raw + waste;
    const { net, shelf, vat } = priceParts(p, s);
    const profit = net - total;
    const noRecipe = !(p.items || []).some((it) => it.id);
    const margin = net > 0 && !noRecipe ? profit / net : null;
    const liquidMl = lines.filter((l) => l.base === 'ml').reduce((a, l) => a + l.baseQty, 0);
    const res = { id, product: p, lines, raw, waste, total, net, shelf, vat, profit, margin, liquidMl, issues, noRecipe, status: p.is_component ? 'none' : noRecipe ? 'norecipe' : marginStatus(margin, s) };
    cache.set(id, res);
    return res;
  }

  const all = () => products.map((p) => product(p.id));
  return { product, all, mats };
}

/** المنتجات اللي تستخدم مادة (مباشرة أو عبر مكوّن مدموج) */
export function productsUsingMaterial(materialId, products) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const uses = (p, seen = new Set()) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return (p.items || []).some((it) =>
      it.type === 'product' ? byId.get(it.id) && uses(byId.get(it.id), seen) : it.id === materialId,
    );
  };
  return products.filter((p) => uses(p));
}

/**
 * كم يستهلك المنتج الواحد من مادة (بوحدة أساس المادة)، مع الخلطات والهدر.
 */
export function materialUsage(materialId, productId, materials, products, seen = []) {
  const p = products.find((x) => x.id === productId);
  const m = materials.find((x) => x.id === materialId);
  if (!p || !m || seen.includes(productId)) return 0;
  let total = 0;
  for (const it of p.items || []) {
    if (it.type === 'product') {
      const sp = products.find((x) => x.id === it.id);
      if (!sp) continue;
      const yBase = toBase(sp.yield_qty || 1, sp.yield_unit || 'pcs');
      if (!yBase || baseOf(sp.yield_unit || 'pcs') !== baseOf(it.unit)) continue;
      total += (materialUsage(materialId, sp.id, materials, products, [...seen, productId]) / yBase) * toBase(it.qty, it.unit);
    } else if (it.id === materialId) {
      const q = toMaterialBase(it.qty, it.unit, m);
      if (!Number.isNaN(q)) total += q;
    }
  }
  return total * (1 + (Number(p.waste_pct) || 0) / 100);
}
