import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS } from './calc.js';
import { seedData } from './seed.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isRemote = Boolean(URL && KEY);
export const supabase = isRemote ? createClient(URL, KEY) : null;

// اسم الجدول ← المفتاح في حالة التطبيق
export const TABLE_KEY = {
  materials: 'materials', products: 'products', price_history: 'history', expenses: 'expenses',
  sales: 'sales', stock_moves: 'moves', supplier_prices: 'offers', staff: 'staff',
};
const NEW_TABLES = ['expenses', 'sales', 'stock_moves', 'supplier_prices', 'staff'];

// أعمدة انضافت في تحديثات لاحقة. لو قاعدة البيانات قديمة نحذفها قبل الحفظ بدل ما يفشل
const NEW_COLS = {
  materials: ['density', 'min_stock'],
  products: ['serving_unit', 'kind', 'name_en', 'description_en', 'image_url'],
  settings: ['working_days', 'menu_lang', 'overhead_mode', 'expected_units'],
};
export let schemaOutdated = false;
const markOutdated = () => {
  if (schemaOutdated) return;
  schemaOutdated = true;
  window.dispatchEvent(new Event('schema-outdated'));
};

/** يجيب كل الصفوف (Supabase يرجع 1000 بالحد الأقصى في الطلب الواحد) */
async function fetchAll(table, build = (q) => q) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(supabase.from(table).select('*')).range(from, from + 999);
    if (error) return { error, data: out };
    out.push(...data);
    if (data.length < 1000) return { data: out };
  }
}

// ───────── Supabase ─────────
const remoteDb = {
  async loadAll() {
    const since = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
    const [s, m, p, h, e, sa, mv, of, st] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      fetchAll('materials', (q) => q.order('name')),
      fetchAll('products', (q) => q.order('sort').order('name')),
      fetchAll('price_history', (q) => q.order('recorded_at')),
      fetchAll('expenses', (q) => q.order('name')),
      fetchAll('sales', (q) => q.gte('sale_date', since).order('sale_date')),
      fetchAll('stock_moves', (q) => q.order('created_at')),
      fetchAll('supplier_prices', (q) => q.order('supplier')),
      fetchAll('staff', (q) => q.order('email')),
    ]);
    for (const r of [s, m, p, h]) if (r.error) throw r.error;
    if ([e, sa, mv, of, st].some((r) => r.error)) markOutdated();
    const probe = await supabase.from('products').select('kind,serving_unit').limit(1);
    const probe2 = await supabase.from('settings').select('overhead_mode,expected_units').limit(1);
    if (probe.error || probe2.error) markOutdated();
    const email = (await supabase.auth.getUser()).data.user?.email?.toLowerCase();
    const me = (st.data || []).find((x) => x.email.toLowerCase() === email);
    // قبل التحديث: أي حساب يعتبر مدير (مثل ما كان)
    const role = st.error ? 'admin' : me?.role || 'staff';
    return {
      settings: { ...DEFAULT_SETTINGS, ...(s.data || {}) }, materials: m.data, products: p.data, history: h.data,
      expenses: e.data || [], sales: sa.data || [], moves: mv.data || [], offers: of.data || [], staff: st.data || [],
      role, email,
    };
  },
  async upsert(table, rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (!list.length) return;
    let rows2 = list.map(clean);
    if (schemaOutdated && NEW_COLS[table]) rows2 = rows2.map((r) => strip(r, NEW_COLS[table]));
    let { error } = await supabase.from(table).upsert(rows2);
    if (error && NEW_COLS[table] && /column/i.test(error.message)) {
      markOutdated();
      ({ error } = await supabase.from(table).upsert(rows2.map((r) => strip(r, NEW_COLS[table]))));
    }
    if (error && NEW_TABLES.includes(table) && /relation|schema cache|does not exist/i.test(error.message)) {
      markOutdated();
      throw new Error('هالميزة تحتاج تحديث قاعدة البيانات (شوف التنبيه فوق)');
    }
    if (error) throw error;
  },
  async remove(table, id, key = 'id') {
    const { error } = await supabase.from(table).delete().eq(key, id);
    if (error) throw error;
  },
  async saveSettings(s) {
    let row = { ...clean(s), id: 1 };
    if (schemaOutdated) row = strip(row, NEW_COLS.settings);
    const { error } = await supabase.from('settings').upsert(row);
    if (error) throw error;
  },
  async uploadImage(file) {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('menu').upload(path, file, { cacheControl: '31536000', contentType: file.type });
    if (error) throw error;
    return supabase.storage.from('menu').getPublicUrl(path).data.publicUrl;
  },
  async loadMenu() {
    const [menu, shop] = await Promise.all([
      supabase.from('public_menu').select('*'),
      supabase.from('public_shop').select('*').maybeSingle(),
    ]);
    if (menu.error) throw menu.error;
    return { items: menu.data, shop: shop.data || {} };
  },
  subscribe(onChange) {
    const ch = supabase.channel('all-changes');
    for (const t of [...Object.keys(TABLE_KEY), 'settings']) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, onChange);
    ch.subscribe();
    return () => supabase.removeChannel(ch);
  },
};

