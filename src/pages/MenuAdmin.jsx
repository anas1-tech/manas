import { useMemo, useState } from 'react';
import { Plus, Tv, Eye, EyeOff, ChevronUp, ChevronDown, X, Pencil } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { money, CUR } from '../lib/format.js';
import { Field, NumInput, Modal, Empty, Combo, Link, navigate } from '../components/ui.jsx';

// قوالب أحجام جاهزة
const PRESETS = [
  ['حجم واحد', ['']],
  ['صغير / وسط / كبير', ['صغير', 'وسط', 'كبير']],
  ['أحجام الشاهي', ['ورق صغير', 'ورق كبير', 'زجاج كبير', 'براد صغير', 'براد وسط', 'براد كبير']],
  ['القهوة السعودية', ['ورق صغير', 'دلة صغيرة', 'دلة كبيرة']],
];

/** يجمع المنتجات حسب الاسم والتصنيف (كل اسم = سطر في المنيو، وأحجامه منتجات) */
function groupMenu(products) {
  const cats = new Map();
  for (const p of [...products].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))) {
    if (p.is_component) continue;
    const c = p.category || 'بدون تصنيف';
    if (!cats.has(c)) cats.set(c, new Map());
    const g = cats.get(c);
    if (!g.has(p.name)) g.set(p.name, { key: `${c}|${p.name}`, name: p.name, category: c, items: [] });
    g.get(p.name).items.push(p);
  }
  return [...cats].map(([cat, g]) => ({ cat, rows: [...g.values()] }));
}

