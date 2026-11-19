import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { monthlyFixed, avgUnitProfit, breakEven, salesSummary } from '../lib/calc.js';
import { money, num, CUR } from '../lib/format.js';
import { Field, NumInput, Modal, Empty, useConfirm, Combo, Select } from '../components/ui.jsx';

const PERIODS = { day: 'يومياً', week: 'أسبوعياً', month: 'شهرياً', year: 'سنوياً' };
const SUGGEST = ['إيجار', 'رواتب', 'كهرباء', 'ماء', 'إنترنت', 'اشتراك نقاط البيع', 'صيانة', 'تسويق', 'رخص وتجديدات', 'نظافة'];

export default function Expenses() {
  const { expenses, settings, calc, products, sales, saveRows, deleteRow, saveSettings } = useStore();
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
