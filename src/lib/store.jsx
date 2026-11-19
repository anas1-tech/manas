import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { db, isRemote, supabase } from './db.js';
import { DEFAULT_SETTINGS, makeCalc } from './calc.js';
import { seedData } from './seed.js';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children, enabled }) {
  const [data, setData] = useState({ settings: DEFAULT_SETTINGS, materials: [], products: [], history: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const busy = useRef(0);

  const toast = useCallback((text, kind = 'ok') => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const reload = useCallback(async () => {
    try {
      const d = await db.loadAll();
      setData(d);
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
      t = setTimeout(reload, 400);
    });
    return () => { off(); clearTimeout(t); };
  }, [enabled, reload]);

  const run = useCallback(async (fn, okText) => {
    busy.current++;
    try {
      await fn();
      if (okText) toast(okText);
    } catch (e) {
      toast(`ما انحفظ: ${e.message || e}`, 'err');
      await reload();
    } finally {
      setTimeout(() => { busy.current--; }, 800);
    }
  }, [reload, toast]);

  const actions = useMemo(() => ({
    async saveMaterial(m) {
      const prev = data.materials.find((x) => x.id === m.id);
      const hist = !prev || Number(prev.package_price) !== Number(m.package_price)
        ? { id: crypto.randomUUID(), material_id: m.id, package_price: Number(m.package_price), recorded_at: new Date().toISOString() }
        : null;
      setData((d) => ({
        ...d,
        materials: prev ? d.materials.map((x) => (x.id === m.id ? m : x)) : [...d.materials, m],
        history: hist ? [...d.history, hist] : d.history,
      }));
      await run(async () => {
        await db.upsert('materials', m);
        if (hist) await db.upsert('price_history', hist);
      }, 'انحفظت المادة');
    },
    async deleteMaterial(id) {
      setData((d) => ({ ...d, materials: d.materials.filter((x) => x.id !== id), history: d.history.filter((h) => h.material_id !== id) }));
      await run(() => db.remove('materials', id), 'انحذفت المادة');
    },
    async saveProduct(p) {
      setData((d) => ({
        ...d,
        products: d.products.some((x) => x.id === p.id) ? d.products.map((x) => (x.id === p.id ? p : x)) : [...d.products, p],
      }));
      await run(() => db.upsert('products', p), 'انحفظ المنتج');
    },
    async deleteProduct(id) {
      setData((d) => ({ ...d, products: d.products.filter((x) => x.id !== id) }));
      await run(() => db.remove('products', id), 'انحذف المنتج');
    },
    async saveSettings(s) {
      setData((d) => ({ ...d, settings: { ...d.settings, ...s } }));
      await run(() => db.saveSettings({ ...data.settings, ...s }), 'انحفظت الإعدادات');
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
      await actions.importBatch(seedData(), 'انضافت البيانات التجريبية');
    },
  }), [data, run, reload]);

  const calc = useMemo(() => makeCalc(data.materials, data.products, data.settings), [data]);

  const value = { ...data, calc, loading, error, reload, toast, toasts, ...actions };
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
