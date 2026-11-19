import { useEffect, useState } from 'react';
import { Maximize, Sun, Moon, ArrowRight } from 'lucide-react';
import { db } from '../lib/db.js';
import { Logo, navigate } from '../components/ui.jsx';
import { money } from '../lib/format.js';

/** شاشة المنيو للزباين — تفتح بدون تسجيل دخول وتتحدث كل دقيقة */
export default function Menu() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [light, setLight] = useState(() => new URLSearchParams(location.search).get('theme') === 'light');

  useEffect(() => {
    let alive = true;
    const load = () => db.loadMenu().then((d) => alive && (setData(d), setErr(null))).catch((e) => alive && setErr(e.message));
    load();
    const t = setInterval(load, 60_000);
    document.title = 'المنيو';
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (err && !data) return <div className="menu-page"><p>ما قدرنا نحمّل المنيو. تأكد من الإنترنت.</p></div>;
  if (!data) return <div className="menu-page" aria-busy="true" />;

  // تجميع: التصنيف ← المنتج ← الأحجام
  const cats = new Map();
  for (const it of [...data.items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
    const c = it.category || 'المشروبات';
    if (!cats.has(c)) cats.set(c, new Map());
    const byName = cats.get(c);
    if (!byName.has(it.name)) byName.set(it.name, { name: it.name, description: it.description, sizes: {} });
    const row = byName.get(it.name);
    row.sizes[it.size || ''] = it.shelf_price;
    if (!row.description && it.description) row.description = it.description;
  }

  return (
    <div className={`menu-page${light ? ' light' : ''}`}>
      <div className="menu-tools">
        <button className="btn sm" onClick={() => navigate('/')}><ArrowRight size={16} /> رجوع</button>
        <button className="btn sm" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize size={16} /> ملء الشاشة</button>
        <button className="btn sm" onClick={() => setLight((v) => !v)}>{light ? <Moon size={16} /> : <Sun size={16} />} {light ? 'داكن' : 'فاتح'}</button>
      </div>
      <header className="menu-top">
        <h1>{data.shop.shop_name || 'المنيو'}</h1>
        <Logo />
      </header>
      {!data.items.length ? <p>المنيو فاضي. فعّل «يظهر في المنيو» للمنتجات.</p> : (
        <div className="menu-cols">
          {[...cats].map(([cat, rows]) => {
            const sizes = [...new Set([...rows.values()].flatMap((r) => Object.keys(r.sizes)))];
            const order = ['صغير', 'وسط', 'كبير'];
            sizes.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
            return (
              <section className="menu-cat" key={cat}>
                <h2>{cat}</h2>
                <div className="menu-sizes" style={{ '--n': sizes.length }}>
                  {(sizes.length > 1 || sizes[0]) && <><span />{sizes.map((s) => <span className="hd" key={s}>{s || '—'}</span>)}</>}
                  {[...rows.values()].map((r) => (
                    <div className="menu-row" key={r.name}>
                      <span className="menu-name"><span>{r.name}</span>{r.description && <small>{r.description}</small>}</span>
                      {sizes.map((s) => (
                        <span key={s} className={`menu-price${r.sizes[s] == null ? ' none' : ''}`}>
                          {r.sizes[s] == null ? '–' : <>{fmt(r.sizes[s])}</>}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <footer className="menu-foot">
        <span>{data.shop.menu_note}</span>
        <span>الأسعار بالريال{data.shop.vat_registered ? ' وشاملة الضريبة' : ''}</span>
      </footer>
    </div>
  );
}

const fmt = (v) => (Number.isInteger(Number(v)) ? String(Number(v)) : money(Number(v)));
