import { useMemo, useState } from 'react';
import { Plus, Search, Trash2, Copy, X, Layers, Sparkles, ImagePlus, Gift, PlusCircle } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { makeCalc, suggestPrice } from '../lib/calc.js';
import { UNITS, unitsForBase, unitsForMaterial, baseOf, BASE_NAME } from '../lib/units.js';
import { money, num, pct, CUR } from '../lib/format.js';
import { Field, NumInput, Switch, Sheet, Empty, MarginChip, useConfirm, navigate, Combo, Select } from '../components/ui.jsx';
import { CostBar, Cup, colorLines, OTHER } from '../components/charts.jsx';

const SIZES = ['صغير', 'وسط', 'كبير'];
// أحجام الأكواب الشائعة حسب الوحدة
const CUP_SIZES = { ml: [120, 180, 240, 300, 350, 480], oz: [4, 6, 8, 10, 12, 16, 20], L: [0.25, 0.5, 1], cup: [0.5, 1, 1.5, 2] };
const SERVING_UNITS = ['ml', 'oz', 'L', 'cup'];

export const blankProduct = (s) => ({
  id: crypto.randomUUID(), name: '', size: '', category: '', description: '', serving_ml: 240, serving_unit: 'ml', waste_pct: Number(s.default_waste) || 0,
  sell_price: '', price_includes_vat: true, on_menu: true, is_component: false, yield_qty: 1, yield_unit: 'pcs', sort: 0, items: [], kind: 'product', name_en: '', description_en: '', image_url: '',
});

