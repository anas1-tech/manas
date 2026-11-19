import { useEffect, useRef, useState } from 'react';
import { Download, Upload, FileSpreadsheet, Printer, LogOut, Smartphone, Tv, Copy, Database, Save, QrCode, Users, Trash2, UserPlus } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { isRemote, supabase } from '../lib/db.js';
const xl = () => import('../lib/excel.js');
import { Field, NumInput, Switch, Seg, Modal, Link, navigate, href } from '../components/ui.jsx';

let installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; });

export function useTheme() {
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') || 'auto'; } catch { return 'auto'; } });
  useEffect(() => {
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('theme', theme); } catch { /* ignore */ }
  }, [theme]);
  return [theme, setTheme];
}

export default function Settings() {
  const store = useStore();
  const { settings, saveSettings, materials, products, history, calc, importBatch, toast } = store;
  const [s, setS] = useState(settings);
  const [theme, setTheme] = useTheme();
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();
  const backupRef = useRef();
  useEffect(() => setS(settings), [settings]);
  const set = (k) => (v) => setS((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(s) !== JSON.stringify(settings);
  const menuUrl = location.origin + href('/menu');

  const onExcel = async (file) => {
    if (!file) return;
    try {
      const { parseWorkbook } = await xl();
      setPreview({ file: file.name, ...(await parseWorkbook(file, { materials, products })) });
    } catch (e) {
      toast(`ما قدرنا نقرأ الملف: ${e.message}`, 'err');
    }
    fileRef.current.value = '';
  };

  const backup = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exported_at: new Date().toISOString(), settings, materials, products, history }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const restore = async (file) => {
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.materials) || !Array.isArray(d.products)) throw new Error('الملف مو نسخة احتياطية من هذا الموقع');
      await importBatch({ materials: d.materials, products: d.products, history: d.history || [] }, 'رجعت النسخة الاحتياطية');
      if (d.settings) await saveSettings(d.settings);
    } catch (e) { toast(e.message, 'err'); }
    backupRef.current.value = '';
  };

  return (
    <>
      <div className="page-head"><div><h1>الإعدادات</h1><p>الضريبة، الهدف، والاستيراد من Excel.</p></div></div>

      <div className="grid g2" style={{ alignItems: 'start' }}>
        <div>
          <section className="panel grid">
            <h2>المحل</h2>
            <Field label="اسم المحل"><input className="input" value={s.shop_name} onChange={(e) => set('shop_name')(e.target.value)} /></Field>
            <Field label="سطر أسفل المنيو" hint="مثال: ساعات العمل أو رقم الطلبات"><input className="input" value={s.menu_note || ''} onChange={(e) => set('menu_note')(e.target.value)} /></Field>
            <Field label="لغة المنيو الافتراضية" group>
              <Seg value={s.menu_lang || 'ar'} onChange={set('menu_lang')} label="لغة المنيو" options={[['ar', 'عربي'], ['both', 'عربي + إنجليزي'], ['en', 'English']]} />
            </Field>
          </section>

          <section className="panel grid">
            <h2>الضريبة والربح</h2>
            <Switch checked={s.vat_registered} onChange={set('vat_registered')} label="المنشأة مسجلة في ضريبة القيمة المضافة"
              hint={s.vat_registered ? 'التكلفة تنحسب بدون ضريبة (تسترجعها)، والربح ينحسب بعد ما تطلع ضريبة البيع.' : 'الضريبة اللي تدفعها على المشتريات تنحسب ضمن التكلفة.'} />
            <div className="grid g2">
              <Field label="نسبة الضريبة"><NumInput value={s.vat_rate} onChange={set('vat_rate')} suffix="%" /></Field>
              <Field label="هدف هامش الربح" hint="محلات القهوة عادة بين 60% و75%"><NumInput value={s.target_margin} onChange={set('target_margin')} suffix="%" /></Field>
            </div>
            <Field label="نسبة الهدر الافتراضية للمنتجات الجديدة"><NumInput value={s.default_waste} onChange={set('default_waste')} suffix="%" /></Field>
          </section>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={!dirty} onClick={() => saveSettings({ ...s, vat_rate: Number(s.vat_rate) || 0, target_margin: Number(s.target_margin) || 0, default_waste: Number(s.default_waste) || 0 })}><Save /> حفظ الإعدادات</button>
          </div>

          <section className="panel grid" style={{ marginTop: 16 }}>
            <h2>الشكل</h2>
            <Seg value={theme} onChange={setTheme} label="المظهر" options={[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']]} />
          </section>
        </div>

        <div>
          <section className="panel grid">
            <h2>Excel</h2>
            <p className="muted small" style={{ margin: 0 }}>حمّل النموذج، عبّه بالمواد والمنتجات والوصفات، وارفعه هنا. الموقع يحدّث الموجود ويضيف الجديد.</p>
            <div className="row">
              <button className="btn" onClick={async () => (await xl()).downloadTemplate()}><FileSpreadsheet /> نموذج فاضي</button>
              <button className="btn" onClick={async () => (await xl()).downloadTemplate(materials, products, 'بياناتي.xlsx')} disabled={!materials.length}><Download /> بياناتي الحالية</button>
              <button className="btn primary" onClick={() => fileRef.current.click()}><Upload /> رفع ملف Excel</button>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onExcel(e.target.files[0])} />
            </div>
          </section>

          <section className="panel grid">
            <h2>تقارير</h2>
            <div className="row">
              <button className="btn" onClick={() => navigate('/report')}><Printer /> تقرير للطباعة أو PDF</button>
              <button className="btn" onClick={async () => (await xl()).downloadReport(calc, products)} disabled={!products.length}><FileSpreadsheet /> تقرير Excel</button>
            </div>
          </section>

          <section className="panel grid">
            <h2>شاشة المنيو</h2>
            <p className="muted small" style={{ margin: 0 }}>افتح هالرابط على شاشة أو تلفزيون في المحل. يفتح بدون كلمة مرور ويتحدث كل دقيقة. فيه الأسعار بس، بدون التكاليف.</p>
            <div className="row">
              <Link to="/menu" className="btn" target="_blank"><Tv /> افتح المنيو</Link>
              <button className="btn" onClick={() => { navigator.clipboard?.writeText(menuUrl); toast('انسخ الرابط'); }}><Copy /> انسخ الرابط</button>
              <button className="btn" onClick={() => navigate('/qr')}><QrCode /> رمز QR</button>
            </div>
          </section>

          <StaffSection />

          <section className="panel grid">
            <h2>الجهاز والبيانات</h2>
            <div className="row">
              <button className="btn" onClick={async () => { if (installEvt) { installEvt.prompt(); installEvt = null; } else toast('من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية»'); }}><Smartphone /> ثبّت كتطبيق</button>
              <button className="btn" onClick={backup}><Database /> نسخة احتياطية</button>
              <button className="btn" onClick={() => backupRef.current.click()}><Upload /> استرجاع نسخة</button>
              <input ref={backupRef} type="file" accept=".json" hidden onChange={(e) => restore(e.target.files[0])} />
            </div>
            {isRemote ? (
              <button className="btn danger" style={{ justifySelf: 'start' }} onClick={() => supabase.auth.signOut()}><LogOut /> تسجيل خروج</button>
            ) : (
              <p className="muted small" style={{ margin: 0 }}>وضع تجريبي: البيانات محفوظة على هذا الجهاز بس.</p>
            )}
          </section>
        </div>
      </div>

      {preview && <ImportPreview preview={preview} onClose={() => setPreview(null)} onApply={async () => { const p = preview; setPreview(null); await importBatch(p); }} />}
    </>
  );
}

