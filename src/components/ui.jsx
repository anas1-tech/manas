import { useEffect, useState, useSyncExternalStore } from 'react';
import { X, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus, CircleCheck, CircleAlert, OctagonAlert } from 'lucide-react';
import { STATUS, pct } from '../lib/format.js';

// ───────── التنقل ─────────
// BASE = '/mans-coffee-cost' على GitHub Pages، أو '' محلياً
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (to) => BASE + to;
const subs = new Set();
window.addEventListener('popstate', () => subs.forEach((f) => f()));
export function navigate(to) {
  if (href(to) === location.pathname + location.search) return;
  history.pushState(null, '', href(to));
  subs.forEach((f) => f());
  window.scrollTo(0, 0);
}
export const usePath = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => location.pathname.slice(BASE.length).replace(/(.)\/$/, '$1') || '/');
export function Link({ to, children, ...rest }) {
  return <a href={href(to)} onClick={(e) => { if (e.metaKey || e.ctrlKey || rest.target === '_blank') return; e.preventDefault(); navigate(to); }} {...rest}>{children}</a>;
}

// ───────── الشعار: استكانة شاي مع حبة هيل ─────────
export function Logo({ className = 'brand-mark' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="14" fill="var(--brand)" />
      <path d="M15 14h18l-2.6 7.2a6 6 0 0 0 0 4.1L33 34H15l2.6-8.7a6 6 0 0 0 0-4.1Z" fill="var(--brand-ink)" opacity=".95" />
      <path d="M17.3 22.6h13.4l-.5 1.4a6 6 0 0 0 0 3.6l1.9 5.4H16l1.6-5.4a6 6 0 0 0 0-3.6Z" fill="var(--saffron)" />
      <rect x="12" y="35.5" width="24" height="2.6" rx="1.3" fill="var(--brand-ink)" opacity=".95" />
    </svg>
  );
}

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

/** حقل رقم يقبل الأرقام العربية والفاصلة */
export function NumInput({ value, onChange, suffix, step = 'any', min = 0, ...rest }) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => {
    if (Number(String(text).replace(',', '.')) !== Number(value)) setText(value ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const input = (
    <input
      className="input num-in"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[٫,]/g, '.');
        if (!/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        onChange(raw === '' ? '' : Number(raw));
      }}
      onFocus={(e) => e.target.select()}
      step={step}
      min={min}
      {...rest}
    />
  );
  return suffix ? <div className="input-wrap">{input}<span className="suffix">{suffix}</span></div> : input;
}

export function Switch({ checked, onChange, label, hint }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="lbl">{label}{hint && <small>{hint}</small>}</span>
    </label>
  );
}

export function Seg({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

export function Sheet({ title, onClose, children, footer, actions }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [onClose]);
  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-head">
          <button className="btn icon ghost" onClick={onClose} aria-label="إغلاق"><X /></button>
          <h2>{title}</h2>
          {actions}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

export function Modal({ children, onClose }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <>
      <div className="sheet-back" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true"><div className="panel">{children}</div></div>
    </>
  );
}

/** تأكيد داخل الصفحة بدل confirm() */
export function useConfirm() {
  const [state, setState] = useState(null);
  const ask = (text, okLabel = 'احذف') => new Promise((resolve) => setState({ text, okLabel, resolve }));
  const ui = state && (
    <Modal onClose={() => { state.resolve(false); setState(null); }}>
      <p style={{ marginTop: 0, fontSize: 16 }}>{state.text}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={() => { state.resolve(false); setState(null); }}>رجوع</button>
        <button className="btn primary" style={{ background: 'var(--bad)', borderColor: 'var(--bad)', color: '#fff' }} onClick={() => { state.resolve(true); setState(null); }}>{state.okLabel}</button>
      </div>
    </Modal>
  );
  return [ask, ui];
}

const STATUS_ICON = { good: CircleCheck, warn: CircleAlert, bad: OctagonAlert };
export function MarginChip({ margin, status, withLabel = false }) {
  if (status === 'none' || margin == null) return <span className="chip">بدون سعر</span>;
  const I = STATUS_ICON[status];
  return (
    <span className={`chip ${status}`} title={STATUS[status].label}>
      <I aria-hidden="true" /> <span className="num">{pct(margin)}</span>{withLabel && ` ${STATUS[status].short}`}
    </span>
  );
}

export function Delta({ from, to }) {
  if (!from) return null;
  const d = (to - from) / from;
  const I = d > 0.0001 ? TrendingUp : d < -0.0001 ? TrendingDown : Minus;
  return (
    <span className={`delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}`}>
      <I aria-hidden="true" /> <span className="num">{d > 0 ? '+' : ''}{Math.round(d * 100)}%</span>
    </span>
  );
}

export function Toasts({ toasts }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.kind === 'err' ? <AlertTriangle /> : <CheckCircle2 />}{t.text}</div>
      ))}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