export default function Products() {
  const { products, calc, settings, saveProduct, deleteProduct, materials, loadSample } = useStore();
  const [q, setQ] = useState('');
  const [view, setView] = useState('sell');
  const [edit, setEdit] = useState(null);

  const viewOf = (p) => (p.is_component ? 'mix' : p.kind === 'addon' ? 'addon' : p.kind === 'combo' ? 'combo' : 'sell');
  const list = products.filter((p) => viewOf(p) === view && (!q || `${p.name} ${p.size}`.includes(q.trim())));
  const count = (v) => products.filter((p) => viewOf(p) === v).length;
  const groups = useMemo(() => {
    const g = new Map();
    for (const p of [...list].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, 'ar'))) {
      const k = p.category || 'بدون تصنيف';
      if (!g.has(k)) g.set(k, []);
      g.get(k).push(p);
    }
    return [...g];
  }, [list]);
  const mixCount = products.filter((p) => p.is_component).length;

  const openNew = () => setEdit({
    ...blankProduct(settings),
    ...(view === 'mix' ? { is_component: true, on_menu: false, yield_qty: 1, yield_unit: 'L', serving_ml: null } : {}),
    ...(view === 'addon' ? { kind: 'addon', category: 'الإضافات', serving_ml: null } : {}),
    ...(view === 'combo' ? { kind: 'combo', category: 'العروض', serving_ml: null } : {}),
    sort: products.length + 1,
  });
  const NEW_LABEL = { sell: 'منتج جديد', mix: 'خلطة جديدة', addon: 'إضافة جديدة', combo: 'عرض جديد' };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>المنتجات</h1>
          <p>كل كوب وش فيه، كم يكلف، وكم يربح.</p>
        </div>
        <button className="btn primary" onClick={openNew}><Plus /> {NEW_LABEL[view]}</button>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        <div className="seg" role="group" aria-label="نوع المنتجات">
          {[['sell', 'للبيع'], ['addon', 'الإضافات'], ['combo', 'العروض'], ['mix', 'الخلطات']].map(([v, l]) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)}>{l} {count(v) > 0 && <span className="num muted">({count(v)})</span>}</button>
          ))}
        </div>
        <div className="search"><Search aria-hidden="true" /><input className="input" placeholder="ابحث" value={q} onChange={(e) => setQ(e.target.value)} aria-label="بحث" /></div>
      </div>

      {view === 'addon' && <div className="banner"><PlusCircle />الإضافة شي ينضاف على أي مشروب بسعر: شوت إضافي، حليب نباتي، سيرب، زعفران. لها وصفة وتكلفة وربح مثل أي منتج، وتطلع في المنيو.</div>}
      {view === 'combo' && <div className="banner"><Gift />العرض يجمع أكثر من منتج بسعر واحد (مثل كرك + كوكيز). الموقع يقول لك كم يوفر الزبون، وهل العرض لسا رابح.</div>}
      {view === 'mix' && <div className="banner"><Layers />الخلطة شي تحضّره بكمية كبيرة (مثل خلطة كرك 2 لتر أو دلة قهوة) وتصب منه في أكثر من منتج. تكلفتها تنحسب مرة وحدة وتتوزع على كل كوب.</div>}

      {!materials.length && !products.length ? (
        <Empty title="أضف المواد أول" action={<div className="row" style={{ justifyContent: 'center' }}><button className="btn primary" onClick={() => navigate('/materials')}>روح للمواد</button><button className="btn" onClick={loadSample}>جرّب ببيانات تجريبية</button></div>}>
          المنتج يتكون من مواد، فلازم تضيف الحليب والشاي والأكواب قبل.
        </Empty>
      ) : !list.length ? (
        <Empty title={q ? 'ما لقينا شي' : { sell: 'ما فيه منتجات', mix: 'ما فيه خلطات', addon: 'ما فيه إضافات', combo: 'ما فيه عروض' }[view]} action={!q && <button className="btn primary" onClick={openNew}><Plus /> {NEW_LABEL[view]}</button>}>
          {q ? 'جرّب كلمة ثانية.' : { sell: 'سوّ أول منتج: اختر المكونات وكمية كل وحدة في الكوب.', mix: 'سوّ خلطة وبعدها استخدمها داخل أي منتج.', addon: 'مثلاً: شوت إسبريسو إضافي بـ 3 ريال.', combo: 'مثلاً: كرك + كوكيز بـ 9 ريال بدل 10.' }[view]}
        </Empty>
      ) : (
        groups.map(([g, ps]) => (
          <section className="list-group" key={g}>
            <h3>{g}</h3>
            <div className="list">
              {ps.map((p) => {
                const c = calc.product(p.id);
                return (
                  <button className="item" key={p.id} onClick={() => setEdit(structuredClone(p))}>
                    <span className="item-title">{p.name} {p.size && <span className="size-tag">{p.size}</span>} {!p.is_component && !p.on_menu && <span className="chip">مخفي من المنيو</span>}</span>
                    <span className="item-sub">
                      {p.is_component
                        ? <>تطلع <span className="num">{num(p.yield_qty)}</span> {UNITS[p.yield_unit]?.label} · تكلفتها <span className="num">{money(c.total)}</span> {CUR}</>
                        : <>تكلفة <span className="num">{money(c.total)}</span> · بيع <span className="num">{money(c.shelf)}</span> {CUR} · ربح <span className="num">{money(c.profit)}</span></>}
                    </span>
                    <span className="item-end">
                      {p.is_component
                        ? <><b className="num">{money(c.total / ((p.yield_qty || 1) * UNITS[p.yield_unit || 'pcs'].f) * (baseOf(p.yield_unit) === 'pcs' ? 1 : 100))}</b><span className="muted small">{CUR} {baseOf(p.yield_unit) === 'pcs' ? 'للحبة' : `لكل 100 ${UNITS[baseOf(p.yield_unit)].short}`}</span></>
                        : <MarginChip margin={c.margin} status={c.status} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}

      {edit && (
        <ProductEditor
          key={edit.id}
          initial={edit}
          isNew={!products.some((p) => p.id === edit.id)}
          onClose={() => setEdit(null)}
          onSave={async (p) => { setEdit(null); await saveProduct(p); }}
          onDelete={async (id) => { setEdit(null); await deleteProduct(id); }}
          onDuplicate={(p) => setEdit(p)}
        />
      )}
    </>
  );
}

function ProductEditor({ initial, isNew, onClose, onSave, onDelete, onDuplicate }) {
  const { materials, products, settings } = useStore();
  const [p, setP] = useState(initial);
  const [confirm, confirmUi] = useConfirm();
  const [dup, setDup] = useState(false);
  const set = (k) => (v) => setP((x) => ({ ...x, [k]: v }));

  // حساب حي يشمل التعديلات اللي ما انحفظت
  const live = useMemo(() => {
    const others = products.filter((x) => x.id !== p.id);
    return makeCalc(materials, [...others, p], settings).product(p.id);
  }, [p, materials, products, settings]);

  const usedBy = products.filter((x) => (x.items || []).some((it) => it.type === 'product' && it.id === p.id));
  // ما نسمح بدمج منتج داخل نفسه أو داخل منتج يحتويه
  const components = products.filter((x) => x.is_component && x.id !== p.id);
  const isCombo = p.kind === 'combo' && !p.is_component;
  const sellables = products.filter((x) => !x.is_component && x.kind !== 'combo' && x.id !== p.id).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  const [uploading, setUploading] = useState(false);
  const { uploadImage, toast } = useStore();
  const optionKey = (it) => `${it.type}:${it.id}`;

  const setItem = (i, patch) => setP((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) }));
  const removeItem = (i) => setP((x) => ({ ...x, items: x.items.filter((_, j) => j !== i) }));
  const addItem = () => setP((x) => ({ ...x, items: [...x.items, { type: 'material', id: '', qty: '', unit: 'ml' }] }));
  const allowedUnits = (it) => {
    if (!it.id) return [];
    if (it.type === 'product') return unitsForBase(baseOf(products.find((x) => x.id === it.id)?.yield_unit));
    return unitsForMaterial(materials.find((m) => m.id === it.id));
  };
  const pick = (i, key) => {
    const [type, id] = key.split(':');
    const allowed = allowedUnits({ type, id });
    const cur = p.items[i];
    const unit = allowed.includes(cur.unit) ? cur.unit : allowed[0] || 'pcs';
    setItem(i, { type, id, unit, qty: cur.qty || (baseOf(unit) === 'pcs' ? 1 : '') });
  };
  const sUnit = p.serving_unit || 'ml';
  const sF = UNITS[sUnit].f;

  const colored = colorLines(live.lines);
  const colorOf = (it) => colored.find((c) => c.id === it.id && c.type === it.type)?.color || OTHER;
  const sug = suggestPrice(live.total, settings);
  const valid = p.name.trim() && p.items.every((it) => it.id && Number(it.qty) > 0);
  const solids = live.lines.filter((l) => l.base !== 'ml' && l.baseQty > 0);

  const save = () => onSave({
    ...p, name: p.name.trim(), sell_price: Number(p.sell_price) || 0, waste_pct: Number(p.waste_pct) || 0,
    serving_ml: p.serving_ml === '' ? null : p.serving_ml, yield_qty: Number(p.yield_qty) || 1,
    items: p.items.map((it) => ({ ...it, qty: Number(it.qty) })),
  });

  return (
    <Sheet
      title={isNew ? (p.is_component ? 'خلطة جديدة' : { addon: 'إضافة جديدة', combo: 'عرض جديد' }[p.kind] || 'منتج جديد') : `${p.name}${p.size ? ` ${p.size}` : ''}`}
      onClose={onClose}
      actions={!isNew && <button className="btn sm" onClick={() => setDup(true)}><Copy /> نسخة بحجم ثاني</button>}
      footer={
        <>
          <button className="btn primary" disabled={!valid} onClick={save}>حفظ</button>
          <button className="btn" onClick={onClose}>إلغاء</button>
          <span className="spacer" />
          {!isNew && (
            <button className="btn ghost danger" onClick={async () => {
              const msg = usedBy.length ? `«${p.name}» مدموجة داخل ${usedBy.map((x) => x.name).join('، ')}. إذا حذفتها بتصير تكلفتهم ناقصة. متأكد؟` : `تحذف «${p.name}${p.size ? ' ' + p.size : ''}»؟`;
              if (await confirm(msg)) onDelete(p.id);
            }}><Trash2 /> حذف</button>
          )}
        </>
      }
    >
      <div className="panel grid">
        <div className="grid g2">
          <Field label={p.is_component ? 'اسم الخلطة' : 'اسم المنتج'}><input className="input" value={p.name} onChange={(e) => set('name')(e.target.value)} placeholder={p.is_component ? 'مثال: خلطة كرك' : 'مثال: كرك'} autoFocus={isNew} /></Field>
          <Field label="التصنيف">
            <Combo value={p.category} onChange={set('category')} options={[...products.map((x) => x.category), 'الشاهي', 'القهوة', 'المشروبات الباردة', 'المخبوزات', 'الإضافات', 'العروض']} placeholder="اختر أو اكتب تصنيف" label="التصنيف" />
          </Field>
        </div>
        {!p.is_component && (
          <Field label="النوع" group>
            <div className="seg" role="group">
              {[['product', 'منتج'], ['addon', 'إضافة'], ['combo', 'عرض / كومبو']].map(([k, l]) => (
                <button key={k} type="button" aria-pressed={(p.kind || 'product') === k} onClick={() => setP((x) => ({ ...x, kind: k, items: k === 'combo' || x.kind === 'combo' ? [] : x.items }))}>{l}</button>
              ))}
            </div>
          </Field>
        )}
        {!p.is_component && (p.kind || 'product') === 'product' && (
          <div className="grid g2">
            <Field label="الحجم">
              <Combo value={p.size} onChange={set('size')} options={[...SIZES, ...products.map((x) => x.size)]} placeholder="اختر أو اكتب الحجم" label="الحجم" />
            </Field>
            <Field label="حجم الكوب" hint={sUnit !== 'ml' && p.serving_ml ? `= ${num(p.serving_ml, 0)} مل` : ''}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <NumInput value={p.serving_ml ? +(p.serving_ml / sF).toFixed(2) : ''} onChange={(v) => set('serving_ml')(v === '' ? '' : +(v * sF).toFixed(1))} />
                <Select className="select input" style={{ width: 150 }} value={sUnit} onChange={(e) => set('serving_unit')(e.target.value)} aria-label="وحدة حجم الكوب">
                  {SERVING_UNITS.map((u) => <option key={u} value={u}>{UNITS[u].label}</option>)}
                </Select>
              </div>
              <div className="chips" style={{ marginTop: 4 }}>{CUP_SIZES[sUnit].map((v) => <button type="button" key={v} className="filter-chip" style={{ padding: '2px 10px', fontSize: 13 }} aria-pressed={Math.abs(Number(p.serving_ml) - v * sF) < 0.5} onClick={() => set('serving_ml')(+(v * sF).toFixed(1))}><span className="num">{v}</span> {UNITS[sUnit].short}</button>)}</div>
            </Field>
          </div>
        )}
        {(p.kind || 'product') === 'product' && <Switch checked={p.is_component} onChange={(v) => setP((x) => ({ ...x, is_component: v, on_menu: v ? false : x.on_menu, yield_unit: v ? (x.yield_unit === 'pcs' ? 'L' : x.yield_unit) : 'pcs', yield_qty: v ? x.yield_qty : 1 }))}
          label="هذي خلطة تنصب في منتجات ثانية" hint="مثل خلطة الكرك أو دلة القهوة. ما تطلع في المنيو." />}
        {p.is_component && (
          <Field label="كم تطلع الخلطة؟" hint="الكمية الجاهزة بعد التحضير. منها تنحسب تكلفة كل مل في الكوب.">
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <NumInput value={p.yield_qty} onChange={set('yield_qty')} />
              <Select className="select input" style={{ width: 170 }} value={p.yield_unit} onChange={(e) => set('yield_unit')(e.target.value)}>
                {['ml', 'g', 'pcs'].map((b) => <optgroup key={b} label={BASE_NAME[b]}>{unitsForBase(b).map((u) => <option key={u} value={u}>{UNITS[u].label}</option>)}</optgroup>)}
              </Select>
            </div>
          </Field>
        )}
      </div>

      {/* المكونات + الكوب */}
      <div className="panel">
        <div className="panel-head">
          <h3>{p.is_component ? 'وش يدخل في الخلطة' : isCombo ? 'وش في العرض' : p.kind === 'addon' ? 'وش في الإضافة' : 'وش يدخل في الكوب'}</h3>
          <span className="muted small">الكمية لكل {p.is_component ? 'خلطة' : isCombo ? 'عرض' : p.kind === 'addon' ? 'إضافة' : 'كوب'}</span>
        </div>

        {!p.is_component && (p.kind || 'product') === 'product' && (
          <div className="cup-panel" style={{ marginBottom: 14 }}>
            <Cup lines={live.lines} servingMl={Number(p.serving_ml) || 0} liquidMl={live.liquidMl} />
            <div>
              <div className="cup-label">السوائل في الكوب</div>
              <div className="cup-fill-text">
                <b className="num" style={{ fontSize: 26 }}>{num(live.liquidMl, 0)}</b>
                {p.serving_ml ? <> من <span className="num">{num(p.serving_ml, 0)}</span> مل</> : ' مل'}
              </div>
              {p.serving_ml > 0 && live.liquidMl > p.serving_ml && <span className="chip bad">السوائل أكثر من حجم الكوب بـ <span className="num">{num(live.liquidMl - p.serving_ml, 0)}</span> مل</span>}
              {p.serving_ml > 0 && live.liquidMl > 0 && live.liquidMl <= p.serving_ml && <span className="chip">معبأ <span className="num">{pct(live.liquidMl / p.serving_ml)}</span></span>}
              {solids.length > 0 && (
                <div className="cup-solids">
                  {solids.map((l, i) => <span className="chip" key={i}>{l.name} <span className="num">{num(l.qty, 2)}</span> {UNITS[l.unit]?.short}</span>)}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="ing-list">
          {p.items.map((it, i) => {
            const line = live.lines[i];
            const allowed = allowedUnits(it);
            const bases = [...new Set(allowed.map(baseOf))];
            return (
              <div className="ing" key={i}>
                <span className="dot" style={{ background: it.id ? colorOf(it) : 'transparent' }} />
                <Select className="select input ing-name" value={it.id ? optionKey(it) : ''} onChange={(e) => pick(i, e.target.value)} aria-label="المكوّن">
                  <option value="" disabled>اختر مكوّن…</option>
                  {isCombo && <optgroup label="المنتجات">{sellables.map((c) => <option key={c.id} value={`product:${c.id}`}>{c.name}{c.size ? ` ${c.size}` : ''}</option>)}</optgroup>}
                  {components.length > 0 && <optgroup label="خلطات">{components.map((c) => <option key={c.id} value={`product:${c.id}`}>{c.name}</option>)}</optgroup>}
                  <optgroup label="مواد">{[...materials].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((m) => <option key={m.id} value={`material:${m.id}`}>{m.name}</option>)}</optgroup>
                </Select>
                <div className="ing-qty"><NumInput value={it.qty} onChange={(v) => setItem(i, { qty: v })} aria-label="الكمية" /></div>
                <Select className="select input ing-unit" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} aria-label="الوحدة" disabled={!allowed.length}>
                  {!allowed.length && <option value={it.unit}>{UNITS[it.unit]?.label}</option>}
                  {bases.length > 1
                    ? bases.map((b) => <optgroup key={b} label={BASE_NAME[b]}>{allowed.filter((u) => baseOf(u) === b).map((u) => <option key={u} value={u}>{UNITS[u].label}</option>)}</optgroup>)
                    : allowed.map((u) => <option key={u} value={u}>{UNITS[u].label}</option>)}
                </Select>
                <span className="ing-cost num">{line && it.id ? money(line.cost) : ''}</span>
                <button className="btn icon ghost del" style={{ width: 34, minHeight: 34 }} onClick={() => removeItem(i)} aria-label="شيل المكوّن"><X size={16} /></button>
              </div>
            );
          })}
        </div>
        <button className="btn" style={{ marginTop: 10 }} onClick={addItem}><Plus /> إضافة مكوّن</button>
        {live.issues.length > 0 && <ul className="err-list">{[...new Set(live.issues)].map((x) => <li key={x}>{x}</li>)}</ul>}

        <div style={{ marginTop: 18 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className="muted small">من وين تجي التكلفة</span>
            <span><span className="muted small">تكلفة {p.is_component ? 'الخلطة' : isCombo ? 'العرض' : p.kind === 'addon' ? 'الإضافة' : 'الكوب'} </span><b className="num" style={{ fontSize: 20 }}>{money(live.total)}</b> {CUR}</span>
          </div>
          <CostBar lines={live.lines} total={live.raw} />
        </div>
        <div className="grid g2" style={{ marginTop: 14 }}>
          <Field label="نسبة الهدر" hint={live.waste > 0 ? `تضيف ${money(live.waste)} ${CUR} للتكلفة` : 'اللي ينكب أو يتلف أثناء التحضير'}>
            <NumInput value={p.waste_pct} onChange={set('waste_pct')} suffix="%" />
          </Field>
          {p.is_component && (
            <div className="formula" style={{ alignSelf: 'end' }}>
              <div className="formula-result" style={{ border: 0, padding: 0 }}>
                <div><span>كل 1 {UNITS[baseOf(p.yield_unit)].short}</span><b className="num">{money(live.total / ((Number(p.yield_qty) || 1) * UNITS[p.yield_unit].f) * (baseOf(p.yield_unit) === 'pcs' ? 1 : 1))}</b></div>
                {baseOf(p.yield_unit) !== 'pcs' && <div><span>كل 100 {UNITS[baseOf(p.yield_unit)].short}</span><b className="num">{money(live.total / ((Number(p.yield_qty) || 1) * UNITS[p.yield_unit].f) * 100)} {CUR}</b></div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* التسعير */}
      {!p.is_component && (
        <div className="panel">
          <h3 style={{ marginBottom: 12 }}>السعر والربح</h3>
          <div className="grid g2">
            <Field label="سعر البيع"><NumInput value={p.sell_price} onChange={set('sell_price')} suffix={CUR} /></Field>
            {settings.vat_registered && <div style={{ alignSelf: 'center' }}><Switch checked={p.price_includes_vat} onChange={set('price_includes_vat')} label="السعر شامل الضريبة" hint={`الزبون يدفع ${money(live.shelf)} ${CUR}`} /></div>}
          </div>
          <div className="price-box">
            <div><span>التكلفة</span><b className="num">{money(live.total)}</b></div>
            <div className={live.status}><span>الربح{settings.vat_registered ? ' (بعد الضريبة)' : ''}</span><b className="num">{money(live.profit)}</b></div>
            <div className={live.status}><span>هامش الربح</span><b className="num">{pct(live.margin)}</b></div>
          </div>
          {live.total > 0 && (
            <div className="suggest">
              <Sparkles size={18} />
              <span>عشان تربح <span className="num">{settings.target_margin}%</span> بيعه بـ <b className="num">{money(sug.rounded)}</b> {CUR}{settings.vat_registered ? ' شامل الضريبة' : ''}</span>
              <span className="spacer" />
              {Number(p.sell_price) !== sug.rounded && (
                <button className="btn sm" onClick={() => setP((x) => ({ ...x, sell_price: settings.vat_registered && !x.price_includes_vat ? +sug.net.toFixed(2) : sug.rounded }))}>استخدم السعر</button>
              )}
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <Switch checked={p.on_menu} onChange={set('on_menu')} label="يظهر في منيو الزباين" />
          </div>
          {p.on_menu && (
            <div className="grid" style={{ marginTop: 12 }}>
              <div className="grid g2">
                <Field label="وصف قصير للمنيو (اختياري)"><input className="input" value={p.description || ''} onChange={(e) => set('description')(e.target.value)} placeholder="مثال: بالهيل والزعفران" /></Field>
                <Field label="الاسم بالإنجليزي"><input className="input" dir="ltr" value={p.name_en || ''} onChange={(e) => set('name_en')(e.target.value)} placeholder="Karak Tea" /></Field>
              </div>
              <Field label="الوصف بالإنجليزي"><input className="input" dir="ltr" value={p.description_en || ''} onChange={(e) => set('description_en')(e.target.value)} placeholder="With cardamom and saffron" /></Field>
              <Field label="صورة للمنيو" hint="تطلع في المنيو لما تفعّل عرض الصور. الأفضل صورة مربعة.">
                <div className="row">
                  {p.image_url && <img src={p.image_url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--line)' }} />}
                  <label className="btn sm" style={{ cursor: 'pointer' }}>
                    <ImagePlus size={16} /> {uploading ? 'جاري الرفع…' : p.image_url ? 'غيّر الصورة' : 'ارفع صورة'}
                    <input type="file" accept="image/*" hidden disabled={uploading} onChange={async (e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      setUploading(true);
                      try { set('image_url')(await uploadImage(await shrink(f))); } catch (err) { toast(`ما انرفعت: ${err.message}`, 'err'); }
                      setUploading(false);
                    }} />
                  </label>
                  {p.image_url && <button type="button" className="btn sm ghost" onClick={() => set('image_url')('')}>شيل الصورة</button>}
                </div>
              </Field>
            </div>
          )}
          {isCombo && live.itemsShelf > 0 && (
            <div className="suggest" style={{ background: 'var(--saffron-soft)' }}>
              <Gift size={18} />
              <span>منفردة بـ <b className="num">{money(live.itemsShelf)}</b> {CUR}. {live.shelf > 0 && live.shelf < live.itemsShelf ? <>الزبون يوفر <b className="num">{money(live.itemsShelf - live.shelf)}</b> (<span className="num">{pct(1 - live.shelf / live.itemsShelf)}</span>)</> : live.shelf >= live.itemsShelf ? 'سعر العرض مو أرخص من شراها منفردة.' : ''}</span>
            </div>
          )}
        </div>
      )}

      {dup && <DuplicateDialog p={p} onClose={() => setDup(false)} onDone={(copy) => { setDup(false); onDuplicate(copy); }} />}
      {confirmUi}
    </Sheet>
  );
}

/** نسخة بحجم ثاني مع تكبير/تصغير الكميات */
function DuplicateDialog({ p, onClose, onDone }) {
  const nextSize = SIZES[SIZES.indexOf(p.size) + 1] || '';
  const [size, setSize] = useState(nextSize);
  const [factor, setFactor] = useState(nextSize ? 1.33 : 1);
  return (
    <>
      <div className="sheet-back" style={{ zIndex: 60 }} onClick={onClose} />
      <div className="modal" style={{ zIndex: 61 }} role="dialog" aria-modal="true">
        <div className="panel grid">
          <h3>نسخة من {p.name} بحجم ثاني</h3>
          <Field label="الحجم الجديد"><Combo value={size} onChange={setSize} options={SIZES} label="الحجم الجديد" /></Field>
          <Field group label="كبّر الكميات" hint="الأكواب والأغطية (بالحبة) ما تتغير. غيّر نوع الكوب بنفسك بعد النسخ.">
            <div className="chips">{[0.75, 1, 1.25, 1.33, 1.5, 2].map((f) => <button key={f} className="filter-chip" aria-pressed={factor === f} onClick={() => setFactor(f)}>×<span className="num">{f}</span></button>)}</div>
          </Field>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={onClose}>رجوع</button>
            <button className="btn primary" onClick={() => onDone({
              ...structuredClone(p), id: crypto.randomUUID(), size, sort: (p.sort ?? 0) + 0.5,
              serving_ml: p.serving_ml ? Math.round(p.serving_ml * factor) : p.serving_ml,
              sell_price: p.sell_price ? Math.ceil(p.sell_price * factor * 2) / 2 : p.sell_price,
              items: p.items.map((it) => (baseOf(it.unit) === 'pcs' ? { ...it } : { ...it, qty: +(Number(it.qty) * factor).toFixed(2) })),
            })}>سوّ النسخة</button>
          </div>
        </div>
      </div>
    </>
  );
}

/** يصغّر الصورة قبل الرفع (أقصى 800px) */
async function shrink(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const img = await createImageBitmap(file);
  const k = Math.min(1, 800 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.82));
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
}
