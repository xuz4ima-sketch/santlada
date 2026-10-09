import { useId, useMemo } from 'react';
import { ceilingTypes } from '../../config/site';
import { perimeterOf, type Room } from '../../lib/pricing';
import { plural } from '../../lib/plural';

type Pt = [number, number];

const W = 320;
const H = 224;
const X0 = 30;
const Y0 = 30;
const X1 = 290;
const Y1 = 194;
const NOTCH_W = 78;
const NOTCH_H = 52;
const CHAMFER = 40;

/** Контур потолка с нужным числом углов (до 12 — дальше форма не меняется) */
export function ceilingShape(corners: number): Pt[] {
  if (corners <= 3) return [[X0, Y0], [X1, Y1], [X0, Y1]];
  const extra = Math.min(8, Math.round(corners) - 4);
  const notches = (['tr', 'bl', 'tl', 'br'] as const).slice(0, Math.floor(extra / 2));
  const chamfer =
    extra % 2 === 1 ? (['br', 'tl', 'bl', 'tr'] as const).find((c) => !notches.includes(c as never)) : undefined;
  const mode = (c: 'tl' | 'tr' | 'br' | 'bl') => (notches.includes(c as never) ? 'notch' : chamfer === c ? 'chamfer' : 'none');

  const pts: Pt[] = [];
  const tl = mode('tl');
  if (tl === 'notch') pts.push([X0, Y0 + NOTCH_H], [X0 + NOTCH_W, Y0 + NOTCH_H], [X0 + NOTCH_W, Y0]);
  else if (tl === 'chamfer') pts.push([X0, Y0 + CHAMFER], [X0 + CHAMFER, Y0]);
  else pts.push([X0, Y0]);

  const tr = mode('tr');
  if (tr === 'notch') pts.push([X1 - NOTCH_W, Y0], [X1 - NOTCH_W, Y0 + NOTCH_H], [X1, Y0 + NOTCH_H]);
  else if (tr === 'chamfer') pts.push([X1 - CHAMFER, Y0], [X1, Y0 + CHAMFER]);
  else pts.push([X1, Y0]);

  const br = mode('br');
  if (br === 'notch') pts.push([X1, Y1 - NOTCH_H], [X1 - NOTCH_W, Y1 - NOTCH_H], [X1 - NOTCH_W, Y1]);
  else if (br === 'chamfer') pts.push([X1, Y1 - CHAMFER], [X1 - CHAMFER, Y1]);
  else pts.push([X1, Y1]);

  const bl = mode('bl');
  if (bl === 'notch') pts.push([X0 + NOTCH_W, Y1], [X0 + NOTCH_W, Y1 - NOTCH_H], [X0, Y1 - NOTCH_H]);
  else if (bl === 'chamfer') pts.push([X0 + CHAMFER, Y1], [X0, Y1 - CHAMFER]);
  else pts.push([X0, Y1]);

  return pts;
}

function inside([x, y]: Pt, poly: Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function edgeDistance([x, y]: Pt, poly: Pt[]): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    min = Math.min(min, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)));
  }
  return min;
}

const polyLength = (poly: Pt[]) =>
  poly.reduce((s, p, i) => s + Math.hypot(p[0] - poly[(i + 1) % poly.length][0], p[1] - poly[(i + 1) % poly.length][1]), 0);

/**
 * Равномерно раскладывает точки внутри контура: каждая следующая — там, где больше всего
 * свободного места. Добавление светильника не сдвигает уже поставленные.
 */
