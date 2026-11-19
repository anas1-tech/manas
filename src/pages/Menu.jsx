import { useEffect, useState } from 'react';
import { Maximize, Sun, Moon, ArrowRight, Image as ImageIcon, Languages } from 'lucide-react';
import { db } from '../lib/db.js';
import { navigate } from '../components/ui.jsx';
import Wordmark from '../components/Wordmark.jsx';
import { BRAND_EN } from '../lib/brand.js';
import { money } from '../lib/format.js';

/** شاشة المنيو للزباين — تفتح بدون تسجيل دخول وتتحدث كل دقيقة */
export default function Menu() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const params = new URLSearchParams(location.search);
  const [light, setLight] = useState(params.get('theme') === 'light');
  const [lang, setLang] = useState(params.get('lang') || '');
  const [photos, setPhotos] = useState(params.get('photos') === '1');
  // نحفظ الاختيارات في الرابط عشان شاشة المحل تفتح على نفس الشكل
  useEffect(() => {
    const u = new URLSearchParams();
    if (light) u.set('theme', 'light');
    if (lang) u.set('lang', lang);
    if (photos) u.set('photos', '1');
    history.replaceState(null, '', location.pathname + (u.toString() ? `?${u}` : ''));
  }, [light, lang, photos]);

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
    if (!byName.has(it.name)) byName.set(it.name, { name: it.name, description: it.description, name_en: it.name_en, description_en: it.description_en, image: it.image_url, sizes: new Map() });
    const row = byName.get(it.name);
    if (!row.image && it.image_url) row.image = it.image_url;
    if (!row.name_en && it.name_en) row.name_en = it.name_en;
    row.sizes.set(it.size || '', it.shelf_price);
    if (!sizeRank.has(it.size || '')) sizeRank.set(it.size || '', sizeRank.size);
    if (!row.description && it.description) row.description = it.description;
  }

  const L = lang || data.shop.menu_lang || 'ar';
  const title = (r) => (L === 'en' && r.name_en ? r.name_en : r.name);
  const sub = (r) => (L === 'both' && r.name_en ? r.name_en : L === 'en' ? r.description_en || '' : r.description || '');
  const anyPhotos = data.items.some((i) => i.image_url);

  return (
    <div className={`menu-page${light ? ' light' : ''}${photos ? ' photos' : ''}`} dir={L === 'en' ? 'ltr' : 'rtl'}>
      <div className="menu-tools">
        <button className="btn sm" onClick={() => navigate('/')}><ArrowRight size={16} /> رجوع</button>
        <button className="btn sm" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize size={16} /> ملء الشاشة</button>
        <button className="btn sm" onClick={() => setLight((v) => !v)}>{light ? <Moon size={16} /> : <Sun size={16} />} {light ? 'داكن' : 'فاتح'}</button>
        <button className="btn sm" onClick={() => setLang({ ar: 'both', both: 'en', en: 'ar' }[L])}><Languages size={16} /> {{ ar: 'عربي', both: 'عربي + EN', en: 'English' }[L]}</button>
        {anyPhotos && <button className="btn sm" onClick={() => setPhotos((v) => !v)}><ImageIcon size={16} /> {photos ? 'بدون صور' : 'بالصور'}</button>}
      </div>
      <header className="menu-top">
        <h1 className="menu-logo"><Wordmark title={data.shop.shop_name || 'مأنس'} /></h1>
        {L !== 'ar' && <span className="menu-en">{BRAND_EN}</span>}
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
                          {photos && (r.image ? <img className="menu-img" src={r.image} alt="" loading="lazy" /> : <span className="menu-img" />)}
                          <span className="menu-name-text">
                            <span>{title(r)}{only && !inCols && only[0] && <em className="menu-size">{only[0]}</em>}</span>
                            {sub(r) && <small dir={L === 'both' ? 'ltr' : undefined}>{sub(r)}</small>}
                          </span>
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
        <span>{L === 'en' ? `Prices in SAR${data.shop.vat_registered ? ', VAT included' : ''}` : `الأسعار بالريال${data.shop.vat_registered ? ' وشاملة الضريبة' : ''}`}</span>
      </footer>
    </div>
  );
}

const fmt = (v) => (Number.isInteger(Number(v)) ? String(Number(v)) : money(Number(v)));
