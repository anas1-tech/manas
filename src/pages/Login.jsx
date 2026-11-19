import { useState } from 'react';
import { supabase } from '../lib/db.js';
import { Field, Link } from '../components/ui.jsx';
import Wordmark from '../components/Wordmark.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const id = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({ email: id.includes('@') ? id : `${id}@example.com`, password });
    setBusy(false);
    if (error) setErr(error.message.includes('Invalid') ? 'اسم المستخدم أو كلمة المرور غلط.' : `ما قدرنا ندخل: ${error.message}`);
  };
  return (
    <div className="login">
      <form className="panel" onSubmit={submit}>
        <div className="brand login-brand"><Wordmark /><span>حاسبة التكاليف</span></div>
        <Field label="اسم المستخدم أو الإيميل"><input className="input" type="text" dir="ltr" autoComplete="username" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
        <Field label="كلمة المرور"><input className="input" type="password" dir="ltr" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></Field>
        {err && <p style={{ color: 'var(--bad)', margin: 0 }} role="alert">{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? 'جاري الدخول…' : 'دخول'}</button>
        <Link to="/menu" className="muted small" style={{ textAlign: 'center' }}>عرض المنيو</Link>
      </form>
    </div>
  );
}
