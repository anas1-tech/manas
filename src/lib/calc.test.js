import test from 'node:test';
import assert from 'node:assert/strict';
import { makeCalc, costPerBase, suggestPrice, DEFAULT_SETTINGS } from './calc.js';

const S = { ...DEFAULT_SETTINGS };
const milk = { id: 'm1', name: 'حليب', package_price: 66, units_per_package: 12, unit_size: 1, size_unit: 'L', price_includes_vat: true };
const cup = { id: 'c1', name: 'كوب', package_price: 140, units_per_package: 1000, unit_size: 1, size_unit: 'pcs', price_includes_vat: true };

test('كرتون 12 لتر بـ 66 → المل 0.0055', () => {
  assert.equal(costPerBase(milk, S).toFixed(4), '0.0055');
});

test('المسجل بالضريبة: التكلفة بدون ضريبة', () => {
  const s = { ...S, vat_registered: true };
  assert.equal((costPerBase(milk, s) * 1000).toFixed(3), (5.5 / 1.15).toFixed(3));
});

test('غير مسجل وسعر بدون ضريبة → تنضاف الضريبة للتكلفة', () => {
  assert.equal((costPerBase({ ...milk, price_includes_vat: false }, S) * 1000).toFixed(3), (5.5 * 1.15).toFixed(3));
});

test('تكلفة كوب مع الدمج والهدر', () => {
  const mix = { id: 'p1', name: 'خلطة', is_component: true, yield_qty: 1, yield_unit: 'L', items: [{ type: 'material', id: 'm1', qty: 1, unit: 'L' }] };
  const karak = { id: 'p2', name: 'كرك', sell_price: 4, waste_pct: 10, items: [{ type: 'product', id: 'p1', qty: 200, unit: 'ml' }, { type: 'material', id: 'c1', qty: 1, unit: 'pcs' }] };
  const c = makeCalc([milk, cup], [mix, karak], S).product('p2');
  // 200 مل × 0.0055 = 1.1 + كوب 0.14 = 1.24 + 10% = 1.364
  assert.equal(c.total.toFixed(3), '1.364');
  assert.equal(c.liquidMl, 200);
  assert.ok(c.margin > 0.65);
});

test('الدمج الدائري ما يعلّق', () => {
  const a = { id: 'a', name: 'a', items: [{ type: 'product', id: 'b', qty: 1, unit: 'pcs' }] };
  const b = { id: 'b', name: 'b', items: [{ type: 'product', id: 'a', qty: 1, unit: 'pcs' }] };
  const c = makeCalc([], [a, b], S).product('a');
  assert.equal(c.total, 0);
});

test('السعر المقترح', () => {
  assert.equal(suggestPrice(1.4, S, 65).rounded, 4);
  assert.equal(suggestPrice(1.5, S, 65).rounded, 4.5);
});

test('وحدات جديدة: أونصة وجالون وملعقة', async () => {
  const { toBase } = await import('./units.js');
  assert.equal(toBase(8, 'oz').toFixed(1), '236.6');
  assert.equal(toBase(1, 'gal').toFixed(0), '3785');
  assert.equal(toBase(2, 'tbsp'), 30);
  assert.equal(toBase(1, 'lb').toFixed(1), '453.6');
  assert.equal(toBase(1, 'dozen'), 12);
});

test('الكثافة: سكر بالكيلو وتقيسه بالملعقة', () => {
  const sugar = { id: 's', name: 'سكر', package_price: 10, units_per_package: 1, unit_size: 1, size_unit: 'kg', price_includes_vat: true, density: 0.85 };
  const tea = { id: 't', name: 'شاي', sell_price: 2, items: [{ type: 'material', id: 's', qty: 2, unit: 'tsp' }] };
  const c = makeCalc([sugar], [tea], S).product('t');
  // 2 ملعقة صغيرة = 10 مل × 0.85 = 8.5 جم × 0.01 = 0.085
  assert.equal(c.total.toFixed(3), '0.085');
  assert.equal(c.issues.length, 0);
});

test('بدون كثافة: تنبيه بدل حساب غلط', () => {
  const sugar = { id: 's', name: 'سكر', package_price: 10, units_per_package: 1, unit_size: 1, size_unit: 'kg' };
  const tea = { id: 't', name: 'شاي', items: [{ type: 'material', id: 's', qty: 2, unit: 'tsp' }] };
  const c = makeCalc([sugar], [tea], S).product('t');
  assert.equal(c.total, 0);
  assert.equal(c.issues.length, 1);
});

