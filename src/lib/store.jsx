import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, isRemote, supabase } from './db.js';
import { DEFAULT_SETTINGS, makeCalc } from './calc.js';
import { seedData } from './seed.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const EMPTY = { settings: DEFAULT_SETTINGS, materials: [], products: [], history: [], expenses: [], sales: [], moves: [], offers: [], staff: [], role: 'admin', email: '' };
const KEY = { materials: 'materials', products: 'products', price_history: 'history', expenses: 'expenses', sales: 'sales', stock_moves: 'moves', supplier_prices: 'offers', staff: 'staff' };

export function StoreProvider({ children, enabled }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const busy = useRef(0);

  const toast = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await db.loadAll();
      setData({ ...EMPTY, ...d });
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    let t;
    // تحديث تلقائي لما يتغير شيء من جهاز ثاني
    const off = db.subscribe(() => {
      if (busy.current) return;
      clearTimeout(t);
      t = setTimeout(reload, 500);
    });
    return () => { off(); clearTimeout(t); };
  }, [enabled, reload]);

  const run = useCallback(async (fn, okText) => {
    busy.current++;
    try {
      await fn();
      if (okText) toast(okText);
      return true;
    } catch (e) {
      toast(`ما انحفظ: ${e.message || e}`, 'err');
      await reload();
      return false;
    } finally {
      setTimeout(() => { busy.current--; }, 900);
    }
  }, [reload, toast]);

  const actions = useMemo(() => {
    const idOf = (table) => (table === 'staff' ? 'email' : 'id');
    const localUpsert = (table, rows) => setData((d) => {
      const k = KEY[table];
      const id = idOf(table);
      const arr = [...d[k]];
      for (const r of rows) {
        const i = arr.findIndex((x) => x[id] === r[id]);
        if (i >= 0) arr[i] = r; else arr.push(r);
      }
      return { ...d, [k]: arr };
    });
    const localRemove = (table, idv) => setData((d) => ({ ...d, [KEY[table]]: d[KEY[table]].filter((x) => x[idOf(table)] !== idv) }));

    const a = {
      async saveRows(table, rows, okText) {
        const list = Array.isArray(rows) ? rows : [rows];
        localUpsert(table, list);
        return run(() => db.upsert(table, list), okText);
      },
      async deleteRow(table, idv, okText) {
        localRemove(table, idv);
        return run(() => db.remove(table, idv, idOf(table)), okText);
      },
      async saveMaterial(m) {
        const prev = data.materials.find((x) => x.id === m.id);
        const hist = !prev || Number(prev.package_price) !== Number(m.package_price)
          ? { id: crypto.randomUUID(), material_id: m.id, package_price: Number(m.package_price), recorded_at: new Date().toISOString() }
          : null;
        localUpsert('materials', [m]);
        if (hist) localUpsert('price_history', [hist]);
        return run(async () => {
          await db.upsert('materials', m);
          if (hist) await db.upsert('price_history', hist);
        }, 'انحفظت المادة');
      },
      async deleteMaterial(id) {
        setData((d) => ({ ...d, materials: d.materials.filter((x) => x.id !== id), history: d.history.filter((h) => h.material_id !== id), moves: d.moves.filter((h) => h.material_id !== id), offers: d.offers.filter((h) => h.material_id !== id) }));
        return run(() => db.remove('materials', id), 'انحذفت المادة');
      },
      saveProduct: (p) => a.saveRows('products', [p], 'انحفظ المنتج'),
      deleteProduct: (id) => a.deleteRow('products', id, 'انحذف المنتج'),
      async saveSettings(s) {
        setData((d) => ({ ...d, settings: { ...d.settings, ...s } }));
        return run(() => db.saveSettings({ ...data.settings, ...s }), 'انحفظت الإعدادات');
      },
      /** استيراد دفعة وحدة (من Excel أو نسخة احتياطية) */
      async importBatch({ materials = [], products = [], history = [] }, okText = 'تم الاستيراد') {
        await run(async () => {
          await db.upsert('materials', materials);
          await db.upsert('price_history', history);
          await db.upsert('products', products);
        }, okText);
        await reload();
      },
      async loadSample() {
        await a.importBatch(seedData(), 'انضافت البيانات التجريبية');
      },
      uploadImage: (file) => db.uploadImage(file),
    };
    return a;
  }, [data, run, reload]);

  const calc = useMemo(() => makeCalc(data.materials, data.products, data.settings), [data.materials, data.products, data.settings]);
  const isAdmin = data.role === 'admin';

  const value = { ...data, calc, isAdmin, loading, error, reload, toast, toasts, ...actions };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ───────── تسجيل الدخول ─────────
export function useAuth() {
  const [session, setSession] = useState(isRemote ? undefined : { local: true });
  useEffect(() => {
    if (!isRemote) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return session;
}
