import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Printer, Download, ArrowRight } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import { href, navigate, Seg } from '../components/ui.jsx';
import Wordmark from '../components/Wordmark.jsx';
import { BRAND_EN } from '../lib/brand.js';

/** بطاقة QR للمنيو: تنطبع وتنحط على الطاولات أو الواجهة */
export default function QR() {
  const { settings } = useStore();
  const [lang, setLang] = useState('');
  const url = location.origin + href('/menu') + (lang ? `?lang=${lang}` : '');
  const [svg, setSvg] = useState('');
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1c2620', light: '#ffffff' } }).then(setSvg);
  }, [url]);
  const download = async () => {
    const data = await QRCode.toDataURL(url, { width: 1200, margin: 2, color: { dark: '#1c2620', light: '#ffffff' } });
    Object.assign(document.createElement('a'), { href: data, download: 'منيو-QR.png' }).click();
  };
  return (
    <>
      <div className="page-head no-print">
        <div><h1>رمز QR للمنيو</h1><p>الزبون يصوّره بالجوال ويفتح المنيو بأسعاره المحدثة.</p></div>
        <div className="row">
          <button className="btn" onClick={() => navigate('/settings')}><ArrowRight /> رجوع</button>
          <button className="btn" onClick={download}><Download /> تنزيل صورة</button>
          <button className="btn primary" onClick={() => window.print()}><Printer /> اطبع البطاقة</button>
        </div>
      </div>
      <div className="row no-print" style={{ marginBottom: 16 }}>
        <span className="muted small">لغة المنيو:</span>
        <Seg value={lang} onChange={setLang} label="اللغة" options={[['', 'عربي'], ['both', 'عربي + EN'], ['en', 'English']]} />
      </div>
      <div className="qr-sheet">
        {[0, 1, 2, 3].map((i) => (
          <div className="qr-card" key={i}>
            <Wordmark className="qr-logo" title={settings.shop_name} />
            <div className="qr-code" dangerouslySetInnerHTML={{ __html: svg }} />
            <div style={{ fontWeight: 600, fontSize: 18 }}>صوّر الرمز وشوف المنيو</div>
            <div className="muted small" dir="ltr">{BRAND_EN} · Scan for the menu</div>
          </div>
        ))}
      </div>
      <p className="muted small no-print" dir="ltr" style={{ textAlign: 'right' }}>{url}</p>
    </>
  );
}
