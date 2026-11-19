import { useMemo, useState } from 'react';
import { Search, Trash2, Check, RotateCcw } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { salesSummary, monthlyFixed, avgUnitProfit, breakEven } from '../lib/calc.js';
import { money, num, pct, CUR, date } from '../lib/format.js';
import { Seg, Empty, useConfirm } from '../components/ui.jsx';
import { DailyBars } from '../components/charts.jsx';

export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 864e5 - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

export default function Sales() {
  const { isAdmin } = useStore();
  const [tab, setTab] = useState('log');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>المبيعات</h1>
          <p>{tab === 'log' ? 'سجّل اللي انباع، والموقع يحسب الربح وينقّص المخزون.' : 'ربحك الفعلي بالأيام والأشهر.'}</p>
        </div>
        {isAdmin && <Seg value={tab} onChange={setTab} label="المبيعات" options={[['log', 'تسجيل'], ['report', 'التقارير']]} />}
      </div>
      {tab === 'log' || !isAdmin ? <LogSales /> : <Report />}
    </>
  );
}

/** نفس شاشة العد، وتنحفظ كمبيعات */
export function useRecordSales() {
  const { calc, saveRows, isAdmin } = useStore();
  return async (counts, day) => {
    const rows = Object.entries(counts).filter(([, n]) => n > 0).map(([pid, n]) => {
      const c = calc.product(pid);
      return {
        id: crypto.randomUUID(), sale_date: day, product_id: pid,
        product_name: `${c.product.name}${c.product.size ? ' ' + c.product.size : ''}`,
        qty: n, unit_price: +c.shelf.toFixed(2), unit_net: +c.net.toFixed(4),
        unit_cost: isAdmin && !c.noRecipe ? +c.total.toFixed(4) : null,
        created_at: new Date().toISOString(),
      };
    });
    if (!rows.length) return false;
    return saveRows('sales', rows, `انسجل ${num(rows.reduce((a, r) => a + r.qty, 0), 0)} حبة`);
  };
}

