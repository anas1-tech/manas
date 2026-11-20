import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { monthlyFixed, avgUnitProfit, breakEven, salesSummary, fullCost } from '../lib/calc.js';
import { money, num, CUR } from '../lib/format.js';
import { Field, NumInput, Modal, Empty, useConfirm, Combo, Select, Seg } from '../components/ui.jsx';

const PERIODS = { day: 'يومياً', week: 'أسبوعياً', month: 'شهرياً', year: 'سنوياً' };
const SUGGEST = ['إيجار', 'رواتب', 'كهرباء', 'ماء', 'إنترنت', 'اشتراك نقاط البيع', 'صيانة', 'تسويق', 'رخص وتجديدات', 'نظافة'];

export default function Expenses() {
  const { expenses, settings, calc, products, sales, saveRows, deleteRow, saveSettings, oh } = useStore();
  const [edit, setEdit] = useState(null);
  const [confirm, confirmUi] = useConfirm();
  const fixed = monthlyFixed(expenses, settings);
  const unit = avgUnitProfit(calc, products, sales);
  const be = breakEven(fixed, unit.value, settings);
  const month = today().slice(0, 8) + '01';
  const sold = salesSummary(sales, calc, month, today());
  const progress = be ? Math.min(sold.qty / be.perMonth, 1) : 0;
  const wd = Number(settings.working_days) || 30;

  return (
    <>
      <div className="page-head">
        <div><h1>المصاريف ونقطة التعادل</h1><p>كم لازم تبيع عشان تغطي الإيجار والرواتب، وكل كوب بعدها ربح صافي.</p></div>
        <button className="btn primary" onClick={() => setEdit({ id: crypto.randomUUID(), name: '', category: '', amount: '', period: 'month', notes: '' })}><Plus /> إضافة مصروف</button>
      </div>

      <div className="hero">
        <div className="hero-main">
          <h2>نقطة التعادل</h2>
          {be ? (
            <>
              <div className="big"><span className="num">{num(Math.ceil(be.perDay), 0)}</span> <span style={{ fontSize: '0.4em' }}>حبة يومياً</span></div>
              <p>يعني <span className="num">{num(Math.ceil(be.perMonth), 0)}</span> حبة بالشهر على <span className="num">{wd}</span> يوم شغل. ربح الحبة المتوسط <span className="num">{money(unit.value)}</span> {CUR} {unit.from === 'sales' ? 'من مبيعات آخر 30 يوم' : 'من متوسط المنتجات'}.</p>
            </>
          ) : (
            <>
              <div className="big">—</div>
              <p>{!fixed ? 'أضف مصاريفك الثابتة عشان نحسبها.' : 'أضف وصفات المنتجات عشان نعرف ربح الحبة.'}</p>
            </>
          )}
        </div>
        <div className="stats">
          <div className="stat"><span>المصاريف بالشهر</span><b className="num">{money(fixed)}</b><small>{CUR}</small></div>
          <div className="stat"><span>باليوم</span><b className="num">{money(fixed / wd)}</b><small>على {wd} يوم شغل</small></div>
          <div className="stat" style={{ gridColumn: '1 / -1' }}>
            <span>هالشهر بعت</span>
            <b className="num">{num(sold.qty, 0)} {be && <small className="muted">من {num(Math.ceil(be.perMonth), 0)}</small>}</b>
            {be && <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, marginTop: 8, overflow: 'hidden' }}><div style={{ width: `${progress * 100}%`, height: '100%', background: progress >= 1 ? 'var(--good)' : 'var(--saffron)', borderRadius: 99 }} /></div>}
            <small>{be ? (progress >= 1 ? 'غطيت المصاريف، والباقي ربح ✓' : `باقي ${num(Math.max(0, Math.ceil(be.perMonth - sold.qty)), 0)} حبة`) : ''}</small>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <span className="muted small">أيام الشغل بالشهر:</span>
        <div style={{ width: 110 }}><NumInput value={settings.working_days ?? 30} onChange={(v) => v && saveSettings({ working_days: Number(v) })} suffix="يوم" /></div>
      </div>

      {expenses.length > 0 && <Allocation oh={oh} settings={settings} saveSettings={saveSettings} calc={calc} products={products} />}

      {!expenses.length ? (
        <Empty title="ما فيه مصاريف" action={<button className="btn primary" onClick={() => setEdit({ id: crypto.randomUUID(), name: '', category: '', amount: '', period: 'month', notes: '' })}><Plus /> أضف أول مصروف</button>}>
          الإيجار، الرواتب، الكهرباء، الإنترنت… كل شي تدفعه سواء بعت أو ما بعت.
        </Empty>
      ) : (
        <div className="list">
          {expenses.map((e) => {
            const m = monthlyFixed([e], settings);
            return (
              <button className="item" key={e.id} onClick={() => setEdit({ ...e })}>
                <span className="item-title">{e.name}</span>
                <span className="item-sub"><span className="num">{money(Number(e.amount))}</span> {CUR} {PERIODS[e.period]}</span>
                <span className="item-end"><b className="num">{money(m)}</b><span className="muted small">بالشهر · <span className="num">{Math.round((m / fixed) * 100)}%</span></span></span>
              </button>
            );
          })}
        </div>
      )}

      {edit && (
        <Modal onClose={() => setEdit(null)}>
          <div className="grid">
            <h2>{expenses.some((x) => x.id === edit.id) ? 'تعديل مصروف' : 'مصروف جديد'}</h2>
            <Field label="الاسم">
              <Combo value={edit.name} onChange={(v) => setEdit({ ...edit, name: v })} options={SUGGEST} placeholder="اختر أو اكتب" label="الاسم" />
            </Field>
            <div className="grid g2">
              <Field label="المبلغ"><NumInput value={edit.amount} onChange={(v) => setEdit({ ...edit, amount: v })} suffix={CUR} /></Field>
              <Field label="كل">
                <Select className="select input" value={edit.period} onChange={(e) => setEdit({ ...edit, period: e.target.value })}>
                  {Object.entries(PERIODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </Select>
              </Field>
            </div>
            <div className="row">
              <button className="btn primary" disabled={!edit.name.trim() || !(Number(edit.amount) > 0)} onClick={() => { saveRows('expenses', [{ ...edit, name: edit.name.trim(), amount: Number(edit.amount) }], 'انحفظ المصروف'); setEdit(null); }}>حفظ</button>
              <button className="btn" onClick={() => setEdit(null)}>إلغاء</button>
              <span className="spacer" />
              {expenses.some((x) => x.id === edit.id) && <button className="btn ghost danger" onClick={async () => { if (await confirm(`تحذف «${edit.name}»؟`)) { deleteRow('expenses', edit.id, 'انحذف'); setEdit(null); } }}><Trash2 /> حذف</button>}
            </div>
          </div>
        </Modal>
      )}
      {confirmUi}
    </>
  );
}