test('كم كوب يطلع من الكرتون (مع الخلطة)', async () => {
  const { materialUsage, packageBaseQty } = await import('./calc.js');
  const mix = { id: 'mix', is_component: true, yield_qty: 2, yield_unit: 'L', items: [{ type: 'material', id: 'm1', qty: 1, unit: 'L' }] };
  const karak = { id: 'k', items: [{ type: 'product', id: 'mix', qty: 200, unit: 'ml' }] };
  const use = materialUsage('m1', 'k', [milk], [mix, karak]);
  assert.equal(use, 100); // 200 مل خلطة = 100 مل حليب
  assert.equal(packageBaseQty(milk) / use, 120); // 12 لتر ÷ 100 مل
});

test('المخزون: الاستلام ناقص المبيعات من بعد أول جرد', async () => {
  const { stockLevels } = await import('./calc.js');
  const karak = { id: 'k', items: [{ type: 'material', id: 'm1', qty: 200, unit: 'ml' }] };
  const moves = [{ material_id: 'm1', qty_base: 12000, created_at: '2026-11-10T08:00:00Z' }];
  const sales = [
    { product_id: 'k', qty: 5, sale_date: '2026-11-09' }, // قبل الجرد: ما تنحسب
    { product_id: 'k', qty: 10, sale_date: '2026-11-12' },
  ];
  const { level } = stockLevels([milk], [karak], moves, sales);
  assert.equal(level.get('m1'), 12000 - 2000);
});

test('نقطة التعادل والمصاريف', async () => {
  const { monthlyFixed, breakEven } = await import('./calc.js');
  const s = { ...S, working_days: 30 };
  const fixed = monthlyFixed([{ amount: 3000, period: 'month' }, { amount: 12000, period: 'year' }, { amount: 50, period: 'day' }], s);
  assert.equal(fixed, 3000 + 1000 + 1500);
  assert.equal(Math.round(breakEven(fixed, 2, s).perDay), 92); // 5500 ÷ 2 ÷ 30
});

test('العرض: مجموع أسعار المنتجات منفردة', () => {
  const a = { id: 'a', sell_price: 5, items: [] };
  const b = { id: 'b', sell_price: 7, items: [] };
  const combo = { id: 'c', kind: 'combo', sell_price: 10, items: [{ type: 'product', id: 'a', qty: 1, unit: 'pcs' }, { type: 'product', id: 'b', qty: 1, unit: 'pcs' }] };
  assert.equal(makeCalc([], [a, b, combo], S).product('c').itemsShelf, 12);
});

test('توزيع المصاريف: بالتساوي على كل حبة', async () => {
  const { overheadInfo, fullCost } = await import('./calc.js');
  const karak = { id: 'k', sell_price: 4, items: [{ type: 'material', id: 'm1', qty: 200, unit: 'ml' }] };
  const calc = makeCalc([milk], [karak], S);
  const s = { ...S, overhead_mode: 'unit', expected_units: 3000 };
  const oh = overheadInfo([{ amount: 4500, period: 'month' }], s, [], calc);
  assert.equal(oh.perUnit, 1.5); // 4500 ÷ 3000
  const f = fullCost(calc.product('k'), oh);
  assert.equal(f.share, 1.5);
  assert.equal(f.total.toFixed(2), (1.1 + 1.5).toFixed(2));
  assert.equal(f.netProfit.toFixed(2), (4 - 2.6).toFixed(2));
});

test('توزيع المصاريف: حسب السعر ومن المبيعات', async () => {
  const { overheadInfo, fullCost } = await import('./calc.js');
  const karak = { id: 'k', sell_price: 4, items: [{ type: 'material', id: 'm1', qty: 200, unit: 'ml' }] };
  const calc = makeCalc([milk], [karak], S);
  const d = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
  const sales = Array.from({ length: 30 }, (_, i) => ({ product_id: 'k', qty: 50, sale_date: d(i), unit_net: 4 }));
  const oh = overheadInfo([{ amount: 1200, period: 'month' }], { ...S, overhead_mode: 'price' }, sales, calc);
  assert.equal(oh.source, 'sales');
  assert.equal(Math.round(oh.units), 1500);
  assert.equal(oh.rate.toFixed(2), '0.20'); // 1200 ÷ (1500 × 4)
  assert.equal(fullCost(calc.product('k'), oh).share.toFixed(2), '0.80');
});
