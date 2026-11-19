import { useEffect, useState } from 'react';
import { LayoutDashboard, CupSoda, Package, Calculator as CalcIcon, Settings as Gear, Tv, Info, Copy } from 'lucide-react';
import UPDATE_SQL from '../supabase/updates/002_units.sql?raw';
import { StoreProvider, useStore, useAuth } from './lib/store.jsx';
import { isRemote, schemaOutdated } from './lib/db.js';
import { Link, Logo, Toasts, usePath } from './components/ui.jsx';
import { useTheme } from './pages/Settings.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Materials from './pages/Materials.jsx';
import Products from './pages/Products.jsx';
import Calculator from './pages/Calculator.jsx';
import Settings from './pages/Settings.jsx';
import Menu from './pages/Menu.jsx';
import Report from './pages/Report.jsx';
import Login from './pages/Login.jsx';

const NAV = [
  ['/', 'الرئيسية', LayoutDashboard, Dashboard],
  ['/products', 'المنتجات', CupSoda, Products],
  ['/materials', 'المواد', Package, Materials],
  ['/calculator', 'الحاسبة', CalcIcon, Calculator],
  ['/settings', 'الإعدادات', Gear, Settings],
];
const EXTRA = { '/report': Report };

export default function App() {
  const path = usePath();
  useTheme();
  const session = useAuth();
  if (path === '/menu') return <Menu />;
  if (session === undefined) return <div className="login" aria-busy="true" />;
  if (!session) return <Login />;
  return (
    <StoreProvider enabled>
      <Shell path={path} />
    </StoreProvider>
  );
}

function Shell({ path }) {
  const { loading, error, toasts, settings, reload, toast } = useStore();
  const [outdated, setOutdated] = useState(schemaOutdated);
  useEffect(() => {
    const h = () => setOutdated(true);
    window.addEventListener('schema-outdated', h);
    return () => window.removeEventListener('schema-outdated', h);
  }, []);
  const Page = EXTRA[path] || NAV.find(([p]) => p === path)?.[3] || Dashboard;
  const nav = (cls) => NAV.map(([p, l, I]) => (
    <Link key={p} to={p} className="nav-link" aria-current={path === p ? 'page' : undefined}><I aria-hidden="true" />{l}</Link>
  ));
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><Logo /><div><b>{settings.shop_name}</b><span>حاسبة التكاليف</span></div></div>
        {nav()}
        <div className="side-foot">
          <Link to="/menu" className="nav-link" target="_blank"><Tv aria-hidden="true" />شاشة المنيو</Link>
        </div>
      </aside>
      <main className="main">
        {!isRemote && <div className="banner no-print"><Info />وضع تجريبي: البيانات محفوظة في هذا المتصفح بس. بعد ربط Supabase بتتزامن بين كل الأجهزة.</div>}
        {outdated && (
          <div className="banner no-print">
            <Info />
            <span style={{ flex: 1 }}>قاعدة البيانات تحتاج تحديث صغير عشان تنحفظ <b>الكثافة</b> و<b>وحدة حجم الكوب</b>. انسخ الكود والصقه في Supabase ← SQL Editor ← Run، وبعدها حدّث الصفحة.</span>
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(UPDATE_SQL); toast('انسخ كود التحديث'); }}><Copy size={16} /> انسخ الكود</button>
          </div>
        )}
        {error && <div className="banner no-print" style={{ background: 'var(--bad-soft)' }}><Info />ما قدرنا نحمّل البيانات: {error} <button className="btn sm" onClick={reload}>حاول مرة ثانية</button></div>}
        {loading ? <p className="muted">جاري التحميل…</p> : <Page />}
      </main>
      <nav className="tabbar" aria-label="التنقل">{nav()}</nav>
      <Toasts toasts={toasts} />
    </div>
  );
}