function LogSales() {
  const { products, calc, sales, deleteRow, isAdmin, email } = useStore();
  const record = useRecordSales();
  const [day, setDay] = useState(today());
  const [counts, setCounts] = useState({});
  const [q, setQ] = useState('');
  const [confirm, confirmUi] = useConfirm();
  const sellable = products.filter((p) => !p.is_component && Number(p.sell_price) > 0 && (!q || `${p.name} ${p.size}`.includes(q.trim())));
  const groups = useMemo(() => {
    const g = new Map();
    for (const p of [...sellable].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
      const k = p.category || 'بدون تصنيف';
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(p);
    }
    return [...g];
  }, [sellable]);
  const inc = (id, d) => setCounts((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) + d) }));
  const total = Object.entries(counts).reduce((a, [id, n]) => a + (calc.product(id)?.shelf || 0) * n, 0);
  const pieces = Object.values(counts).reduce((a, n) => a + n, 0);
  const dayRows = sales.filter((s) => s.sale_date === day && (isAdmin || s.created_by === email)).slice().reverse();
  const dayTotal = dayRows.reduce((a, s) => a + Number(s.unit_price) * Number(s.qty), 0);

  if (!products.some((p) => !p.is_component && Number(p.sell_price) > 0)) return <Empty title="ما فيه منتجات لها سعر">أضف المنتجات وأسعارها أول.</Empty>;

  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', alignItems: 'start' }} data-stack>
      <div>
        <div className="row" style={{ marginBottom: 12 }}>
          <input type="date" className="input" style={{ width: 170 }} value={day} max={today()} onChange={(e) => setDay(e.target.value || today())} aria-label="اليوم" />
          <div className="search"><Search aria-hidden="true" /><input className="input" placeholder="ابحث عن منتج" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" /></div>
        </div>
        {groups.map(([g, ps]) => (
          <section className="list-group" key={g}>
            <h3>{g}</h3>
            <div className="list">
              {ps.map((p) => (
                <div className="item" key={p.id} style={{ cursor: 'default' }} onClick={() => inc(p.id, 1)}>
                  <span className="item-title">{p.name} {p.size && <span className="size-tag">{p.size}</span>}</span>
                  <span className="item-sub"><span className="num">{money(calc.product(p.id).shelf)}</span> {CUR}</span>
                  <span className="item-end" onClick={(e) => e.stopPropagation()}>
                    <span className="counter">
                      <button onClick={() => inc(p.id, -1)} aria-label={`نقّص ${p.name}`}>−</button>
                      <span className="num">{counts[p.id] || 0}</span>
                      <button onClick={() => inc(p.id, 1)} aria-label={`زيد ${p.name}`}>+</button>
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="receipt grid" style={{ gap: 16 }}>
        <div className="panel">
          <div className="panel-head"><h2>الطلب الحالي</h2>{pieces > 0 && <button className="btn sm ghost" onClick={() => setCounts({})}><RotateCcw size={16} /> صفّر</button>}</div>
          <div className="receipt-total final"><span><span className="num">{pieces}</span> حبة</span><b className="num">{money(total)} {CUR}</b></div>
          <button className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={!pieces} onClick={async () => { if (await record(counts, day)) setCounts({}); }}>
            <Check /> سجّل المبيعات {day !== today() ? `(${date(day)})` : ''}
          </button>
          <p className="muted small" style={{ marginBottom: 0 }}>اضغط على المنتج يزيد واحد. سجّل بعد كل طلب أو آخر اليوم مرة وحدة.</p>
        </div>
        <div className="panel">
          <div className="panel-head"><h3>{day === today() ? 'مسجّل اليوم' : `مسجّل يوم ${date(day)}`}</h3><b className="num">{money(dayTotal)} {CUR}</b></div>
          {!dayRows.length ? <p className="muted small">ما فيه شي للحين.</p> : (
            <table className="table">
              <tbody>
                {dayRows.slice(0, 40).map((s) => (
                  <tr key={s.id}>
                    <td>{s.product_name} <span className="muted num">×{num(s.qty, 0)}</span></td>
                    <td className="n num">{money(s.unit_price * s.qty)}</td>
                    <td style={{ width: 36 }}>{(isAdmin || day === today()) && <button className="btn icon ghost" style={{ width: 32, minHeight: 32 }} aria-label="احذف" onClick={async () => { if (await confirm(`تحذف ${s.product_name} ×${s.qty}؟`)) deleteRow('sales', s.id, 'انحذف'); }}><Trash2 size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {confirmUi}
      <style>{`@media (max-width: 899px){ [data-stack]{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

function Report() {
  const { sales, calc, expenses, settings, products } = useStore();
  const [range, setRange] = useState('30');
  const from = range === 'today' ? today() : range === 'month' ? today().slice(0, 8) + '01' : daysAgo(Number(range) - 1);
  const sum = useMemo(() => salesSummary(sales, calc, from, today()), [sales, calc, from]);
  const fixed = monthlyFixed(expenses, settings);
  const days = Math.max(1, Math.round((new Date(today()) - new Date(from)) / 864e5) + 1);
  const fixedShare = ((fixed * 12) / 365) * days; // نصيب الفترة من المصاريف الشهرية
  const be = breakEven(fixed, avgUnitProfit(calc, products, sales).value, settings);
  const dailyTarget = fixed / (Number(settings.working_days) || 30);

  const chartDays = [];
  for (let i = Math.min(days, 60) - 1; i >= 0; i--) {
    const d = daysAgo(i);
    const v = sum.byDay.get(d);
    chartDays.push({ date: d, value: v ? v.net - v.cost : 0, sub: v ? `${num(v.qty, 0)} حبة` : '' });
  }
  const top = [...sum.byProduct].sort((a, b) => b.profit - a.profit);

  if (!sales.length) return <Empty title="ما فيه مبيعات مسجلة">سجّل مبيعات اليوم من تبويب «تسجيل» وترجع هنا تشوف الربح.</Empty>;

  return (
    <div className="grid">
      <div className="row">
        <Seg value={range} onChange={setRange} label="الفترة" options={[['today', 'اليوم'], ['7', '7 أيام'], ['30', '30 يوم'], ['month', 'هالشهر'], ['90', '3 أشهر']]} />
      </div>
      <div className="stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="stat"><span>المبيعات</span><b className="num">{money(sum.revenue)}</b><small><span className="num">{num(sum.qty, 0)}</span> حبة</small></div>
        <div className="stat"><span>التكلفة</span><b className="num">{money(sum.cost)}</b><small>مواد وتغليف</small></div>
        <div className="stat"><span>إجمالي الربح</span><b className="num" style={{ color: 'var(--good)' }}>{money(sum.profit)}</b><small>هامش <span className="num">{pct(sum.net ? sum.profit / sum.net : null)}</span></small></div>
        <div className="stat"><span>بعد المصاريف الثابتة</span><b className="num" style={{ color: sum.profit - fixedShare >= 0 ? 'var(--good)' : 'var(--bad)' }}>{fixed ? money(sum.profit - fixedShare) : '—'}</b><small>{fixed ? <>مصاريف الفترة <span className="num">{money(fixedShare)}</span></> : 'أضف المصاريف'}</small></div>
      </div>
      <section className="panel">
        <div className="panel-head"><h2>الربح كل يوم</h2>{be && <span className="muted small">تحتاج <b className="num">{num(Math.ceil(be.perDay), 0)}</b> حبة يومياً عشان تغطي المصاريف</span>}</div>
        <DailyBars days={chartDays} target={dailyTarget} targetLabel={dailyTarget ? `المصاريف اليومية ${money(dailyTarget)}` : ''} />
      </section>
      <section className="panel table-wrap">
        <h2 style={{ marginBottom: 10 }}>أكثر شي يربّحك</h2>
        <table className="table">
          <thead><tr><th>المنتج</th><th className="n">الكمية</th><th className="n">المبيعات</th><th className="n">الربح</th></tr></thead>
          <tbody>
            {top.slice(0, 15).map((r) => (
              <tr key={r.id}><td>{r.name}</td><td className="n num">{num(r.qty, 0)}</td><td className="n num">{money(r.revenue)}</td><td className="n num">{money(r.profit)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
