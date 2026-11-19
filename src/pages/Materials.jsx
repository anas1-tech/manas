import { useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { costPerBase, costPerPiece, effectivePackagePrice, materialBase, packageBaseQty, productsUsingMaterial } from '../lib/calc.js';
import { UNITS, BASE_BIG } from '../lib/units.js';
import { money, tiny, num, CUR } from '../lib/format.js';
import { Field, NumInput, Switch, Sheet, Empty, Delta, useConfirm, navigate } from '../components/ui.jsx';
import { Sparkline } from '../components/charts.jsx';

const PACKS = ['كرتون', 'كيس', 'علبة', 'جالون', 'ربطة', 'شدة', 'حبة'];

export const blankMaterial = () => ({
  id: crypto.randomUUID(), name: '', category: '', package_name: 'كرتون', package_price: '', price_includes_vat: true,
  units_per_package: 1, unit_size: 1, size_unit: 'pcs', supplier: '', notes: '',
});

export function packText(m) {
  const u = UNITS[m.size_unit] || UNITS.pcs;
  const size = m.size_unit === 'pcs' ? '' : ` × ${num(m.unit_size)} ${u.short}`;
  return `${m.package_name || 'عبوة'} ${num(m.units_per_package)}${m.size_unit === 'pcs' ? ' حبة' : ''}${size}`;
}

export default function Materials() {
  const { materials, products, history, settings, saveMaterial, deleteMaterial, loadSample } = useStore();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [edit, setEdit] = useState(null);

  const cats = useMemo(() => [...new Set(materials.map((m) => m.category).filter(Boolean))], [materials]);
  const shown = materials.filter((m) => (!cat || m.category === cat) && (!q || m.name.includes(q.trim()) || (m.supplier || '').includes(q.trim())));
  const groups = useMemo(() => {
    const g = new Map();
    for (const m of [...shown].sort((a, b) => a.name.localeCompare(b.name, 'ar'))) {
      const k = m.category || 'بدون تصنيف';
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(m);
    }
    return [...g];
  }, [shown]);

  const lastPrice = (id) => {
    const h = history.filter((x) => x.material_id === id);
    return h.length > 1 ? Number(h.at(-2).package_price) : null;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>المواد</h1>
          <p>كل شي تشتريه بالكرتون أو الكيس، والموقع يحسب سعر الحبة والجرام والمل.</p>
        </div>
        <button className="btn primary" onClick={() => setEdit(blankMaterial())}><Plus /> إضافة مادة</button>
      </div>

      {materials.length > 0 && (
        <div className="row" style={{ marginBottom: 16 }}>
          <div className="search"><Search aria-hidden="true" /><input className="input" placeholder="ابحث باسم المادة أو المورد" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" /></div>
          {cats.length > 1 && (
            <div className="chips">
              <button className="filter-chip" aria-pressed={!cat} onClick={() => setCat('')}>الكل</button>
              {cats.map((c) => <button key={c} className="filter-chip" aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
            </div>
          )}
        </div>
      )}

      {!materials.length ? (
        <Empty title="ما فيه مواد للحين" action={<div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => setEdit(blankMaterial())}><Plus /> أضف أول مادة</button><button className="btn" onClick={loadSample}>جرّب ببيانات تجريبية</button><button className="btn" onClick={() => navigate('/settings')}>استيراد من Excel</button></div>}>
          ابدأ بالأساسيات: الحليب، الشاي، السكر، الأكواب والأغطية.
        </Empty>
      ) : !shown.length ? (
        <Empty title="ما لقينا شي">جرّب كلمة ثانية أو امسح الفلتر.</Empty>
      ) : (
        groups.map(([g, list]) => (
          <section className="list-group" key={g}>
            <h3>{g}</h3>
            <div className="list">
              {list.map((m) => {
                const base = materialBase(m);
                const prev = lastPrice(m.id);
                return (
                  <button className="item" key={m.id} onClick={() => setEdit({ ...m })}>
                    <span className="item-title">{m.name}{prev != null && <Delta from={prev} to={Number(m.package_price)} />}</span>
                    <span className="item-sub">{packText(m)} بـ <span className="num">{money(Number(m.package_price))}</span> {CUR}{m.supplier ? ` · ${m.supplier}` : ''}</span>
                    <span className="item-end">
                      <b className="num">{tiny(base === 'pcs' ? costPerBase(m, settings) : costPerBase(m, settings) * 1000)}</b>
                      <span className="muted small">{CUR} لكل {UNITS[BASE_BIG[base]].label}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {edit && (
        <MaterialEditor
          key={edit.id}
          initial={edit}
          isNew={!materials.some((m) => m.id === edit.id)}
          onClose={() => setEdit(null)}
          onSave={async (m) => { setEdit(null); await saveMaterial(m); }}
          onDelete={async (id) => { setEdit(null); await deleteMaterial(id); }}
          history={history.filter((h) => h.material_id === edit.id)}
          usedIn={productsUsingMaterial(edit.id, products)}
          settings={settings}
          cats={cats}
        />
      )}
    </>
  );
}

function MaterialEditor({ initial, isNew, onClose, onSave, onDelete, history, usedIn, settings, cats }) {
  const [m, setM] = useState(initial);
  const [confirm, confirmUi] = useConfirm();
  const set = (k) => (v) => setM((x) => ({ ...x, [k]: v }));
  const kind = UNITS[m.size_unit]?.base || 'pcs';
  const setKind = (k) => setM((x) => ({ ...x, size_unit: k, unit_size: k === 'pcs' ? 1 : x.unit_size === 1 && x.size_unit === 'pcs' ? '' : x.unit_size }));

  const valid = m.name.trim() && Number(m.package_price) >= 0 && m.package_price !== '' && Number(m.units_per_package) > 0 && Number(m.unit_size) > 0;
  const per = costPerBase(m, settings);
  const piece = costPerPiece(m, settings);
  const eff = effectivePackagePrice(m, settings);
  const totalBase = packageBaseQty(m);
  const base = UNITS[m.size_unit]?.base || 'pcs';
  const vatNote = settings.vat_registered
    ? (m.price_includes_vat ? 'منشأتك مسجلة بالضريبة، فالتكلفة محسوبة بدون ضريبة لأنك تسترجعها' : '')
    : (!m.price_includes_vat ? `منشأتك مو مسجلة بالضريبة، فانضافت ${settings.vat_rate}% للتكلفة` : '');

  return (
    <Sheet
      title={isNew ? 'مادة جديدة' : m.name || 'تعديل مادة'}
      onClose={onClose}
      footer={
        <>
          <button className="btn primary" disabled={!valid} onClick={() => onSave({ ...m, name: m.name.trim(), package_price: Number(m.package_price), units_per_package: Number(m.units_per_package), unit_size: Number(m.unit_size) })}>حفظ المادة</button>
          <button className="btn" onClick={onClose}>إلغاء</button>
          <span className="spacer" />
          {!isNew && (
            <button className="btn ghost danger" onClick={async () => {
              const msg = usedIn.length ? `«${m.name}» داخلة في ${usedIn.length} منتج. إذا حذفتها بتنشال من وصفاتهم. متأكد؟` : `تحذف «${m.name}»؟`;
              if (await confirm(msg)) onDelete(m.id);
            }}><Trash2 /> حذف</button>
          )}
        </>
      }
    >
      <div className="panel grid">
        <Field label="اسم المادة"><input className="input" value={m.name} onChange={(e) => set('name')(e.target.value)} placeholder="مثال: حليب طازج" autoFocus={isNew} /></Field>
        <div className="grid g2">
          <Field label="التصنيف">
            <input className="input" list="mat-cats" value={m.category} onChange={(e) => set('category')(e.target.value)} placeholder="ألبان، بن، تغليف..." />
            <datalist id="mat-cats">{[...new Set([...cats, 'ألبان', 'بن', 'شاي وبهارات', 'تغليف', 'سكر ومحليات'])].map((c) => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="المورد"><input className="input" value={m.supplier} onChange={(e) => set('supplier')(e.target.value)} placeholder="اختياري" /></Field>
        </div>
      </div>

      <div className="panel grid">
        <h3>كيف تشتريها؟</h3>
        <div className="grid g2">
          <Field label="نوع العبوة">
            <input className="input" list="packs" value={m.package_name} onChange={(e) => set('package_name')(e.target.value)} />
            <datalist id="packs">{PACKS.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label={`سعر ال${m.package_name || 'عبوة'} كامل`}><NumInput value={m.package_price} onChange={set('package_price')} suffix={CUR} /></Field>
        </div>
        <Switch checked={m.price_includes_vat} onChange={set('price_includes_vat')} label="السعر شامل الضريبة" hint={vatNote} />
        <Field label="المادة تنقاس بـ">
          <div className="seg" role="group">
            {[['pcs', 'العدد (حبة)'], ['g', 'الوزن (جرام)'], ['ml', 'السائل (مل)']].map(([k, l]) => (
              <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>
            ))}
          </div>
        </Field>
        <div className="grid g2">
          <Field label={`كم حبة داخل ال${m.package_name || 'عبوة'}؟`} hint={kind === 'pcs' ? 'مثلاً كرتون أكواب فيه 1000 كوب' : 'لو كيس واحد أو جالون واحد اكتب 1'}>
            <NumInput value={m.units_per_package} onChange={set('units_per_package')} suffix="حبة" />
          </Field>
          {kind !== 'pcs' && (
            <Field label="حجم الحبة الواحدة">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <NumInput value={m.unit_size} onChange={set('unit_size')} />
                <select className="select input" style={{ width: 110 }} value={m.size_unit} onChange={(e) => set('size_unit')(e.target.value)}>
                  {Object.entries(UNITS).filter(([, u]) => u.base === kind).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}
                </select>
              </div>
            </Field>
          )}
        </div>
      </div>

      {valid && (
        <div className="formula" aria-live="polite">
          <div className="formula-line">
            <b className="num">{money(eff)}</b> {CUR} ÷ <b className="num">{num(m.units_per_package)}</b> حبة
            {kind !== 'pcs' && <> × <b className="num">{num(m.unit_size)}</b> {UNITS[m.size_unit].short}</>}
            {kind !== 'pcs' && <> = <b className="num">{num(totalBase, 1)}</b> {UNITS[base].short} بال{m.package_name || 'عبوة'}</>}
          </div>
          <div className="formula-result">
            {Number(m.units_per_package) > 1 && kind !== 'pcs' && <div><span>الحبة الوحدة</span><b className="num">{money(piece)} {CUR}</b></div>}
            {kind === 'pcs' ? (
              <div><span>الحبة الوحدة</span><b className="num">{tiny(per)} {CUR}</b></div>
            ) : (
              <>
                <div><span>كل 1 {UNITS[base].short}</span><b className="num">{tiny(per)} {CUR}</b></div>
                <div><span>كل 1 {UNITS[BASE_BIG[base]].label}</span><b className="num">{money(per * 1000)} {CUR}</b></div>
              </>
            )}
          </div>
        </div>
      )}

      {!isNew && (
        <div className="panel">
          <div className="panel-head"><h3>سجل السعر</h3><span className="muted small">{history.length} تسجيل</span></div>
          <Sparkline points={history} />
        </div>
      )}

      {!isNew && usedIn.length > 0 && (
        <div className="panel">
          <h3 style={{ marginBottom: 8 }}>تدخل في</h3>
          <div className="chips">{usedIn.map((p) => <span className="chip" key={p.id}>{p.name}{p.size ? ` ${p.size}` : ''}</span>)}</div>
        </div>
      )}

      <Field label="ملاحظات"><textarea className="input" rows={2} value={m.notes || ''} onChange={(e) => set('notes')(e.target.value)} /></Field>
      {confirmUi}
    </Sheet>
  );
}
