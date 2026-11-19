import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { makeCalc, productsUsingMaterial, suggestPrice } from '../lib/calc.js';
import { money, pct, CUR } from '../lib/format.js';
import { Seg, Field, Empty, MarginChip } from '../components/ui.jsx';

export default function Calculator() {
  const initial = new URLSearchParams(location.search).get('tab') === 'whatif' ? 'whatif' : 'order';
  const [tab, setTab] = useState(initial);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>الحاسبة</h1>
          <p>{tab === 'order' ? 'احسب تكلفة وربح طلب كامل أو مبيعات يوم.' : 'شوف وش يصير لأرباحك لو غلى سعر مادة.'}</p>
        </div>
        <Seg value={tab} onChange={setTab} label="نوع الحاسبة" options={[['order', 'حاسبة طلب'], ['whatif', 'لو تغير السعر']]} />
      </div>
      {tab === 'order' ? <OrderCalc /> : <WhatIf />}
    </>
  );
}

function OrderCalc() {
  const { products, calc, settings } = useStore();
  const [counts, setCounts] = useState({});
  const sellable = products.filter((p) => !p.is_component && Number(p.sell_price) > 0);
  const inc = (id, d) => setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + d) }));
  const lines = sellable.filter((p) => counts[p.id]).map((p) => ({ p, n: counts[p.id], c: calc.product(p.id) }));
  const tot = lines.reduce((a, l) => ({
    cost: a.cost + l.c.total * l.n, shelf: a.shelf + l.c.shelf * l.n, net: a.net + l.c.net * l.n, vat: a.vat + l.c.vat * l.n,
  }), { cost: 0, shelf: 0, net: 0, vat: 0 });
  const profit = tot.net - tot.cost;

  if (!sellable.length) return <Empty title="ما فيه منتجات لها سعر">حط سعر بيع للمنتجات وبعدها ارجع هنا.</Empty>;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', alignItems: 'start' }} data-stack>
      <div className="list">
        {sellable.map((p) => {
          const c = calc.product(p.id);
          return (
            <div className="item" key={p.id} style={{ cursor: 'default' }}>
              <span className="item-title">{p.name} {p.size && <span className="size-tag">{p.size}</span>}</span>
              <span className="item-sub"><span className="num">{money(c.shelf)}</span> {CUR} · ربح <span className="num">{money(c.profit)}</span></span>
              <span className="item-end">
                <span className="counter">
                  <button onClick={() => inc(p.id, -1)} aria-label={`نقّص ${p.name}`}>−</button>
                  <span className="num">{counts[p.id] || 0}</span>
                  <button onClick={() => inc(p.id, 1)} aria-label={`زيد ${p.name}`}>+</button>
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="panel receipt">
        <div className="panel-head"><h2>الفاتورة</h2>{lines.length > 0 && <button className="btn sm ghost" onClick={() => setCounts({})}><RotateCcw size={16} /> صفّر</button>}</div>
        {!lines.length ? <p className="muted small">زيد الكميات من القائمة.</p> : (
          <>
            <table className="table">
              <tbody>
                {lines.map((l) => (
                  <tr key={l.p.id}><td>{l.p.name} {l.p.size} <span className="muted num">×{l.n}</span></td><td className="n num">{money(l.c.shelf * l.n)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="receipt-total"><span>المجموع</span><b className="num">{money(tot.shelf)} {CUR}</b></div>
            {settings.vat_registered && <div className="receipt-total"><span className="muted">منها ضريبة</span><span className="num">{money(tot.vat)}</span></div>}
            <div className="receipt-total"><span className="muted">التكلفة</span><span className="num">{money(tot.cost)}</span></div>
            <div className="receipt-total final"><span>صافي الربح</span><b className="num">{money(profit)} {CUR}</b></div>
            <p className="muted small" style={{ margin: 0 }}>هامش <span className="num">{pct(tot.net ? profit / tot.net : null)}</span> من الإيراد{settings.vat_registered ? ' بدون ضريبة' : ''}.</p>
          </>
        )}
      </div>
      <style>{`@media (max-width: 899px){ [data-stack]{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function WhatIf() {
  const { materials, products, settings, calc } = useStore();
  const [matId, setMatId] = useState(materials[0]?.id || '');
  const [change, setChange] = useState(10);
  const m = materials.find((x) => x.id === matId);
  const newPrice = m ? Number(m.package_price) * (1 + change / 100) : 0;
  const sim = useMemo(() => (m ? makeCalc(materials, products, settings, { [m.id]: newPrice }) : null), [m, newPrice, materials, products, settings]);
  const affected = m ? productsUsingMaterial(m.id, products).filter((p) => !p.is_component) : [];

  if (!materials.length) return <Empty title="ما فيه مواد">أضف مواد أول.</Empty>;

  return (
    <div className="grid">
      <div className="panel grid g2">
        <Field label="المادة">
          <select className="select input" value={matId} onChange={(e) => setMatId(e.target.value)}>
            {[...materials].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </Field>
        <Field label={`لو ${change >= 0 ? 'زاد' : 'نقص'} السعر ${Math.abs(change)}%`} hint={m ? `ال${m.package_name || 'عبوة'} يصير ${money(newPrice)} ${CUR} بدل ${money(Number(m.package_price))}` : ''}>
          <input type="range" className="range" min={-50} max={100} step={5} value={change} onChange={(e) => setChange(Number(e.target.value))} aria-label="نسبة التغيير" />
        </Field>
      </div>
      {!affected.length ? <Empty title="ما تأثر شي">هالمادة ما تدخل في أي منتج للبيع.</Empty> : (
        <div className="panel table-wrap">
          <table className="table">
            <thead><tr><th>المنتج</th><th className="n">التكلفة الحين</th><th className="n">التكلفة الجديدة</th><th className="n">الهامش</th><th className="n">سعر مقترح</th></tr></thead>
            <tbody>
              {affected.map((p) => {
                const a = calc.product(p.id), b = sim.product(p.id);
                return (
                  <tr key={p.id}>
                    <td>{p.name} <span className="muted">{p.size}</span></td>
                    <td className="n num">{money(a.total)}</td>
                    <td className="n num">{money(b.total)}</td>
                    <td className="n"><span className="row" style={{ justifyContent: 'flex-end', gap: 4, flexWrap: 'nowrap' }}><span className="num muted">{pct(a.margin)}</span> ← <MarginChip margin={b.margin} status={b.status} /></span></td>
                    <td className="n num">{money(suggestPrice(b.total, settings).rounded)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
