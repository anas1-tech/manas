import { UNITS, toBase, baseOf, toMaterialBase } from './units.js';

export const DEFAULT_SETTINGS = {
  id: 1,
  shop_name: 'مأنس',
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
    // للعروض: كم سعرها لو انشرت كل حبة لحالها
    const itemsShelf = (p.items || []).reduce((acc, it) => {
      const sp = it.type === 'product' && prods.get(it.id);
      return sp && !sp.is_component ? acc + priceParts(sp, s).shelf * toBase(it.qty, it.unit) : acc;
    }, 0);
    const profit = net - total;
    const noRecipe = !(p.items || []).some((it) => it.id);
    const margin = net > 0 && !noRecipe ? profit / net : null;
    const liquidMl = lines.filter((l) => l.base === 'ml').reduce((a, l) => a + l.baseQty, 0);
    const res = { id, product: p, lines, raw, waste, total, net, shelf, vat, profit, margin, liquidMl, issues, noRecipe, itemsShelf, status: p.is_component ? 'none' : noRecipe ? 'norecipe' : marginStatus(margin, s) };
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

/** كم يستهلك المنتج الواحد من كل مادة: Map(materialId → كمية بوحدة الأساس) */
export function usageMap(productId, products, materials, seen = []) {
  const out = new Map();
  const p = products.find((x) => x.id === productId);
  if (!p || seen.includes(productId)) return out;
  const w = 1 + (Number(p.waste_pct) || 0) / 100;
  for (const it of p.items || []) {
    if (!it.id) continue;
    if (it.type === 'product') {
      const sp = products.find((x) => x.id === it.id);
      if (!sp) continue;
      const yBase = toBase(sp.yield_qty || 1, sp.yield_unit || 'pcs');
      if (!yBase || baseOf(sp.yield_unit || 'pcs') !== baseOf(it.unit)) continue;
      const factor = toBase(it.qty, it.unit) / yBase;
      for (const [mid, q] of usageMap(sp.id, products, materials, [...seen, productId])) out.set(mid, (out.get(mid) || 0) + q * factor * w);
    } else {
      const m = materials.find((x) => x.id === it.id);
      if (!m) continue;
      const q = toMaterialBase(it.qty, it.unit, m);
      if (!Number.isNaN(q)) out.set(m.id, (out.get(m.id) || 0) + q * w);
    }
  }
  return out;
}

/**
 * المخزون الحالي لكل مادة (بوحدة الأساس) = اللي دخل − اللي انصرف في المبيعات.
 * المبيعات تنحسب من أول جرد/استلام للمادة وطالع.
 */
export function stockLevels(materials, products, moves, sales) {
  const start = new Map();
  const level = new Map();
  for (const mv of moves) {
    level.set(mv.material_id, (level.get(mv.material_id) || 0) + Number(mv.qty_base || 0));
    const d = String(mv.created_at || '').slice(0, 10);
    if (!start.has(mv.material_id) || d < start.get(mv.material_id)) start.set(mv.material_id, d);
  }
  const usageCache = new Map();
  const use = (pid) => {
    if (!usageCache.has(pid)) usageCache.set(pid, usageMap(pid, products, materials));
    return usageCache.get(pid);
  };
  for (const sale of sales) {
    for (const [mid, q] of use(sale.product_id)) {
      if (!start.has(mid) || sale.sale_date < start.get(mid)) continue;
      level.set(mid, (level.get(mid) || 0) - q * Number(sale.qty || 0));
    }
  }
  return { level, tracked: start, use };
}

/** المصاريف الثابتة في الشهر */
export function monthlyFixed(expenses, s) {
  const days = Number(s.working_days) || 30;
  const f = { day: days, week: 52 / 12, month: 1, year: 1 / 12 };
  return expenses.reduce((a, e) => a + (Number(e.amount) || 0) * (f[e.period] ?? 1), 0);
}

/** ربح الكوب المتوسط: من مبيعات آخر 30 يوم إن وجدت، وإلا متوسط المنتجات */
export function avgUnitProfit(calc, products, sales) {
  const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  let qty = 0, profit = 0;
  for (const sa of sales) {
    if (sa.sale_date < since) continue;
    const c = calc.product(sa.product_id);
    if (!c || c.noRecipe) continue;
    const net = sa.unit_net != null ? Number(sa.unit_net) : c.net;
    const cost = sa.unit_cost != null ? Number(sa.unit_cost) : c.total;
    qty += Number(sa.qty);
    profit += (net - cost) * Number(sa.qty);
  }
  if (qty > 0) return { value: profit / qty, from: 'sales' };
  const list = products.filter((p) => !p.is_component && (p.kind || 'product') === 'product').map((p) => calc.product(p.id)).filter((c) => c && !c.noRecipe && c.net > 0);
  if (!list.length) return { value: null, from: 'none' };
  return { value: list.reduce((a, c) => a + c.profit, 0) / list.length, from: 'products' };
}

/** نقطة التعادل */
export function breakEven(fixed, unitProfit, s) {
  if (!unitProfit || unitProfit <= 0) return null;
  const perMonth = fixed / unitProfit;
  return { perMonth, perDay: perMonth / (Number(s.working_days) || 30) };
}

/** ملخص المبيعات (يستخدم التكلفة وقت البيع لو موجودة) */
export function salesSummary(sales, calc, from, to) {
  let qty = 0, revenue = 0, net = 0, cost = 0;
  const byProduct = new Map();
  const byDay = new Map();
  for (const sa of sales) {
    if ((from && sa.sale_date < from) || (to && sa.sale_date > to)) continue;
    const c = calc.product(sa.product_id);
    const q = Number(sa.qty) || 0;
    const r = Number(sa.unit_price) * q;
    const n = (sa.unit_net != null ? Number(sa.unit_net) : c?.net ?? Number(sa.unit_price)) * q;
    const k = (sa.unit_cost != null ? Number(sa.unit_cost) : c?.total ?? 0) * q;
    qty += q; revenue += r; net += n; cost += k;
    const bp = byProduct.get(sa.product_id) || { id: sa.product_id, name: sa.product_name || c?.product.name || '؟', size: c?.product.size || '', qty: 0, revenue: 0, profit: 0 };
    bp.qty += q; bp.revenue += r; bp.profit += n - k;
    byProduct.set(sa.product_id, bp);
    const bd = byDay.get(sa.sale_date) || { date: sa.sale_date, qty: 0, revenue: 0, net: 0, cost: 0 };
    bd.qty += q; bd.revenue += r; bd.net += n; bd.cost += k;
    byDay.set(sa.sale_date, bd);
  }
  return { qty, revenue, net, cost, profit: net - cost, byProduct: [...byProduct.values()], byDay };
}