function strip(row, cols) {
  const o = { ...row };
  for (const c of cols) delete o[c];
  return o;
}

function clean(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) if (!k.startsWith('_')) out[k] = v;
  out.updated_at = new Date().toISOString();
  return out;
}

// ───────── تخزين محلي (وضع التجربة بدون Supabase) ─────────
const LS = 'mans-cost-v1';
const EMPTY = { expenses: [], sales: [], moves: [], offers: [], staff: [] };
function readLocal() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  const seed = { settings: { ...DEFAULT_SETTINGS }, ...EMPTY, ...seedData() };
  writeLocal(seed);
  return seed;
}
function writeLocal(d) {
  try { localStorage.setItem(LS, JSON.stringify(d)); } catch { /* ignore */ }
}
const localDb = {
  async loadAll() { return { ...readLocal(), role: 'admin', email: 'demo' }; },
  async upsert(table, rows) {
    const d = readLocal();
    const list = (Array.isArray(rows) ? rows : [rows]).map(clean);
    const k = TABLE_KEY[table];
    const idKey = table === 'staff' ? 'email' : 'id';
    d[k] = d[k] || [];
    for (const r of list) {
      const i = d[k].findIndex((x) => x[idKey] === r[idKey]);
      if (i >= 0) d[k][i] = { ...d[k][i], ...r }; else d[k].push(r);
    }
    writeLocal(d);
  },
  async remove(table, id, key = 'id') {
    const d = readLocal();
    const k = TABLE_KEY[table];
    d[k] = (d[k] || []).filter((x) => x[key] !== id);
    if (table === 'materials') {
      d.history = d.history.filter((h) => h.material_id !== id);
      d.moves = d.moves.filter((h) => h.material_id !== id);
      d.offers = d.offers.filter((h) => h.material_id !== id);
    }
    writeLocal(d);
  },
  async saveSettings(s) { const d = readLocal(); d.settings = { ...d.settings, ...s }; writeLocal(d); },
  async uploadImage(file) {
    // في الوضع التجريبي نحفظ الصورة مصغرة داخل المتصفح
    return await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  },
  async loadMenu() {
    const d = readLocal();
    const s = d.settings;
    const f = 1 + (Number(s.vat_rate) || 0) / 100;
    const items = d.products.filter((p) => p.on_menu && !p.is_component && Number(p.sell_price) > 0).map((p) => ({
      id: p.id, name: p.name, size: p.size, category: p.category, description: p.description, serving_ml: p.serving_ml, sort: p.sort,
      kind: p.kind || 'product', name_en: p.name_en, description_en: p.description_en, image_url: p.image_url,
      shelf_price: s.vat_registered && !p.price_includes_vat ? +(p.sell_price * f).toFixed(2) : p.sell_price,
    }));
    return { items, shop: { shop_name: s.shop_name, menu_note: s.menu_note, vat_registered: s.vat_registered, menu_lang: s.menu_lang } };
  },
  subscribe(onChange) {
    const h = (e) => { if (e.key === LS) onChange(); };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  },
};

export const db = isRemote ? remoteDb : localDb;
