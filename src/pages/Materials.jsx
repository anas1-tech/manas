import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, BellRing, Check, Store } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { costPerBase, costPerPiece, effectivePackagePrice, materialBase, packageBaseQty, productsUsingMaterial, materialUsage, makeCalc, suggestPrice } from '../lib/calc.js';
import { UNITS, BASE_BIG, DENSITY_PRESETS } from '../lib/units.js';
import { money, tiny, num, pct, CUR } from '../lib/format.js';
import { Field, NumInput, Switch, Sheet, Empty, Delta, Modal, MarginChip, useConfirm, navigate, Combo, ChipPicker } from '../components/ui.jsx';
import { Sparkline } from '../components/charts.jsx';

const PACKS = ['كرتون', 'كيس', 'علبة', 'جالون', 'قارورة', 'صندوق', 'باكت', 'ربطة', 'شدة', 'سطل', 'شوال', 'حبة'];

export const blankMaterial = () => ({
  id: crypto.randomUUID(), name: '', category: '', package_name: 'كرتون', package_price: '', price_includes_vat: true,
  units_per_package: 1, unit_size: 1, size_unit: 'pcs', density: null, supplier: '', notes: '',
});

export function packText(m) {
  const u = UNITS[m.size_unit] || UNITS.pcs;
  const size = m.size_unit === 'pcs' ? '' : ` × ${num(m.unit_size)} ${u.short}`;
  return `${m.package_name || 'عبوة'} ${num(m.units_per_package)}${m.size_unit === 'pcs' ? ' حبة' : ''}${size}`;
}

export default function Materials() {
  const { materials, products, history, settings, saveMaterial, deleteMaterial, loadSample, calc, saveRows } = useStore();
  const [alert, setAlert] = useState(null);
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

      {alert && <PriceAlert {...alert} settings={settings} onClose={() => setAlert(null)} onApply={async (rows) => { setAlert(null); await saveRows('products', rows, `تحدّث سعر ${rows.length} منتج`); }} />}
      {edit && (
        <MaterialEditor
          key={edit.id}
          initial={edit}
          isNew={!materials.some((m) => m.id === edit.id)}
          onClose={() => setEdit(null)}
          onSave={async (m) => {
            setEdit(null);
            // تنبيه: لو المنتجات اللي فيها المادة نزل ربحها تحت الهدف
            const after = makeCalc(materials.map((x) => (x.id === m.id ? m : x)).concat(materials.some((x) => x.id === m.id) ? [] : [m]), products, settings);
            const hit = productsUsingMaterial(m.id, products).filter((p) => !p.is_component).map((p) => ({ p, before: calc.product(p.id), after: after.product(p.id) }))
              .filter(({ before, after: a }) => a.margin != null && before.margin != null && a.margin < before.margin - 0.0001 && a.status !== 'good');
            await saveMaterial(m);
            if (hit.length) setAlert({ m, hit });
          }}
          onDelete={async (id) => { setEdit(null); await deleteMaterial(id); }}
          history={history.filter((h) => h.material_id === edit.id)}
          usedIn={productsUsingMaterial(edit.id, products)}
          products={products}
          materials={materials}
          settings={settings}
          cats={cats}
        />
      )}
    </>
  );
}