const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

/** توزيع المصاريف على كل كوب أو منتج */
function Allocation({ oh, settings, saveSettings, calc, products }) {
  const [units, setUnits] = useState(settings.expected_units ?? '');
  const mode = settings.overhead_mode || 'unit';
  const sample = products.filter((p) => !p.is_component && p.kind !== 'addon' && Number(p.sell_price) > 0 && (p.items || []).some((it) => it.id)).slice(0, 6).map((p) => ({ p, c: calc.product(p.id) }));
  return (
    <section className="panel grid" style={{ marginBottom: 16 }}>
      <div className="panel-head" style={{ marginBottom: 0 }}>
        <h2>توزيع المصاريف على المنتجات</h2>
        <Seg value={mode} onChange={(v) => saveSettings({ overhead_mode: v })} label="طريقة التوزيع" options={[['unit', 'بالتساوي على كل حبة'], ['price', 'حسب سعر المنتج'], ['off', 'لا توزّع']]} />
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {mode === 'unit' && 'كل كوب أو حبة تبيعها تتحمل نفس المبلغ من الإيجار والكهرباء والرواتب.'}
        {mode === 'price' && 'المنتج الغالي يتحمل أكثر: كل ريال مبيعات يتحمل نفس النسبة من المصاريف.'}
        {mode === 'off' && 'التكلفة تحسب المواد بس، والمصاريف تطلع في نقطة التعادل والتقارير.'}
      </p>
      {mode !== 'off' && (
        <>
          <Field label="كم حبة تبيع بالشهر تقريباً؟" hint={oh.salesUnits > 0 ? `من مبيعاتك آخر 30 يوم: تقريباً ${num(Math.round(oh.salesUnits), 0)} حبة بالشهر. خلّه فاضي ويستخدمها تلقائياً.` : 'حط تقدير الحين، وبعد ما تسجّل مبيعات تقدر تفضّيه ويحسب من مبيعاتك الفعلية.'}>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <NumInput value={units} onChange={setUnits} suffix="حبة" placeholder={oh.salesUnits > 0 ? String(Math.round(oh.salesUnits)) : 'مثال: 3000'} />
              <button className="btn" disabled={String(units) === String(settings.expected_units ?? '')} onClick={() => saveSettings({ expected_units: units === '' ? null : Number(units) })}>حفظ</button>
            </div>
          </Field>
          {oh.active ? (
            <div className="formula">
              <div className="formula-line">
                مصاريف الشهر <b className="num">{money(oh.fixed)}</b> ÷ {mode === 'unit' ? <><b className="num">{num(Math.round(oh.units), 0)}</b> حبة</> : <>مبيعات <b className="num">{money(oh.revenue)}</b></>}
                <span className="muted">({oh.source === 'sales' ? 'من مبيعاتك' : 'من تقديرك'})</span>
              </div>
              <div className="formula-result">
                {mode === 'unit'
                  ? <div><span>كل حبة تتحمل</span><b className="num">{money(oh.perUnit)} {CUR}</b></div>
                  : <div><span>كل ريال مبيعات يتحمل</span><b className="num">{Math.round(oh.rate * 100)} هللة ({Math.round(oh.rate * 100)}%)</b></div>}
              </div>
            </div>
          ) : <p className="muted small" style={{ margin: 0 }}>حط كم حبة تبيع بالشهر عشان نحسب نصيب كل منتج.</p>}
          {oh.active && sample.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>المنتج</th><th className="n">المواد</th><th className="n">المصاريف</th><th className="n">التكلفة الكاملة</th><th className="n">السعر</th><th className="n">الصافي</th></tr></thead>
                <tbody>
                  {sample.map(({ p, c }) => {
                    const f = fullCost(c, oh);
                    return (
                      <tr key={p.id}>
                        <td>{p.name} <span className="muted">{p.size}</span></td>
                        <td className="n num">{money(c.total)}</td>
                        <td className="n num">{money(f.share)}</td>
                        <td className="n num"><b>{money(f.total)}</b></td>
                        <td className="n num">{money(c.shelf)}</td>
                        <td className="n num" style={{ color: f.netProfit < 0 ? 'var(--bad)' : 'var(--good)' }}>{money(f.netProfit)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
