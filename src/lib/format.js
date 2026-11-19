const nf = (min, max) => new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max });
const n2 = nf(2, 2);
const n0 = nf(0, 2);

export const money = (v) => (v == null || Number.isNaN(v) ? '—' : n2.format(v));
export const num = (v, max = 2) => (v == null || Number.isNaN(v) ? '—' : nf(0, max).format(v));
export const qty = (v) => n0.format(Number(v) || 0);
export const pct = (v) => (v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`);

/** تكلفة صغيرة جداً (مثل سعر المل) بأرقام مفيدة */
export function tiny(v) {
  if (!v) return '0';
  if (v >= 1) return n2.format(v);
  if (v >= 0.01) return nf(2, 3).format(v);
  return nf(4, 5).format(v);
}

export const CUR = 'ر.س';

export const date = (iso) =>
  new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'short', year: 'numeric' });

export const STATUS = {
  good: { label: 'ربح ممتاز', short: 'ممتاز' },
  warn: { label: 'ربح متوسط', short: 'متوسط' },
  bad: { label: 'ربح ضعيف', short: 'ضعيف' },
  none: { label: 'بدون سعر', short: '—' },
  norecipe: { label: 'بدون وصفة', short: 'بدون وصفة' },
};
