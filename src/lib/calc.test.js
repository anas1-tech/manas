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
