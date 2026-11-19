import { useMemo, useState } from 'react';
import { CircleCheck, CircleAlert, OctagonAlert, Tv } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { money, pct, CUR, date } from '../lib/format.js';
import { Empty, Delta, Link, navigate } from '../components/ui.jsx';

const ICON = { good: CircleCheck, warn: CircleAlert, bad: OctagonAlert };

export default function Dashboard() {
  const { products, materials, history, settings, calc, loadSample } = useStore();
  const [sort, setSort] = useState('margin');

  const sellable = useMemo(() => products.filter((p) => !p.is_component).map((p) => calc.product(p.id)).filter(Boolean), [products, calc]);
  const priced = sellable.filter((c) => c.margin != null);
  const avg = priced.length ? priced.reduce((a, c) => a + c.margin, 0) / priced.length : null;
  const needs = priced.filter((c) => c.status !== 'good');
  const noRecipe = sellable.filter((c) => c.noRecipe);
  const best = [...priced].sort((a, b) => b.profit - a.profit)[0];
  const cheapest = [...priced].sort((a, b) => a.total - b.total)[0];

  const changes = useMemo(() => {
    const byMat = new Map();
    for (const h of history) {
      if (!byMat.has(h.material_id)) byMat.set(h.material_id, []);
      byMat.get(h.material_id).push(h);
    }
    const out = [];
    for (const [id, hs] of byMat) {
      if (hs.length < 2) continue;
      const m = materials.find((x) => x.id === id);
      if (!m) continue;
      const last = hs.at(-1), prev = hs.at(-2);
      if (Number(last.package_price) !== Number(prev.package_price)) out.push({ m, from: Number(prev.package_price), to: Number(last.package_price), at: last.recorded_at });
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  }, [history, materials]);

  if (!products.length && !materials.length) {
    return (
      <>
        <div className="page-head"><div><h1>أهلاً في {settings.shop_name}</h1><p>نحسب لك تكلفة كل كوب وربحه.</p></div></div>
        <Empty title="ابدأ من هنا" action={
          <div className="row" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => navigate('/materials')}>أضف المواد</button>
            <button className="btn" onClick={() => navigate('/settings')}>استيراد من Excel</button>
            <button className="btn" onClick={loadSample}>جرّب ببيانات تجريبية</button>
          </div>
        }>
          الخطوة الأولى: أضف اللي تشتريه (حليب، شاي، أكواب). الثانية: سوّ المنتجات من هالمواد. والموقع يحسب الباقي.
        </Empty>
      </>
    );
  }

  const bars = [...sellable].filter((c) => !c.noRecipe).sort((a, b) =>
    sort === 'margin' ? (b.margin ?? -1) - (a.margin ?? -1) : sort === 'profit' ? b.profit - a.profit : a.product.name.localeCompare(b.product.name, 'ar'));
  const maxM = Math.max(1, ...sellable.map((c) => c.margin ?? 0)) ;
  const target = (Number(settings.target_margin) || 0) / 100;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{settings.shop_name}</h1>
          <p>{new Date().toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <Link to="/menu" className="btn" target="_blank"><Tv /> شاشة المنيو</Link>
      </div>

      <div className="hero">
        <div className="hero-main">
          <h2>متوسط هامش الربح</h2>
          <div className="big num">{avg == null ? '—' : pct(avg)}</div>
          <p>{needs.length === 0
            ? `كل المنتجات فوق هدفك ${settings.target_margin}%. ممتاز.`
            : `${needs.length} من ${priced.length} منتج تحت هدفك ${settings.target_margin}%. شيّك عليها تحت.`}
            {noRecipe.length > 0 && ` و${noRecipe.length} منتج بدون وصفة، أضف مكوناتها عشان ينحسب ربحها.`}</p>
          <svg className="pod" viewBox="0 0 100 160" aria-hidden="true"><path d="M50 4C22 30 10 70 18 110c6 30 26 46 32 46s26-16 32-46C90 70 78 30 50 4Z" fill="currentColor" /></svg>
        </div>
        <div className="stats">
          <div className="stat"><span>أكثر ربح في الكوب</span><b className="num">{best ? money(best.profit) : '—'}</b><small>{best ? `${best.product.name} ${best.product.size || ''}` : ''}</small></div>
          <div className="stat"><span>أرخص تكلفة كوب</span><b className="num">{cheapest ? money(cheapest.total) : '—'}</b><small>{cheapest ? `${cheapest.product.name} ${cheapest.product.size || ''}` : ''}</small></div>
          <div className="stat"><span>المنتجات</span><b className="num">{sellable.length}</b><small>{products.length - sellable.length} خلطة مدموجة</small></div>
          <div className="stat"><span>المواد</span><b className="num">{materials.length}</b><small>{changes.length ? `${changes.length} تغير سعرها` : 'الأسعار ثابتة'}</small></div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)' }} data-stack>
        <section className="panel">
          <div className="panel-head">
            <h2>ربح كل منتج</h2>
            <div className="seg" role="group" aria-label="ترتيب">
              {[['margin', 'بالهامش'], ['profit', 'بالريال'], ['name', 'بالاسم']].map(([k, l]) => <button key={k} aria-pressed={sort === k} onClick={() => setSort(k)}>{l}</button>)}
            </div>
          </div>
          {!bars.length && <p className="muted small">أضف مكونات المنتجات عشان يطلع ربح كل واحد هنا.</p>}
          <div className="mbars">
            {bars.map((c) => {
              const I = ICON[c.status];
              const w = Math.max(c.margin ?? 0, 0) / maxM;
              return (
                <button key={c.id} className="mbar" onClick={() => navigate('/products')} title={`تكلفة ${money(c.total)} · بيع ${money(c.shelf)} · ربح ${money(c.profit)} ${CUR}`}>
                  <span className="mbar-name">{c.product.name} <span className="muted">{c.product.size}</span></span>
                  <span className="mbar-track">
                    <span className={`mbar-fill ${c.status}`} style={{ width: `${w * 100}%` }} />
                    <span className="mbar-target" style={{ insetInlineStart: `${(target / maxM) * 100}%` }} />
                  </span>
                  <span className="mbar-val">{I && <I aria-hidden="true" style={{ color: `var(--${c.status})` }} />}<span className="num">{sort === 'profit' ? money(c.profit) : pct(c.margin)}</span></span>
                </button>
              );
            })}
          </div>
          <div className="legend">
            <span><i style={{ background: 'var(--good)' }} />فوق الهدف</span>
            <span><i style={{ background: 'var(--warn)' }} />قريب من الهدف</span>
            <span><i style={{ background: 'var(--bad)' }} />ربح ضعيف</span>
            <span><i style={{ background: 'none', borderInlineStart: '1.5px dashed var(--ink-3)', borderRadius: 0 }} />هدفك {settings.target_margin}%</span>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h2>آخر تغيير بالأسعار</h2></div>
          {changes.length === 0 ? <p className="muted small">لما تعدّل سعر مادة، يطلع هنا كم زاد أو نقص.</p> : (
            <div className="changes">
              {changes.map((ch) => (
                <button key={ch.m.id} className="change" style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'start', cursor: 'pointer', width: '100%' }} onClick={() => navigate('/materials')}>
                  <span style={{ fontWeight: 500 }}>{ch.m.name}</span>
                  <Delta from={ch.from} to={ch.to} />
                  <span className="muted small"><span className="num">{money(ch.from)}</span> ← <span className="num">{money(ch.to)}</span> {CUR}</span>
                  <span className="muted small">{date(ch.at)}</span>
                </button>
              ))}
            </div>
          )}
          {needs.length > 0 && (
            <>
              <h3 style={{ margin: '18px 0 8px' }}>يحتاج مراجعة</h3>
              <div className="chips">{needs.slice(0, 8).map((c) => <span key={c.id} className={`chip ${c.status}`}>{c.product.name} {c.product.size} <span className="num">{pct(c.margin)}</span></span>)}</div>
              <Link to="/calculator?tab=whatif" className="btn sm" style={{ marginTop: 12 }}>جرّب لو تغيّر سعر مادة</Link>
            </>
          )}
        </section>
      </div>
      <style>{`@media (max-width: 899px){ [data-stack]{ grid-template-columns: 1fr !important; } }`}</style>
    </>
  );
}