function spread(n: number, poly: Pt[], margin: number, avoid: Pt[] = []): Pt[] {
  if (n <= 0) return [];
  const step = 8;
  const candidates: Pt[] = [];
  for (let y = Y0 + margin; y <= Y1 - margin; y += step) {
    for (let x = X0 + margin; x <= X1 - margin; x += step) {
      const p: Pt = [x, y];
      if (inside(p, poly) && edgeDistance(p, poly) >= margin) candidates.push(p);
    }
  }
  if (candidates.length === 0) return [];

  const chosen: Pt[] = [];
  const dist = candidates.map((c) =>
    avoid.length ? Math.min(...avoid.map((a) => Math.hypot(a[0] - c[0], a[1] - c[1]))) : Infinity,
  );
  for (let k = 0; k < Math.min(n, candidates.length); k++) {
    let best = 0;
    if (k === 0 && !avoid.length) {
      // Первая точка — ближе всего к левому верхнему углу
      let bestScore = Infinity;
      candidates.forEach((c, i) => {
        const score = c[0] + c[1];
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
    } else {
      for (let i = 1; i < candidates.length; i++) if (dist[i] > dist[best]) best = i;
    }
    const p = candidates[best];
    chosen.push(p);
    for (let i = 0; i < candidates.length; i++) dist[i] = Math.min(dist[i], Math.hypot(candidates[i][0] - p[0], candidates[i][1] - p[1]));
  }
  return chosen;
}

function chandelierSpots(n: number, poly: Pt[]): Pt[] {
  if (n <= 0) return [];
  const cy = (Y0 + Y1) / 2;
  const row: Pt[] = Array.from({ length: n }, (_, i) => [X0 + ((i + 0.5) * (X1 - X0)) / n, cy]);
  return row.every((p) => inside(p, poly) && edgeDistance(p, poly) > 24) ? row : spread(n, poly, 30);
}

const pts = (poly: Pt[]) => poly.map((p) => p.join(',')).join(' ');

export default function CeilingPreview({ room, className = '' }: { room: Room; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const poly = useMemo(() => ceilingShape(room.corners), [room.corners]);

  const pxPerM = polyLength(poly) / Math.max(1, perimeterOf(room));
  const lightTotal = Math.min(room.linesM * pxPerM, 2600);

  const chandeliers = useMemo(() => chandelierSpots(Math.min(room.chandeliers, 4), poly), [room.chandeliers, poly]);
  const spots = useMemo(() => spread(Math.min(room.spots, 60), poly, 22, chandeliers), [room.spots, poly, chandeliers]);

  // Световые линии: контур внутри потолка, остаток длины — диагонали через центр
  const lines = useMemo(() => {
    if (lightTotal <= 0) return { rect: null as null | { x: number; y: number; w: number; h: number }, diagonals: [] as Pt[][] };
    const w = X1 - X0;
    const h = Y1 - Y0;
    const maxInset = Math.min(w, h) / 2 - 18;
    let inset = (2 * (w + h) - lightTotal) / 8;
    inset = Math.min(maxInset, Math.max(34, inset));
    const rect = { x: X0 + inset, y: Y0 + inset, w: w - 2 * inset, h: h - 2 * inset };
    let rest = lightTotal - 2 * (rect.w + rect.h);
    const diagonals: Pt[][] = [];
    const cx = (X0 + X1) / 2;
    for (let i = 0; rest > 40 && i < 6; i++) {
      const offset = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 46;
      const a: Pt = [X0 + 10 + offset, Y1 - 10];
      const b: Pt = [cx + (cx - X0) - 10 + offset, Y0 + 10];
      diagonals.push([a, b]);
      rest -= Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.75;
    }
    return { rect, diagonals };
  }, [lightTotal]);

  const corniceLen = Math.min(X1 - X0 - 16, room.corniceM * pxPerM);
  const ledOnly = room.ledM > 0 && room.corniceM === 0;

  const fill = room.colored ? '#dfe8f8' : room.canvas === 'fabric' ? '#f8f6f2' : '#f8faff';
  const t = room.type;

  const label = [
    `Схема потолка: ${ceilingTypes[t].name.toLowerCase()}`,
    `${room.corners} ${plural(room.corners, ['угол', 'угла', 'углов'])}`,
    room.spots ? `${room.spots} ${plural(room.spots, ['светильник', 'светильника', 'светильников'])}` : '',
    room.chandeliers ? `${room.chandeliers} ${plural(room.chandeliers, ['люстра', 'люстры', 'люстр'])}` : '',
    room.linesM ? `световые линии ${room.linesM} м` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label={label}>
      <defs>
        <filter id={`glow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={`soft-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <radialGradient id={`spot-${uid}`}>
          <stop offset="0" stopColor="#9bbcff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#9bbcff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`gloss-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity={room.canvas === 'gloss' ? 0.9 : room.canvas === 'satin' ? 0.45 : 0} />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`clip-${uid}`}>
          <polygon points={pts(poly)} />
        </clipPath>
        {room.canvas === 'fabric' && (
          <pattern id={`weave-${uid}`} width="6" height="6" patternUnits="userSpaceOnUse">
            <path d="M0 3h6M3 0v6" stroke="#e9e3d9" strokeWidth="0.6" />
          </pattern>
        )}
      </defs>

      {/* Стены вокруг потолка */}
      <rect x="0" y="0" width={W} height={H} rx="18" fill="#edf3fd" />

      {/* Подсветка по периметру (парящий) */}
      {t === 'paryashchiy' && (
        <polygon points={pts(poly)} fill="none" stroke="#9bbcff" strokeWidth="14" filter={`url(#glow-${uid})`} opacity="0.95" />
      )}

      {/* Полотно */}
      <polygon points={pts(poly)} fill={fill} />
      {room.canvas === 'fabric' && <polygon points={pts(poly)} fill={`url(#weave-${uid})`} />}
      <polygon points={pts(poly)} fill={`url(#gloss-${uid})`} />

      {/* Примыкание к стенам */}
      {t === 'tenevoy' && <polygon points={pts(poly)} fill="none" stroke="#0e1a3a" strokeWidth="7" strokeLinejoin="miter" />}
      {t === 'paryashchiy' && <polygon points={pts(poly)} fill="none" stroke="#1d4ed8" strokeWidth="2.5" />}
      {(t === 'klassika' || t === 'linii') && <polygon points={pts(poly)} fill="none" stroke="#c3d3ec" strokeWidth="3" />}

      <g clipPath={`url(#clip-${uid})`}>
        {/* Скрытый карниз / подсветка в нише у окна */}
        {corniceLen > 0 && (
          <rect x={X0 + 8} y={Y0 + 2} width={corniceLen} height="12" rx="3" fill={room.ledM > 0 ? '#d0e0fb' : '#d8e2f2'} />
        )}
        {(room.ledM > 0 && corniceLen > 0) || ledOnly ? (
          <rect
            x={X0 + 8}
            y={Y0 + 6}
            width={corniceLen > 0 ? corniceLen : X1 - X0 - 16}
            height="4"
            rx="2"
            fill="#9bbcff"
            filter={`url(#soft-${uid})`}
          />
        ) : null}

        {/* Световые линии */}
        {lines.rect && (
          <g>
            <g stroke="#9bbcff" strokeWidth="8" fill="none" filter={`url(#soft-${uid})`} opacity="0.9">
              <rect x={lines.rect.x} y={lines.rect.y} width={lines.rect.w} height={lines.rect.h} />
              {lines.diagonals.map(([a, b], i) => (
                <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
              ))}
            </g>
            <g stroke="#1d4ed8" strokeWidth="2.5" fill="none" strokeLinecap="square">
              <rect x={lines.rect.x} y={lines.rect.y} width={lines.rect.w} height={lines.rect.h} />
              {lines.diagonals.map(([a, b], i) => (
                <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
              ))}
            </g>
          </g>
        )}

        {/* Обход труб */}
        {Array.from({ length: Math.min(room.pipes, 6) }, (_, i) => (
          <circle key={i} cx={X0 + 14 + i * 14} cy={Y1 - 14} r="4.5" fill="#fff" stroke="#4e5f80" strokeWidth="2" />
        ))}

        {/* Точечные светильники */}
        {spots.map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="11" fill={`url(#spot-${uid})`} />
            <circle cx={x} cy={y} r="4.2" fill="#ffffff" stroke="#94a3c4" strokeWidth="1.5" />
          </g>
        ))}

        {/* Люстры */}
        {chandeliers.map(([x, y], i) => (
          <g key={i} stroke="#4e5f80" fill="none">
            <circle cx={x} cy={y} r="22" fill={`url(#spot-${uid})`} stroke="none" />
            <circle cx={x} cy={y} r="13" strokeWidth="2" />
            <circle cx={x} cy={y} r="3.5" fill="#4e5f80" stroke="none" />
            {[0, 60, 120, 180, 240, 300].map((a) => (
              <line
                key={a}
                x1={x + Math.cos((a * Math.PI) / 180) * 4}
                y1={y + Math.sin((a * Math.PI) / 180) * 4}
                x2={x + Math.cos((a * Math.PI) / 180) * 13}
                y2={y + Math.sin((a * Math.PI) / 180) * 13}
                strokeWidth="1.3"
              />
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