function ImportPreview({ preview, onClose, onApply }) {
  const { summary: s, errors } = preview;
  const nothing = !preview.materials.length && !preview.products.length;
  return (
    <Modal onClose={onClose}>
      <h2 style={{ marginBottom: 6 }}>معاينة الاستيراد</h2>
      <p className="muted small" style={{ marginTop: 0 }}>{preview.file}</p>
      <table className="table">
        <tbody>
          <tr><td>مواد جديدة</td><td className="n num">{s.matNew}</td></tr>
          <tr><td>مواد بتتحدث</td><td className="n num">{s.matUpd}</td></tr>
          <tr><td>منتجات جديدة</td><td className="n num">{s.prodNew}</td></tr>
          <tr><td>منتجات بتتحدث</td><td className="n num">{s.prodUpd}</td></tr>
          <tr><td>سطور الوصفات</td><td className="n num">{s.recipes}</td></tr>
        </tbody>
      </table>
      {errors.length > 0 && (
        <>
          <p style={{ marginBottom: 0, color: 'var(--bad)', fontWeight: 500 }}>{errors.length} سطر فيه مشكلة وما راح ينضاف:</p>
          <ul className="err-list">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
        <button className="btn" onClick={onClose}>إلغاء</button>
        <button className="btn primary" disabled={nothing} onClick={onApply}>استورد</button>
      </div>
    </Modal>
  );
}

/** الموظفين: المدير يشوف كل شي، الموظف يسجل مبيعات ويشوف المنيو والحاسبة */
function StaffSection() {
  const { staff, saveRows, deleteRow, email: me } = useStore();
  const [name, setName] = useState('');
  const [user, setUser] = useState('');
  const [role, setRole] = useState('staff');
  const toEmail = (u) => (u.includes('@') ? u.trim().toLowerCase() : `${u.trim().toLowerCase()}@example.com`);
  const shown = (e) => e.replace(/@example\.com$/, '');
  return (
    <section className="panel grid">
      <h2><Users size={20} style={{ verticalAlign: -3 }} /> الموظفين</h2>
      <p className="muted small" style={{ margin: 0 }}>
        <b>الموظف</b> يسجل المبيعات ويشوف الأسعار والمنيو بس، بدون التكاليف والأرباح. <b>المدير</b> يشوف كل شي.
        <br />لإضافة موظف: سوّ له دخول في Supabase ← Authentication ← Add user بإيميل مثل <span dir="ltr">ali@example.com</span>، وبعدها أضفه هنا باسم المستخدم <span dir="ltr">ali</span>.
      </p>
      {staff.length > 0 && (
        <table className="table">
          <tbody>
            {staff.map((x) => (
              <tr key={x.email}>
                <td>{x.name || '—'}</td>
                <td dir="ltr" style={{ textAlign: 'right' }}>{shown(x.email)}</td>
                <td>
                  <select className="select input" style={{ minHeight: 34, padding: '4px 8px' }} value={x.role} disabled={x.email === me} onChange={(e) => saveRows('staff', [{ ...x, role: e.target.value }], 'تحدّثت الصلاحية')}>
                    <option value="admin">مدير</option><option value="staff">موظف</option>
                  </select>
                </td>
                <td style={{ width: 36 }}>{x.email !== me && <button className="btn icon ghost" style={{ width: 32, minHeight: 32 }} aria-label="شيل" onClick={() => deleteRow('staff', x.email, 'انشال')}><Trash2 size={15} /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="grid g2">
        <Field label="الاسم"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="اسم المستخدم أو الإيميل"><input className="input" dir="ltr" value={user} onChange={(e) => setUser(e.target.value)} /></Field>
      </div>
      <div className="row">
        <Seg value={role} onChange={setRole} label="الصلاحية" options={[['staff', 'موظف'], ['admin', 'مدير']]} />
        <button className="btn" disabled={!user.trim()} onClick={() => { saveRows('staff', [{ email: toEmail(user), name: name.trim(), role }], 'انضاف'); setName(''); setUser(''); }}><UserPlus size={16} /> أضف</button>
      </div>
    </section>
  );
}
