import { useState } from 'react';
import { supabase } from '../lib/db.js';
import { Field, Logo } from '../components/ui.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message.includes('Invalid') ? 'الإيميل أو كلمة المرور غلط.' : `ما قدرنا ندخل: ${error.message}`);
  };
  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <div className="brand"><Logo /><div><b>مانس كوفي</b><span>حاسبة التكاليف</span></div></div>
        <Field label="الإيميل"><input className="input" type="email" dir="ltr" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="كلمة المرور"><input className="input" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'جاري الدخول…' : 'دخول'}</button>
        <a href="/menu" className="muted small" style={{ textAlign: 'center' }}>عرض المنيو</a>
      </form>
    </div>
  );
}
