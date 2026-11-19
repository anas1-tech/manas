import { useMemo, useState } from 'react';
import { PackagePlus, ClipboardCheck, Trash, Search, CircleAlert, OctagonAlert, CircleCheck, CircleDashed } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { stockLevels, packageBaseQty, materialBase } from '../lib/calc.js';
import { UNITS, BASE_BIG, toMaterialBase, unitsForMaterial } from '../lib/units.js';
import { money, num, CUR, date } from '../lib/format.js';
import { Field, NumInput, Modal, Seg, Empty, navigate, Select } from '../components/ui.jsx';

export function useStock() {
  const { materials, products, moves, sales } = useStore();
  return useMemo(() => {
    const { level, tracked, use } = stockLevels(materials, products, moves, sales);
    const info = new Map();
    for (const m of materials) {
      const pkg = packageBaseQty(m) || 1;
      const lv = level.get(m.id) || 0;
      const packs = lv / pkg;
      const status = !tracked.has(m.id) ? 'none' : lv <= 0 ? 'out' : m.min_stock != null && packs < Number(m.min_stock) ? 'low' : 'ok';
      info.set(m.id, { level: lv, packs, status, pkg });
    }
    return { info, use };
  }, [materials, products, moves, sales]);
}

const ST = {
  out: { label: 'خلصت', cls: 'bad', I: OctagonAlert },
  low: { label: 'قربت تخلص', cls: 'warn', I: CircleAlert },
  ok: { label: 'متوفرة', cls: 'good', I: CircleCheck },
  none: { label: 'ما انجردت', cls: '', I: CircleDashed },
};
export const StockChip = ({ status }) => { const s = ST[status]; return <span className={`chip ${s.cls}`}><s.I aria-hidden="true" />{s.label}</span>; };

export function fmtLevel(m, lv) {
  const base = materialBase(m);
  if (base === 'pcs') return `${num(lv, 0)} حبة`;
  return Math.abs(lv) >= 1000 ? `${num(lv / 1000, 2)} ${UNITS[BASE_BIG[base]].short}` : `${num(lv, 0)} ${UNITS[base].short}`;
}