export default function MenuAdmin() {
  const { products, saveRows } = useStore();
  const [edit, setEdit] = useState(null);
  const groups = useMemo(() => groupMenu(products), [products]);
  const hidden = groups.flatMap((g) => g.rows).filter((r) => r.items.every((p) => !p.on_menu));
  const shownCount = products.filter((p) => p.on_menu && !p.is_component && Number(p.sell_price) > 0).length;

  const setVisible = (row, on) => saveRows('products', row.items.map((p) => ({ ...p, on_menu: on })), on ? `«${row.name}» ظهر في المنيو` : `«${row.name}» انخفى من المنيو`);
  // تحريك سطر فوق أو تحت داخل تصنيفه (يبدّل ترتيب الأحجام كلها)
  const move = (rows, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    const aSort = Math.min(...a.items.map((p) => p.sort ?? 0));
    const bSort = Math.min(...b.items.map((p) => p.sort ?? 0));
    const re = (row, base) => row.items.map((p, k) => ({ ...p, sort: base + k * 0.01 }));
    saveRows('products', [...re(a, bSort), ...re(b, aSort)]);
  };

  return (
    <>
      <div className="page-head">
        <div><h1>المنيو</h1><p>اللي يشوفه الزبون: أضف أصناف، عدّل الأسعار، رتّبها، أو اخفها.</p></div>
        <div className="row">
          <Link to="/menu" className="btn" target="_blank"><Tv /> شوف المنيو</Link>
          <button className="btn primary" onClick={() => setEdit({ isNew: true })}><Plus /> إضافة للمنيو</button>
        </div>
      </div>

      <div className="banner" style={{ background: 'var(--brand-2)' }}>
        <Eye /><span>في المنيو الحين <b className="num">{shownCount}</b> سعر. الأصناف اللي تضيفها هنا تقدر تكمّل وصفتها وتكلفتها بعدين من صفحة المنتجات.</span>
      </div>

      {!groups.length ? (
        <Empty title="المنيو فاضي" action={<button className="btn primary" onClick={() => setEdit({ isNew: true })}><Plus /> أضف أول صنف</button>}>أضف اسم الصنف وأحجامه وأسعاره، ويطلع للزبون مباشرة.</Empty>
      ) : groups.map(({ cat, rows }) => (
        <section className="list-group" key={cat}>
          <h3>{cat}</h3>
          <div className="list">
            {rows.map((r, i) => {
              const visible = r.items.some((p) => p.on_menu);
              return (
                <div className="item menu-admin-row" key={r.key} style={{ cursor: 'default', opacity: visible ? 1 : 0.55 }}>
                  <span className="item-title">
                    {r.name}
                    {!visible && <span className="chip">مخفي</span>}
                    {r.items.every((p) => !(p.items || []).some((it) => it.id)) && <span className="chip">بدون وصفة</span>}
                  </span>
                  <span className="item-sub chips" style={{ marginTop: 4 }}>
                    {r.items.map((p) => (
                      <span key={p.id} className="chip" style={{ opacity: p.on_menu ? 1 : 0.5 }}>
                        {p.size || 'السعر'} <b className="num">{Number(p.sell_price) ? money(Number(p.sell_price)) : '—'}</b>
                      </span>
                    ))}
                  </span>
                  <span className="item-end">
                    <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                      <button className="btn icon ghost" aria-label="لفوق" disabled={i === 0} onClick={() => move(rows, i, -1)}><ChevronUp size={18} /></button>
                      <button className="btn icon ghost" aria-label="لتحت" disabled={i === rows.length - 1} onClick={() => move(rows, i, 1)}><ChevronDown size={18} /></button>
                      <button className="btn icon ghost" aria-label={visible ? 'اخفه' : 'أظهره'} title={visible ? 'اخفه من المنيو' : 'أظهره في المنيو'} onClick={() => setVisible(r, !visible)}>{visible ? <Eye size={18} /> : <EyeOff size={18} />}</button>
                      <button className="btn sm" onClick={() => setEdit({ row: r })}><Pencil size={15} /> تعديل</button>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {hidden.length > 0 && <p className="muted small" style={{ marginTop: 16 }}>المخفي ({hidden.length}) يبقى محفوظ بوصفته وتكلفته، وتقدر ترجعه بزر العين.</p>}

      {edit && <MenuItemDialog {...edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function MenuItemDialog({ isNew, row, onClose }) {
  const { products, saveRows, settings } = useStore();
  const cats = [...new Set(products.filter((p) => !p.is_component).map((p) => p.category).filter(Boolean))];
  const first = row?.items[0];
  const [name, setName] = useState(row?.name || '');
  const [nameEn, setNameEn] = useState(first?.name_en || '');
  const [category, setCategory] = useState(row?.category === 'بدون تصنيف' ? '' : row?.category || cats[0] || '');
  const [desc, setDesc] = useState(first?.description || '');
  const [sizes, setSizes] = useState(() => (row ? row.items.map((p) => ({ id: p.id, size: p.size || '', price: p.sell_price, on: p.on_menu })) : [{ size: '', price: '', on: true }]));
  const [err, setErr] = useState('');

  const usePreset = (list) => setSizes(list.map((s) => ({ size: s, price: '', on: true })));
  const setSize = (i, patch) => setSizes((x) => x.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const allSizes = [...new Set([...PRESETS.flatMap(([, l]) => l), ...products.map((p) => p.size)].filter(Boolean))];

  const save = async () => {
    const n = name.trim();
    const live = sizes.filter((s) => s.id || s.price !== '' || s.size);
    if (!n) return setErr('اكتب اسم الصنف.');
    if (!live.length) return setErr('أضف سعر واحد على الأقل.');
    if (live.some((s) => !(Number(s.price) > 0) && s.on)) return setErr('كل حجم ظاهر لازم يكون له سعر.');
    const dup = new Set();
    for (const s of live) { if (dup.has(s.size.trim())) return setErr(`الحجم «${s.size || 'بدون حجم'}» مكرر.`); dup.add(s.size.trim()); }
    if (isNew && products.some((p) => !p.is_component && p.name === n && (p.category || '') === category.trim())) return setErr(`«${n}» موجود في هالتصنيف. عدّله من القائمة بدل ما تضيفه مرة ثانية.`);

    const maxSort = Math.max(0, ...products.map((p) => p.sort ?? 0));
    const baseSort = row ? Math.min(...row.items.map((p) => p.sort ?? 0)) : maxSort + 1;
    const rows = live.map((s, k) => {
      const prev = s.id && products.find((p) => p.id === s.id);
      return {
        size: '', description: '', serving_ml: null, serving_unit: 'ml', waste_pct: Number(settings.default_waste) || 0,
        price_includes_vat: true, is_component: false, yield_qty: 1, yield_unit: 'pcs', items: [], kind: 'product', description_en: '', image_url: '',
        ...(prev || {}),
        id: prev?.id || crypto.randomUUID(),
        name: n, name_en: nameEn.trim(), category: category.trim(), description: desc.trim(),
        size: s.size.trim(), sell_price: Number(s.price) || 0, on_menu: s.on, sort: baseSort + k * 0.01,
      };
    });
    // الأحجام اللي انشالت من القائمة: نخفيها بدل ما نحذفها (عشان المبيعات والوصفات)
    const removed = (row?.items || []).filter((p) => !live.some((s) => s.id === p.id)).map((p) => ({ ...p, on_menu: false }));
    await saveRows('products', [...rows, ...removed], isNew ? `انضاف «${n}» للمنيو` : 'انحفظ');
    onClose();
  };

  return (
    <Modal onClose={onClose}>
      <div className="grid">
        <h2>{isNew ? 'إضافة صنف للمنيو' : `تعديل «${row.name}»`}</h2>
        <div className="grid g2">
          <Field label="اسم الصنف"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: شاهي زعفران" autoFocus={isNew} /></Field>
          <Field label="التصنيف"><Combo value={category} onChange={setCategory} options={[...cats, 'الشاهي', 'القهوة', 'المشروبات الباردة', 'المخبوزات']} placeholder="اختر أو اكتب" label="التصنيف" /></Field>
        </div>
        <div className="grid g2">
          <Field label="الاسم بالإنجليزي (اختياري)"><input className="input" dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Saffron Tea" /></Field>
          <Field label="وصف قصير (اختياري)"><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="مثال: بالهيل والزعفران" /></Field>
        </div>

        <Field label="الأحجام والأسعار" group>
          {isNew && <div className="chips" style={{ marginBottom: 6 }}>{PRESETS.map(([l, list]) => <button type="button" key={l} className="filter-chip" onClick={() => usePreset(list)}>{l}</button>)}</div>}
          <div className="grid" style={{ gap: 8 }}>
            {sizes.map((s, i) => (
              <div key={i} className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
                <div style={{ flex: 1.3 }}><Combo value={s.size} onChange={(v) => setSize(i, { size: v })} options={allSizes} placeholder="بدون حجم" label={`الحجم ${i + 1}`} /></div>
                <div style={{ flex: 1 }}><NumInput value={s.price} onChange={(v) => setSize(i, { price: v })} suffix={CUR} aria-label={`السعر ${i + 1}`} /></div>
                <button type="button" className="btn icon ghost" aria-label="شيل الحجم" onClick={() => setSizes((x) => x.filter((_, j) => j !== i))} disabled={sizes.length === 1}><X size={16} /></button>
              </div>
            ))}
          </div>
          <button type="button" className="btn sm" style={{ justifySelf: 'start', marginTop: 4 }} onClick={() => setSizes((x) => [...x, { size: '', price: '', on: true }])}><Plus size={15} /> حجم ثاني</button>
          <small>{settings.vat_registered ? 'الأسعار شاملة الضريبة.' : 'السعر اللي يدفعه الزبون.'}{!isNew && ' الحجم اللي تشيله ينخفى من المنيو ويبقى محفوظ.'}</small>
        </Field>

        {err && <p role="alert" style={{ color: 'var(--bad)', margin: 0 }}>{err}</p>}
        <div className="row">
          <button className="btn primary" onClick={save}>{isNew ? 'أضف للمنيو' : 'حفظ'}</button>
          <button className="btn" onClick={onClose}>إلغاء</button>
          {!isNew && <><span className="spacer" /><button className="btn ghost" onClick={() => { onClose(); navigate('/products'); }}>الوصفة والتكلفة</button></>}
        </div>
      </div>
    </Modal>
  );
}