function MaterialEditor({ initial, isNew, onClose, onSave, onDelete, history, usedIn, settings, cats, products, materials }) {
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
          <button className="btn primary" disabled={!valid} onClick={() => onSave({ ...m, name: m.name.trim(), package_price: Number(m.package_price), units_per_package: Number(m.units_per_package), unit_size: Number(m.unit_size), density: kind !== 'pcs' && Number(m.density) > 0 ? Number(m.density) : null })}>حفظ المادة</button>
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
            <Combo value={m.category} onChange={set('category')} options={[...cats, 'ألبان', 'بن', 'شاي وبهارات', 'سكر ومحليات', 'سيرب ونكهات', 'مخبوزات', 'مكسرات', 'تغليف', 'منظفات', 'أخرى']} placeholder="اختر أو اكتب تصنيف" label="التصنيف" />
          </Field>
          <Field label="المورد"><Combo value={m.supplier || ''} onChange={set('supplier')} options={[...new Set(materials.map((x) => x.supplier).filter(Boolean))]} placeholder="اختياري" label="المورد" /></Field>
        </div>
      </div>

      <div className="panel grid">
        <h3>كيف تشتريها؟</h3>
        <Field label="تشتريها كـ" group>
          <ChipPicker value={m.package_name} onChange={set('package_name')} options={PACKS} />
        </Field>
        <Field label={`سعر ال${m.package_name || 'عبوة'} كامل`}><NumInput value={m.package_price} onChange={set('package_price')} suffix={CUR} /></Field>
        <Switch checked={m.price_includes_vat} onChange={set('price_includes_vat')} label="السعر شامل الضريبة" hint={vatNote} />
        <Field label="المادة تنقاس بـ" group>
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
                <select className="select input" style={{ width: 150 }} value={m.size_unit} onChange={(e) => set('size_unit')(e.target.value)}>
                  {Object.entries(UNITS).filter(([, u]) => u.base === kind).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}
                </select>
              </div>
            </Field>
          )}
        </div>
        {kind !== 'pcs' && (
          <Field label={kind === 'g' ? 'تبي تقيسها بالملعقة أو المل؟ (اختياري)' : 'تبي تقيسها بالجرام؟ (اختياري)'}
            hint={Number(m.density) > 0 ? `1 مل = ${num(m.density, 3)} جرام، والحين تقدر تستخدم وحدات ${kind === 'g' ? 'الحجم' : 'الوزن'} في الوصفات` : 'حط كم جرام في 1 مل، مثلاً تشتري السكر بالكيلو وتحطه بالملعقة'}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <span className="muted small" style={{ whiteSpace: 'nowrap' }}>1 مل =</span>
              <NumInput value={m.density ?? ''} onChange={set('density')} suffix="جرام" />
            </div>
            <div className="chips" style={{ marginTop: 4 }}>
              {DENSITY_PRESETS.map(([l, d]) => <button type="button" key={l} className="filter-chip" style={{ padding: '2px 10px', fontSize: 13 }} aria-pressed={Number(m.density) === d} onClick={() => set('density')(d)}>{l}</button>)}
            </div>
          </Field>
        )}
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
                <div><span>كل 1 أونصة</span><b className="num">{tiny(per * UNITS[base === 'ml' ? 'oz' : 'ozw'].f)} {CUR}</b></div>
                {base === 'ml' && <div><span>كل جالون</span><b className="num">{money(per * UNITS.gal.f)} {CUR}</b></div>}
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

      {!isNew && usedIn.length > 0 && valid && (
        <div className="panel">
          <h3 style={{ marginBottom: 4 }}>ال{m.package_name || 'عبوة'} يكفي لكم كوب؟</h3>
          <p className="muted small" style={{ marginTop: 0 }}>محسوبة من الوصفة والهدر، ومع الخلطات المدموجة.</p>
          <table className="table">
            <tbody>
              {usedIn.filter((p) => !p.is_component).map((p) => {
                const use = materialUsage(m.id, p.id, materials.map((x) => (x.id === m.id ? m : x)), products);
                const cups = use > 0 ? Math.floor(packageBaseQty(m) / use) : null;
                return (
                  <tr key={p.id}>
                    <td>{p.name} <span className="muted">{p.size}</span></td>
                    <td className="n muted small"><span className="num">{num(use, 2)}</span> {UNITS[base].short} للكوب</td>
                    <td className="n"><b className="num">{cups == null ? '—' : num(cups, 0)}</b> كوب</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isNew && valid && <Suppliers m={m} onUse={(o) => setM((x) => ({ ...x, supplier: o.supplier, package_price: o.package_price, units_per_package: o.units_per_package, unit_size: o.unit_size, size_unit: o.size_unit, price_includes_vat: o.price_includes_vat }))} settings={settings} />}

      <Field label="ملاحظات"><textarea className="input" rows={2} value={m.notes || ''} onChange={(e) => set('notes')(e.target.value)} /></Field>
      {confirmUi}
    </Sheet>
  );
}

/** مقارنة أسعار الموردين لنفس المادة */
function Suppliers({ m, onUse, settings }) {
  const { offers, saveRows, deleteRow } = useStore();
  const [add, setAdd] = useState(null);
  const base = materialBase(m);
  const list = offers.filter((o) => o.material_id === m.id).map((o) => ({ ...o, per: costPerBase({ ...o, density: m.density }, settings) })).sort((a, b) => a.per - b.per);
  const current = costPerBase(m, settings);
  const show = (v) => (base === 'pcs' ? `${tiny(v)} ${CUR}/حبة` : `${money(v * 1000)} ${CUR}/${UNITS[BASE_BIG[base]].short}`);
  const newOffer = () => setAdd({ id: crypto.randomUUID(), material_id: m.id, supplier: '', package_price: '', units_per_package: m.units_per_package, unit_size: m.unit_size, size_unit: m.size_unit, price_includes_vat: m.price_includes_vat, notes: '' });
  return (
    <div className="panel">
      <div className="panel-head"><h3><Store size={18} style={{ verticalAlign: -3 }} /> أسعار الموردين</h3><button className="btn sm" onClick={newOffer}><Plus size={16} /> سعر مورد</button></div>
      {!list.length ? <p className="muted small" style={{ margin: 0 }}>أضف أسعار الموردين الثانيين لنفس المادة، والموقع يقول لك مين الأرخص بعد ما يحسب حجم العبوة.</p> : (
        <table className="table">
          <tbody>
            <tr><td>الحالي{m.supplier ? ` (${m.supplier})` : ''}</td><td className="muted small">{packText(m)}</td><td className="n num"><b>{show(current)}</b></td><td /></tr>
            {list.map((o, i) => (
              <tr key={o.id}>
                <td>{o.supplier} {i === 0 && o.per < current && <span className="chip good">الأرخص · وفر <span className="num">{Math.round((1 - o.per / current) * 100)}%</span></span>}</td>
                <td className="muted small">{packText(o)} بـ <span className="num">{money(Number(o.package_price))}</span></td>
                <td className="n num">{show(o.per)}</td>
                <td className="n" style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn sm" onClick={() => onUse(o)} title="اعتمد هذا السعر للمادة"><Check size={15} /> اعتمد</button>
                  <button className="btn sm icon ghost" style={{ width: 32, minHeight: 32 }} aria-label="احذف" onClick={() => deleteRow('supplier_prices', o.id, 'انحذف')}><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {add && (
        <div className="grid" style={{ marginTop: 12, padding: 12, background: 'var(--surface-2)', borderRadius: 12 }}>
          <div className="grid g2">
            <Field label="المورد"><input className="input" value={add.supplier} onChange={(e) => setAdd({ ...add, supplier: e.target.value })} autoFocus /></Field>
            <Field label={`سعر ال${m.package_name || 'عبوة'}`}><NumInput value={add.package_price} onChange={(v) => setAdd({ ...add, package_price: v })} suffix={CUR} /></Field>
          </div>
          <div className="grid g2">
            <Field label="كم حبة داخلها"><NumInput value={add.units_per_package} onChange={(v) => setAdd({ ...add, units_per_package: v })} /></Field>
            {base !== 'pcs' && (
              <Field label="حجم الحبة">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <NumInput value={add.unit_size} onChange={(v) => setAdd({ ...add, unit_size: v })} />
                  <select className="select input" style={{ width: 150 }} value={add.size_unit} onChange={(e) => setAdd({ ...add, size_unit: e.target.value })}>
                    {Object.entries(UNITS).filter(([, u]) => u.base === base).map(([k, u]) => <option key={k} value={k}>{u.label}</option>)}
                  </select>
                </div>
              </Field>
            )}
          </div>
          <div className="row">
            <button className="btn primary sm" disabled={!add.supplier.trim() || !(Number(add.package_price) > 0)} onClick={() => { saveRows('supplier_prices', [{ ...add, supplier: add.supplier.trim(), package_price: Number(add.package_price), units_per_package: Number(add.units_per_package) || 1, unit_size: Number(add.unit_size) || 1 }], 'انحفظ سعر المورد'); setAdd(null); }}>حفظ</button>
            <button className="btn sm" onClick={() => setAdd(null)}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** تنبيه بعد ما يغلى سعر مادة: المنتجات اللي نزل ربحها + تحديث السعر بضغطة */
function PriceAlert({ m, hit, settings, onClose, onApply }) {
  const rows = hit.map(({ p, before, after }) => ({ p, before, after, sug: suggestPrice(after.total, settings) }));
  const [pick, setPick] = useState(() => new Set(rows.map((r) => r.p.id)));
  return (
    <Modal onClose={onClose}>
      <div className="grid">
        <h2><BellRing size={20} style={{ verticalAlign: -3, color: 'var(--warn)' }} /> سعر «{m.name}» أثّر على ربحك</h2>
        <p className="muted small" style={{ margin: 0 }}>هالمنتجات صار ربحها تحت هدفك {settings.target_margin}%. اختر اللي تبي تحدّث سعره للسعر المقترح.</p>
        <table className="table">
          <thead><tr><th /><th>المنتج</th><th className="n">الهامش</th><th className="n">السعر</th></tr></thead>
          <tbody>
            {rows.map(({ p, before, after, sug }) => (
              <tr key={p.id}>
                <td><input type="checkbox" checked={pick.has(p.id)} onChange={(e) => { const n = new Set(pick); e.target.checked ? n.add(p.id) : n.delete(p.id); setPick(n); }} aria-label={p.name} /></td>
                <td>{p.name} <span className="muted">{p.size}</span></td>
                <td className="n"><span className="muted num">{pct(before.margin)}</span> ← <MarginChip margin={after.margin} status={after.status} /></td>
                <td className="n num">{money(after.shelf)} ← <b>{money(sug.rounded)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row">
          <button className="btn primary" disabled={!pick.size} onClick={() => onApply(rows.filter((r) => pick.has(r.p.id)).map(({ p, sug }) => ({ ...p, sell_price: settings.vat_registered && !p.price_includes_vat ? +sug.net.toFixed(2) : sug.rounded })))}>حدّث الأسعار المختارة</button>
          <button className="btn" onClick={onClose}>خلّها مثل ما هي</button>
        </div>
      </div>
    </Modal>
  );
}
