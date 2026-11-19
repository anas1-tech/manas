// بيانات تجريبية بأسعار تقريبية — عدّلها بأسعارك الحقيقية
const M = (id, name, category, package_name, package_price, units_per_package, unit_size, size_unit, supplier = '') => ({
  id, name, category, package_name, package_price, units_per_package, unit_size, size_unit,
  price_includes_vat: true, supplier, notes: '',
});

export function seedData() {
  const materials = [
    M('m-milk', 'حليب طازج كامل الدسم', 'ألبان', 'كرتون', 66, 12, 1, 'L'),
    M('m-evap', 'حليب مبخر', 'ألبان', 'كرتون', 110, 48, 170, 'ml'),
    M('m-tea', 'شاي أسود فرط', 'شاي وبهارات', 'كيس', 38, 1, 1, 'kg'),
    M('m-sugar', 'سكر', 'شاي وبهارات', 'كيس', 45, 1, 10, 'kg'),
    M('m-card', 'هيل مطحون', 'شاي وبهارات', 'علبة', 95, 1, 500, 'g'),
    M('m-saff', 'زعفران', 'شاي وبهارات', 'علبة', 90, 1, 4, 'g'),
    M('m-qahwa', 'قهوة سعودية شقراء', 'بن', 'كيس', 75, 1, 1, 'kg'),
    M('m-espresso', 'بن إسبريسو', 'بن', 'كيس', 120, 1, 1, 'kg'),
    M('m-water', 'ماء', 'أخرى', 'كرتون', 14, 40, 330, 'ml'),
    M('m-cup8', 'كوب ورقي 8oz', 'تغليف', 'كرتون', 140, 1000, 1, 'pcs'),
    M('m-cup12', 'كوب ورقي 12oz', 'تغليف', 'كرتون', 170, 1000, 1, 'pcs'),
    M('m-cup4', 'كوب ورقي 4oz', 'تغليف', 'كرتون', 75, 1000, 1, 'pcs'),
    M('m-lid', 'غطاء كوب', 'تغليف', 'كرتون', 90, 1000, 1, 'pcs'),
  ];
  const it = (type, id, qty, unit) => ({ type, id, qty, unit });
  const P = (o) => ({
    size: '', category: '', description: '', serving_ml: null, waste_pct: 0,
    sell_price: 0, price_includes_vat: true, on_menu: true, is_component: false,
    yield_qty: 1, yield_unit: 'pcs', sort: 0, ...o,
  });
  const products = [
    P({ id: 'p-karakmix', name: 'خلطة كرك', category: 'خلطات', is_component: true, on_menu: false, yield_qty: 2, yield_unit: 'L', waste_pct: 3,
      items: [it('material', 'm-evap', 400, 'ml'), it('material', 'm-milk', 400, 'ml'), it('material', 'm-water', 1200, 'ml'), it('material', 'm-tea', 40, 'g'), it('material', 'm-sugar', 160, 'g'), it('material', 'm-card', 6, 'g'), it('material', 'm-saff', 0.05, 'g')] }),
    P({ id: 'p-dallah', name: 'دلة قهوة سعودية', category: 'خلطات', is_component: true, on_menu: false, yield_qty: 1, yield_unit: 'L',
      items: [it('material', 'm-qahwa', 40, 'g'), it('material', 'm-card', 10, 'g'), it('material', 'm-saff', 0.05, 'g'), it('material', 'm-water', 1100, 'ml')] }),
    P({ id: 'p-karak-s', name: 'كرك', size: 'صغير', category: 'كرك وشاي', serving_ml: 180, sell_price: 3, sort: 1,
      items: [it('product', 'p-karakmix', 160, 'ml'), it('material', 'm-cup8', 1, 'pcs'), it('material', 'm-lid', 1, 'pcs')] }),
    P({ id: 'p-karak-m', name: 'كرك', size: 'وسط', category: 'كرك وشاي', serving_ml: 300, sell_price: 4, sort: 2,
      items: [it('product', 'p-karakmix', 270, 'ml'), it('material', 'm-cup12', 1, 'pcs'), it('material', 'm-lid', 1, 'pcs')] }),
    P({ id: 'p-tea', name: 'شاي أحمر', size: 'وسط', category: 'كرك وشاي', serving_ml: 240, sell_price: 2, sort: 3,
      items: [it('material', 'm-tea', 3, 'g'), it('material', 'm-sugar', 8, 'g'), it('material', 'm-water', 210, 'ml'), it('material', 'm-cup8', 1, 'pcs'), it('material', 'm-lid', 1, 'pcs')] }),
    P({ id: 'p-milktea', name: 'شاي حليب', size: 'وسط', category: 'كرك وشاي', serving_ml: 240, sell_price: 4, sort: 4,
      items: [it('material', 'm-tea', 3, 'g'), it('material', 'm-milk', 120, 'ml'), it('material', 'm-water', 90, 'ml'), it('material', 'm-sugar', 8, 'g'), it('material', 'm-cup8', 1, 'pcs'), it('material', 'm-lid', 1, 'pcs')] }),
    P({ id: 'p-qahwa', name: 'قهوة سعودية', size: 'وسط', category: 'قهوة سعودية', serving_ml: 240, sell_price: 7, sort: 5,
      items: [it('product', 'p-dallah', 200, 'ml'), it('material', 'm-cup8', 1, 'pcs'), it('material', 'm-lid', 1, 'pcs')] }),
    P({ id: 'p-esp', name: 'إسبريسو', size: 'دبل', category: 'قهوة مختصة', serving_ml: 120, sell_price: 9, sort: 6,
      items: [it('material', 'm-espresso', 18, 'g'), it('material', 'm-water', 60, 'ml'), it('material', 'm-cup4', 1, 'pcs')] }),
    P({ id: 'p-latte', name: 'لاتيه', size: 'وسط', category: 'قهوة مختصة', serving_ml: 350, sell_price: 14, sort: 7,
      items: [it('material', 'm-espresso', 18, 'g'), it('material', 'm-water', 60, 'ml'), it('material', 'm-milk', 250, 'ml'), it('material', 'm-cup12', 1, 'pcs'), it('material', 'm-lid', 1, 'pcs')] }),
  ];
  const now = Date.now();
  const history = materials.flatMap((m) => {
    const rows = [{ id: crypto.randomUUID(), material_id: m.id, package_price: m.package_price, recorded_at: new Date(now).toISOString() }];
    if (m.id === 'm-milk') rows.unshift(
      { id: crypto.randomUUID(), material_id: m.id, package_price: 58, recorded_at: new Date(now - 120 * 864e5).toISOString() },
      { id: crypto.randomUUID(), material_id: m.id, package_price: 62, recorded_at: new Date(now - 60 * 864e5).toISOString() },
    );
    if (m.id === 'm-card') rows.unshift({ id: crypto.randomUUID(), material_id: m.id, package_price: 80, recorded_at: new Date(now - 40 * 864e5).toISOString() });
    return rows;
  });
  return { materials, products, history };
}
