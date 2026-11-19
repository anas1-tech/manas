import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS } from './calc.js';
import { seedData } from './seed.js';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isRemote = Boolean(URL && KEY);
export const supabase = isRemote ? createClient(URL, KEY) : null;

const TABLES = ['materials', 'products', 'price_history'];

// أعمدة انضافت في تحديثات لاحقة. لو قاعدة البيانات قديمة نحذفها قبل الحفظ بدل ما يفشل
const NEW_COLS = { materials: ['density'], products: ['serving_unit'] };
export let schemaOutdated = false;
const markOutdated = () => {
  if (schemaOutdated) return;
  schemaOutdated = true;
  window.dispatchEvent(new Event('schema-outdated'));
};

// ───────── Supabase ─────────
const remoteDb = {
  async loadAll() {
    const [s, m, p, h] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('materials').select('*').order('name'),
      supabase.from('products').select('*').order('sort').order('name'),
      supabase.from('price_history').select('*').order('recorded_at'),
    ]);
    for (const r of [s, m, p, h]) if (r.error) throw r.error;
    const probe = await supabase.from('materials').select('density').limit(1);
    const probe2 = await supabase.from('products').select('serving_unit').limit(1);
    if (probe.error || probe2.error) markOutdated();
    return { settings: { ...DEFAULT_SETTINGS, ...(s.data || {}) }, materials: m.data, products: p.data, history: h.data };
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
    if (error) throw error;
  },
  async remove(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
  },
  async saveSettings(s) {
    const { error } = await supabase.from('settings').upsert({ ...clean(s), id: 1 });
    if (error) throw error;
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
    for (const t of [...TABLES, 'settings']) ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, onChange);
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
function readLocal() {
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const seed = { settings: { ...DEFAULT_SETTINGS }, ...seedData() };
  writeLocal(seed);
  return seed;
}
function writeLocal(d) {
  try { localStorage.setItem(LS, JSON.stringify(d)); } catch { /* ignore */ }
}
const key = (t) => (t === 'price_history' ? 'history' : t);
const localDb = {
  async loadAll() { return readLocal(); },
  async upsert(table, rows) {
    const d = readLocal();
    const list = (Array.isArray(rows) ? rows : [rows]).map(clean);
    const arr = d[key(table)];
    for (const r of list) {
      const i = arr.findIndex((x) => x.id === r.id);
      if (i >= 0) arr[i] = { ...arr[i], ...r }; else arr.push(r);
    }
    writeLocal(d);
  },
  async remove(table, id) {
    const d = readLocal();
    d[key(table)] = d[key(table)].filter((x) => x.id !== id);
    if (table === 'materials') d.history = d.history.filter((h) => h.material_id !== id);
    writeLocal(d);
  },
  async saveSettings(s) { const d = readLocal(); d.settings = { ...d.settings, ...s }; writeLocal(d); },
  async loadMenu() {
    const d = readLocal();
    const s = d.settings;
    const f = 1 + (Number(s.vat_rate) || 0) / 100;
    const items = d.products.filter((p) => p.on_menu && !p.is_component).map((p) => ({
      id: p.id, name: p.name, size: p.size, category: p.category, description: p.description, serving_ml: p.serving_ml, sort: p.sort,
      shelf_price: s.vat_registered && !p.price_includes_vat ? +(p.sell_price * f).toFixed(2) : p.sell_price,
    }));
    return { items, shop: { shop_name: s.shop_name, menu_note: s.menu_note, vat_registered: s.vat_registered } };
  },
  subscribe(onChange) {
    const h = (e) => { if (e.key === LS) onChange(); };
    window.addEventListener('storage', h);
    return () => window.removeEventListener('storage', h);
  },
  reset() { localStorage.removeItem(LS); },
};

export const db = isRemote ? remoteDb : localDb;