export default function Inventory() {
  const { materials, products } = useStore();
  const { info, use } = useStock();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [act, setAct] = useState(null);
  const list = materials
    .filter((m) => (!q || m.name.includes(q.trim())) && (filter === 'all' || (filter === 'alert' ? ['out', 'low'].includes(info.get(m.id)?.status) : info.get(m.id)?.status === 'none')))
    .sort((a, b) => ['out', 'low', 'ok', 'none'].indexOf(info.get(a.id)?.status) - ['out', 'low', 'ok', 'none'].indexOf(info.get(b.id)?.status) || a.name.localeCompare(b.name, 'ar'));
  const alerts = materials.filter((m) => ['out', 'low'].includes(info.get(m.id)?.status)).length;

  if (!materials.length) return <><div className="page-head"><div><h1>المخزون</h1></div></div><Empty title="ما فيه مواد" action={<button className="btn primary" onClick={() => navigate('/materials')}>أضف المواد</button>}>المخزون يتبع المواد اللي تشتريها.</Empty></>;

  return (
    <>
      <div className="page-head">
        <div><h1>المخزون</h1><p>سجّل اللي يوصلك، والمبيعات تنقّص لحالها حسب الوصفات.</p></div>
      </div>
      {!info.size || [...info.values()].every((x) => x.status === 'none') ? (
        <div className="banner"><ClipboardCheck />ابدأ بـ«جرد»: عدّ الموجود عندك من كل مادة. من بعدها كل بيع ينقّص، وكل استلام يزيد.</div>
      ) : null}
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="search"><Search aria-hidden="true" /><input className="input" placeholder="ابحث" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" /></div>
        <Seg value={filter} onChange={setFilter} label="فلتر" options={[['all', 'الكل'], ['alert', `تنبيهات${alerts ? ` (${alerts})` : ''}`], ['none', 'ما انجردت']]} />
      </div>
      <div className="list">
        {list.map((m) => {
          const s = info.get(m.id);
          return (
            <div className="item" key={m.id} style={{ cursor: 'default' }}>
              <span className="item-title">{m.name} <StockChip status={s.status} /></span>
              <span className="item-sub">
                {s.status === 'none' ? 'سوّ جرد عشان نبدأ نتابعها' : <>الموجود <b className="num">{fmtLevel(m, s.level)}</b> · تقريباً <span className="num">{num(s.packs, 1)}</span> {m.package_name || 'عبوة'}{m.min_stock != null && ` · التنبيه تحت ${num(m.min_stock)}`}</>}
              </span>
              <span className="item-end">
                <span className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                  <button className="btn sm" onClick={() => setAct({ m, mode: 'purchase' })}><PackagePlus size={16} /> استلام</button>
                  <button className="btn sm" onClick={() => setAct({ m, mode: 'count' })}><ClipboardCheck size={16} /> جرد</button>
                  <button className="btn sm icon" style={{ width: 34, minHeight: 34 }} onClick={() => setAct({ m, mode: 'waste' })} aria-label="هدر" title="هدر / تالف"><Trash size={15} /></button>
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {act && <StockDialog {...act} s={info.get(act.m.id)} use={use} products={products} onClose={() => setAct(null)} />}
    </>
  );
}

function StockDialog({ m, mode: initialMode, s, use, products, onClose }) {
  const { saveRows, saveMaterial, moves } = useStore();
  const [mode, setMode] = useState(initialMode);
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState('pkg');
  const [price, setPrice] = useState(m.package_price);
  const [minStock, setMinStock] = useState(m.min_stock ?? '');
  const [note, setNote] = useState('');
  const toBaseQty = (v) => (unit === 'pkg' ? Number(v) * s.pkg : toMaterialBase(v, unit, m));
  const entered = qty === '' ? null : toBaseQty(qty);
  const delta = entered == null ? 0 : mode === 'purchase' ? entered : mode === 'waste' ? -entered : entered - s.level;
  const after = (s.status === 'none' && mode !== 'count' ? 0 : s.level) + delta;
  const hist = moves.filter((x) => x.material_id === m.id).slice(-8).reverse();
  const cups = products.filter((p) => !p.is_component && use(p.id).get(m.id) > 0).slice(0, 6).map((p) => ({ p, n: Math.floor(Math.max(after, 0) / use(p.id).get(m.id)) }));
  const KIND = { purchase: 'استلام', count: 'جرد', waste: 'هدر', adjust: 'تعديل' };

  const save = async () => {
    const rows = [];
    if (entered != null && delta !== 0) rows.push({ id: crypto.randomUUID(), material_id: m.id, qty_base: +delta.toFixed(4), kind: mode, note, created_at: new Date().toISOString() });
    if (rows.length) await saveRows('stock_moves', rows, mode === 'purchase' ? 'انسجل الاستلام' : mode === 'count' ? 'انسجل الجرد' : 'انسجل الهدر');
    const minV = minStock === '' ? null : Number(minStock);
    if ((mode === 'purchase' && Number(price) !== Number(m.package_price) && Number(price) > 0) || minV !== (m.min_stock ?? null)) {
      await saveMaterial({ ...m, package_price: mode === 'purchase' && Number(price) > 0 ? Number(price) : m.package_price, min_stock: minV });
    }
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="grid">
        <div className="row"><h2 style={{ flex: 1 }}>{m.name}</h2><Seg value={mode} onChange={setMode} label="العملية" options={[['purchase', 'استلام'], ['count', 'جرد'], ['waste', 'هدر']]} /></div>
        <p className="muted small" style={{ margin: 0 }}>
          {mode === 'purchase' ? 'كم وصلك؟' : mode === 'count' ? 'كم الموجود فعلياً عندك الحين؟ الموقع يعدّل الفرق.' : 'كم انكب أو تلف؟'}
          {s.status !== 'none' && <> الحين: <b className="num">{fmtLevel(m, s.level)}</b></>}
        </p>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <NumInput value={qty} onChange={setQty} autoFocus />
          <Select className="select input" style={{ width: 170 }} value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="الوحدة">
            <option value="pkg">{m.package_name || 'عبوة'} ({fmtLevel(m, s.pkg)})</option>
            {unitsForMaterial(m).map((u) => <option key={u} value={u}>{UNITS[u].label}</option>)}
          </Select>
        </div>
        {mode === 'purchase' && <Field label={`سعر ال${m.package_name || 'عبوة'} في هالفاتورة`} hint={Number(price) !== Number(m.package_price) ? 'بيتحدث سعر المادة وتكلفة كل المنتجات' : ''}><NumInput value={price} onChange={setPrice} suffix={CUR} /></Field>}
        <Field label={`نبّهني لما يقل عن (${m.package_name || 'عبوة'})`}><NumInput value={minStock} onChange={setMinStock} placeholder="اختياري" /></Field>
        <Field label="ملاحظة"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'purchase' ? 'رقم الفاتورة أو المورد' : ''} /></Field>
        {entered != null && (
          <div className="formula">
            <div className="formula-result" style={{ border: 0, padding: 0 }}>
              <div><span>بعد الحفظ</span><b className="num">{fmtLevel(m, after)}</b></div>
              {cups.map(({ p, n }) => <div key={p.id}><span>{p.name} {p.size}</span><b className="num">{num(n, 0)} حبة</b></div>)}
            </div>
          </div>
        )}
        {hist.length > 0 && (
          <details>
            <summary className="muted small" style={{ cursor: 'pointer' }}>آخر الحركات</summary>
            <table className="table"><tbody>
              {hist.map((h) => <tr key={h.id}><td>{KIND[h.kind]}</td><td className="muted small">{date(h.created_at)}</td><td className="n num" style={{ color: h.qty_base < 0 ? 'var(--bad)' : 'var(--good)' }}>{h.qty_base > 0 ? '+' : ''}{fmtLevel(m, h.qty_base)}</td></tr>)}
            </tbody></table>
          </details>
        )}
        <div className="row">
          <button className="btn primary" onClick={save} disabled={entered != null && Number.isNaN(entered)}>حفظ</button>
          <button className="btn" onClick={onClose}>إلغاء</button>
        </div>
      </div>
    </Modal>
  );
}
