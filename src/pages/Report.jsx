import { Printer, ArrowRight } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { money, pct, CUR, tiny } from '../lib/format.js';
import { costPerBase, materialBase } from '../lib/calc.js';
import { UNITS } from '../lib/units.js';
import { MarginChip, navigate } from '../components/ui.jsx';
import { packText } from './Materials.jsx';

export default function Report() {
  const { products, materials, calc, settings } = useStore();
  const sell = products.filter((p) => !p.is_component).map((p) => calc.product(p.id));
  const today = new Date().toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <div className="page-head">
        <div><h1>تقرير التكاليف</h1><p>{settings.shop_name} · {today}</p></div>
        <div className="row no-print">
          <button className="btn" onClick={() => navigate('/settings')}><ArrowRight /> رجوع</button>
          <button className="btn primary" onClick={() => window.print()}><Printer /> اطبع أو احفظ PDF</button>
        </div>
      </div>
      <p className="print-only muted small">{settings.vat_registered ? `منشأة مسجلة بالضريبة ${settings.vat_rate}%: التكلفة والربح بدون ضريبة.` : 'منشأة غير مسجلة بالضريبة: التكلفة شاملة ضريبة المشتريات.'} الهدف {settings.target_margin}%.</p>

      <section className="panel table-wrap">
        <h2 style={{ marginBottom: 10 }}>المنتجات</h2>
        <table className="table">
          <thead><tr><th>المنتج</th><th>الحجم</th><th className="n">التكلفة</th><th className="n">سعر البيع</th><th className="n">الربح</th><th className="n">الهامش</th></tr></thead>
          <tbody>
            {sell.map((c) => (
              <tr key={c.id}>
                <td>{c.product.name}</td><td>{c.product.size}</td>
                <td className="n num">{money(c.total)}</td><td className="n num">{money(c.shelf)}</td><td className="n num">{money(c.profit)}</td>
                <td className="n"><MarginChip margin={c.margin} status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel table-wrap" style={{ breakBefore: 'page' }}>
        <h2 style={{ marginBottom: 10 }}>المواد</h2>
        <table className="table">
          <thead><tr><th>المادة</th><th>العبوة</th><th className="n">السعر</th><th className="n">تكلفة الوحدة</th></tr></thead>
          <tbody>
            {[...materials].sort((a, b) => a.name.localeCompare(b.name, 'ar')).map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td><td>{packText(m)}</td><td className="n num">{money(Number(m.package_price))}</td>
                <td className="n"><span className="num">{tiny(costPerBase(m, settings))}</span> {CUR} / {UNITS[materialBase(m)].short}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="muted small">المتوسط: <span className="num">{pct(sell.filter((c) => c.margin != null).reduce((a, c, _, arr) => a + c.margin / arr.length, 0))}</span></p>
    </>
  );
}
