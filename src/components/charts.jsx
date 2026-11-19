import { useState } from 'react';
import { money, num, tiny, CUR, date, pct } from '../lib/format.js';
import { UNITS } from '../lib/units.js';

export const SERIES = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];
export const OTHER = 'var(--c6)';

/** يرتب السطور حسب التكلفة ويجمع الباقي في «أخرى» — اللون يتبع المكوّن */
export function colorLines(lines) {
  const sorted = [...lines].filter((l) => l.cost > 0).sort((a, b) => b.cost - a.cost);
  const top = sorted.slice(0, 5).map((l, i) => ({ ...l, color: SERIES[i] }));
  const rest = sorted.slice(5);
  if (rest.length) top.push({ name: `أخرى (${rest.length})`, cost: rest.reduce((a, l) => a + l.cost, 0), color: OTHER, key: 'other' });
  return top;
}

/** شريط مجزأ يوضح من وين تجي تكلفة الكوب */
export function CostBar({ lines, total }) {
  const [hover, setHover] = useState(null);
  const parts = colorLines(lines);
  if (!total || !parts.length) return <p className="muted small">أضف مكوّنات عشان تشوف توزيع التكلفة.</p>;
  return (
    <div>
      <div className="seg-bar" role="img" aria-label="توزيع تكلفة المكونات">
        {parts.map((p, i) => (
          <div
            key={i}
            style={{ flex: p.cost, background: p.color, opacity: hover == null || hover === i ? 1 : 0.35 }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            title={`${p.name}: ${money(p.cost)} ${CUR} (${pct(p.cost / total)})`}
          />
        ))}
      </div>
      <div className="legend">
        {parts.map((p, i) => (
          <span key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <i style={{ background: p.color }} />{p.name} <span className="num muted">{pct(p.cost / total)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * الكوب: يتعبّى بطبقات حسب كم مل من كل سائل،
 * ويقارن المجموع بحجم الكوب.
 */
export function Cup({ lines, servingMl, liquidMl }) {
  const colored = colorLines(lines);
  const colorOf = (l) => colored.find((c) => c.id === l.id && c.type === l.type)?.color || OTHER;
  const liquids = lines.filter((l) => l.base === 'ml' && l.baseQty > 0);
  const cap = Number(servingMl) || Math.max(liquidMl, 1);
  const H = 120, top = 14, bottom = 134;
  const over = servingMl && liquidMl > servingMl;
  const fillRatio = Math.min(liquidMl / cap, 1);
  let y = bottom;
  const layers = liquids.map((l) => {
    const h = (l.baseQty / cap) * H * (over ? cap / liquidMl : 1);
    y -= h;
    return { y, h, color: colorOf(l), name: l.name, ml: l.baseQty };
  });
  // شكل الكوب الورقي: أعرض فوق
  const xAt = (yy) => 14 + ((yy - top) / (bottom - top)) * 10;
  const clip = `M${xAt(top)} ${top} L${100 - xAt(top)} ${top} L${100 - xAt(bottom)} ${bottom} L${xAt(bottom)} ${bottom} Z`;
  return (
    <div className="cup">
      <svg viewBox="0 0 100 146" role="img" aria-label={`الكوب معبأ ${num(liquidMl, 0)} مل من ${servingMl ? num(servingMl, 0) : '—'} مل`}>
        <defs><clipPath id="cupclip"><path d={clip} /></clipPath></defs>
        <path d={clip} fill="var(--surface-2)" stroke="var(--line)" strokeWidth="1.5" />
        <g clipPath="url(#cupclip)">
          {layers.map((L, i) => (
            <rect key={i} x="0" y={L.y} width="100" height={Math.max(L.h - (i < layers.length - 1 ? 0 : 0), 0)} fill={L.color} stroke="var(--surface)" strokeWidth="1">
              <title>{`${L.name}: ${num(L.ml)} مل`}</title>
            </rect>
          ))}
          {fillRatio > 0 && <rect x="0" y={bottom - fillRatio * H} width="100" height="2.5" fill="var(--liquid-top)" opacity=".7" />}
        </g>
        <rect x="9" y="8" width="82" height="7" rx="3.5" fill="var(--ink-3)" opacity=".55" />
      </svg>
    </div>
  );
}

/** خط سجل الأسعار مع تلميح عند المرور */
export function Sparkline({ points }) {
  const [hi, setHi] = useState(null);
  if (points.length < 2) return <p className="muted small">السجل يبدأ من أول تعديل على السعر.</p>;
  const W = 300, H = 80, pad = 8;
  const t0 = new Date(points[0].recorded_at).getTime();
  const t1 = new Date(points.at(-1).recorded_at).getTime();
  const vals = points.map((p) => Number(p.package_price));
  const lo = Math.min(...vals), hiV = Math.max(...vals);
  const x = (p) => pad + ((new Date(p.recorded_at).getTime() - t0) / Math.max(t1 - t0, 1)) * (W - pad * 2);
  const yy = (v) => H - pad - ((v - lo) / Math.max(hiV - lo, 1e-9)) * (H - pad * 2);
  // خط متدرج (السعر يبقى ثابت لين يتغير)
  let d = `M${x(points[0])} ${yy(vals[0])}`;
  points.slice(1).forEach((p, i) => { d += ` H${x(p)} V${yy(vals[i + 1])}`; });
  const h = hi != null ? points[hi] : null;
  return (
    <div className="spark-wrap" onMouseLeave={() => setHi(null)}>
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="تغير سعر العبوة مع الوقت">
        <path d={d} fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <g key={p.id || i}>
            <circle cx={x(p)} cy={yy(vals[i])} r={hi === i ? 5 : 3.5} fill="var(--surface)" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <rect x={x(p) - 14} y="0" width="28" height={H} fill="transparent" onMouseEnter={() => setHi(i)} onClick={() => setHi(i)} />
          </g>
        ))}
      </svg>
      {h && (
        <div className="tip" style={{ left: `${(x(h) / W) * 100}%`, top: `${(yy(Number(h.package_price)) / H) * 100}%` }}>
          {date(h.recorded_at)}: <span className="num">{money(Number(h.package_price))}</span> {CUR}
        </div>
      )}
    </div>
  );
}

export const unitCostText = (cost, base) => `${tiny(cost)} ${CUR} / ${UNITS[base].short}`;

/**
 * أعمدة يومية (سلسلة وحدة) مع خط مرجعي اختياري (مثل نقطة التعادل) وتلميح عند المرور.
 * days: [{ date, value, sub }]
 */
export function DailyBars({ days, target, targetLabel, valueLabel = 'الربح' }) {
  const [hi, setHi] = useState(null);
  if (!days.length) return null;
  const W = 600, H = 180, padB = 22, padT = 10;
  const max = Math.max(target || 0, ...days.map((d) => d.value), 1);
  const min = Math.min(0, ...days.map((d) => d.value));
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const bw = W / days.length;
  const step = Math.ceil(days.length / 8);
  const h = hi != null ? days[hi] : null;
  return (
    <div className="spark-wrap" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} role="img" aria-label={`${valueLabel} لكل يوم`}>
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" />
        {days.map((d, i) => {
          const top = y(Math.max(d.value, 0)), bot = y(Math.min(d.value, 0));
          return (
            <g key={d.date} onMouseEnter={() => setHi(i)} onClick={() => setHi(i)}>
              <rect x={i * bw} y={0} width={bw} height={H} fill="transparent" />
              {d.value !== 0 && <rect x={i * bw + bw * 0.18} y={top} width={bw * 0.64} height={Math.max(bot - top, 1)} rx="3" fill={d.value < 0 ? 'var(--bad)' : 'var(--brand)'} opacity={hi == null || hi === i ? 1 : 0.45} />}
              {(i % step === 0 || (i === days.length - 1 && (days.length - 1) % step >= step / 2)) && (
                <text x={i * bw + bw / 2} y={H - 4} textAnchor="middle" fontSize="11" fill="var(--ink-3)">{d.date.slice(8)}/{d.date.slice(5, 7)}</text>
              )}
            </g>
          );
        })}
        {target > 0 && (
          <>
            <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="var(--saffron)" strokeWidth="1.5" strokeDasharray="5 4" />
          </>
        )}
      </svg>
      <div className="legend">
        <span><i style={{ background: 'var(--brand)' }} />{valueLabel} اليومي</span>
        {target > 0 && <span><i style={{ background: 'none', borderTop: '2px dashed var(--saffron)', borderRadius: 0, height: 0, verticalAlign: 3 }} />{targetLabel}</span>}
      </div>
      {h && (
        <div className="tip" style={{ left: `${((hi + 0.5) * bw / W) * 100}%`, top: `${(y(Math.max(h.value, 0)) / H) * 100}%` }}>
          {date(h.date)} · {valueLabel} <span className="num">{money(h.value)}</span>{h.sub ? ` · ${h.sub}` : ''}
        </div>
      )}
    </div>
  );
}
