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

  // تجميع: التصنيف ← المنتج ← الأحجام (بنفس ترتيب المنتجات)
  const cats = new Map();
  const sizeRank = new Map();
  for (const it of [...data.items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
    const c = it.category || 'المشروبات';
    if (!cats.has(c)) cats.set(c, new Map());
    const byName = cats.get(c);
    if (!byName.has(it.name)) byName.set(it.name, { name: it.name, description: it.description, sizes: new Map() });
    const row = byName.get(it.name);
    row.sizes.set(it.size || '', it.shelf_price);
    if (!sizeRank.has(it.size || '')) sizeRank.set(it.size || '', sizeRank.size);
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
          {[...cats].map(([cat, rowsMap]) => {
            const rows = [...rowsMap.values()];
            // الأعمدة = أحجام المنتجات اللي لها أكثر من حجم
            const cols = [...new Set(rows.filter((r) => r.sizes.size > 1).flatMap((r) => [...r.sizes.keys()]))]
              .sort((a, b) => sizeRank.get(a) - sizeRank.get(b));
            const n = Math.max(cols.length, 1);
            return (
              <section className={`menu-cat${cols.length > 4 ? ' wide' : ''}`} key={cat}>
                <h2>{cat}</h2>
                <div className="menu-sizes" style={{ '--n': n }}>
                  {cols.length > 0 && <><span />{cols.map((s) => <span className="hd" key={s}>{s || '—'}</span>)}</>}
                  {rows.map((r) => {
                    const only = r.sizes.size === 1 ? [...r.sizes][0] : null;
                    const inCols = only && cols.includes(only[0]);
                    return (
                      <div className="menu-row" key={r.name}>
                        <span className="menu-name">
                          <span>{r.name}{only && !inCols && only[0] && <em className="menu-size">{only[0]}</em>}</span>
                          {r.description && <small>{r.description}</small>}
                        </span>
                        {only && !inCols ? (
                          <>{n > 1 && <span style={{ gridColumn: `span ${n - 1}` }} />}<span className="menu-price">{fmt(only[1])}</span></>
                        ) : cols.length ? cols.map((s) => (
                          <span key={s} className={`menu-price${r.sizes.get(s) == null ? ' none' : ''}`}>{r.sizes.get(s) == null ? '–' : fmt(r.sizes.get(s))}</span>
                        )) : <span className="menu-price">{fmt([...r.sizes.values()][0])}</span>}
                      </div>
                    );
                  })}
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
