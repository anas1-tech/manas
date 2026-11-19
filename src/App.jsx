import { useEffect, useState } from 'react';
import { LayoutDashboard, CupSoda, Package, Calculator as CalcIcon, Settings as Gear, Tv, Info, Copy, Receipt, Boxes, Wallet, LayoutGrid, QrCode, LogOut, BookOpen } from 'lucide-react';
import UPDATE_SQL from '../supabase/updates/003_features.sql?raw';
import { StoreProvider, useStore, useAuth } from './lib/store.jsx';
import { isRemote, schemaOutdated, supabase } from './lib/db.js';
import { Link, Toasts, usePath } from './components/ui.jsx';
import Wordmark from './components/Wordmark.jsx';
import { useTheme } from './pages/Settings.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Materials from './pages/Materials.jsx';
import Products from './pages/Products.jsx';
import Calculator from './pages/Calculator.jsx';
import Settings from './pages/Settings.jsx';
import Menu from './pages/Menu.jsx';
import Report from './pages/Report.jsx';
import Login from './pages/Login.jsx';
import Sales from './pages/Sales.jsx';
import Expenses from './pages/Expenses.jsx';
import Inventory from './pages/Inventory.jsx';
import QR from './pages/QR.jsx';
import MenuAdmin from './pages/MenuAdmin.jsx';

// [المسار، الاسم، الأيقونة، الصفحة، للموظف؟، في شريط الجوال؟]
const NAV = [
  ['/', 'الرئيسية', LayoutDashboard, Dashboard, false, true],
  ['/sales', 'المبيعات', Receipt, Sales, true, true],
  ['/menu-admin', 'المنيو', BookOpen, MenuAdmin, false, true],
  ['/products', 'المنتجات', CupSoda, Products, false, true],
  ['/materials', 'المواد', Package, Materials, false, false],
  ['/inventory', 'المخزون', Boxes, Inventory, false, false],
  ['/expenses', 'المصاريف', Wallet, Expenses, false, false],
  ['/calculator', 'الحاسبة', CalcIcon, Calculator, true, false],
  ['/settings', 'الإعدادات', Gear, Settings, false, false],
];
const EXTRA = { '/report': Report, '/qr': QR, '/more': More };

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
  const { loading, error, toasts, settings, reload, toast, isAdmin } = useStore();
  const [outdated, setOutdated] = useState(schemaOutdated);
  useEffect(() => {
    const h = () => setOutdated(true);
    window.addEventListener('schema-outdated', h);
    return () => window.removeEventListener('schema-outdated', h);
  }, []);
  const allowed = NAV.filter((n) => isAdmin || n[4]);
  const found = allowed.find(([p]) => p === path)?.[3] || (isAdmin || path === '/more' ? EXTRA[path] : null);
  const Page = found || (isAdmin ? Dashboard : Sales);
  const link = ([p, l, I]) => <Link key={p} to={p} className="nav-link" aria-current={path === p ? 'page' : undefined}><I aria-hidden="true" />{l}</Link>;
  const mobile = isAdmin ? [...NAV.filter((n) => n[5]), ['/more', 'المزيد', LayoutGrid]] : [...allowed, ['/more', 'المزيد', LayoutGrid]];
  return (
    <div className="app">
      <aside className="side">
        <Link to="/" className="brand"><Wordmark title={settings.shop_name} /><span>حاسبة التكاليف</span></Link>
        {allowed.map(link)}
        <div className="side-foot">
          <Link to="/menu" className="nav-link" target="_blank"><Tv aria-hidden="true" />شاشة المنيو</Link>
          {isRemote && <button className="nav-link" onClick={() => supabase.auth.signOut()}><LogOut aria-hidden="true" />خروج</button>}
        </div>
      </aside>
      <main className="main">
        {!isRemote && <div className="banner no-print"><Info />وضع تجريبي: البيانات محفوظة في هذا المتصفح بس. بعد ربط Supabase بتتزامن بين كل الأجهزة.</div>}
        {outdated && isAdmin && (
          <div className="banner no-print">
            <Info />
            <span style={{ flex: 1 }}>قاعدة البيانات تحتاج تحديث عشان تشتغل <b>المبيعات والمخزون والمصاريف والموردين والموظفين والصور</b>. انسخ الكود والصقه في Supabase ← SQL Editor ← Run، وبعدها حدّث الصفحة.</span>
            <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(UPDATE_SQL); toast('انسخ كود التحديث'); }}><Copy size={16} /> انسخ الكود</button>
          </div>
        )}
        {error && <div className="banner no-print" style={{ background: 'var(--bad-soft)' }}><Info />ما قدرنا نحمّل البيانات: {error} <button className="btn sm" onClick={reload}>حاول مرة ثانية</button></div>}
        {loading ? <p className="muted">جاري التحميل…</p> : <Page />}
      </main>
      <nav className="tabbar" aria-label="التنقل" style={{ gridTemplateColumns: `repeat(${mobile.length}, 1fr)` }}>{mobile.map(link)}</nav>
      <Toasts toasts={toasts} />
    </div>
  );
}

/** صفحة «المزيد» للجوال */
function More() {
  const { isAdmin } = useStore();
  const items = [
    ...NAV.filter((n) => isAdmin || n[4]).map(([p, l, I]) => [p, l, I]),
    ...(isAdmin ? [['/qr', 'رمز QR للمنيو', QrCode], ['/report', 'تقرير التكاليف', Info]] : []),
  ];
  return (
    <>
      <div className="page-head"><div><h1>المزيد</h1></div></div>
      <div className="more-grid">
        {items.map(([p, l, I]) => <Link key={p} to={p} className="more-tile"><I aria-hidden="true" />{l}</Link>)}
        <Link to="/menu" className="more-tile" target="_blank"><Tv aria-hidden="true" />شاشة المنيو</Link>
        {isRemote && <button className="more-tile" onClick={() => supabase.auth.signOut()}><LogOut aria-hidden="true" />تسجيل خروج</button>}
      </div>
    </>
  );
}
