import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from 'react';
import { finishNames, type CanvasInfo, type Finish, type Scene, type SceneKind } from '../config/canvases';
import { openOrder } from '../lib/order';
import { waLink } from '../lib/whatsapp';
import { IconChevronLeft, IconChevronRight, IconWhatsApp } from './icons';

/*
 * «Полотна и цены» как история при прокрутке.
 * Карточка полотна стоит на месте (sticky), а прокрутка страницы переключает сцены:
 * кусочек полотна поворачивается, его меряет штангенциркуль, раскатывается рулон и т. д.
 * Прокрутка только выбирает сцену, а действие сцены (рулон, штангенциркуль, лампа…) после этого
 * доигрывает до конца само и плавно — где бы палец ни остановился. Пролистал дальше — следующая сцена,
 * пролистал назад — действие плавно отыгрывается обратно.
 * Полотна листаются вбок — вкладками, стрелками или пальцем.
 * Сцены и тексты — в src/config/canvases.ts, анимации — в global.css (раздел «Полотна: история»).
 */

const rub = new Intl.NumberFormat('ru-RU').format;
const num = (n: number, digits = 2) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
const meters = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Сколько длится одна сцена: короткая пауза, пока кусочек полотна встаёт на место, и само действие */
const SCENE_MS = 1700;

/**
 * Насколько сыграно действие сцены i (0…1), если проиграно pos сцен.
 * Первая пятая часть — пауза, дальше действие плавно разгоняется и плавно останавливается.
 */
const act = (pos: number, i: number) => {
  const x = clamp01((pos - i - 0.2) / 0.8);
  return x * x * (3 - 2 * x);
};

/** Сколько сцен проиграно: 2 — первые две целиком, 2,5 — третья наполовину */
function createPos() {
  let value = 0;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(v: number) {
      if (v === value) return;
      value = v;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}
type Pos = ReturnType<typeof createPos>;

const usePos = (pos: Pos) => useSyncExternalStore(pos.subscribe, pos.get, () => 0);

/** Кусочек полотна: лицевая сторона и четыре торца */
function Swatch({ finish, mark }: { finish: Finish; mark?: string }) {
  return (
    <div className="cs-swatch">
      <div className="cs-top" data-finish={finish}>
        <i className="cs-sheen" />
        <i className="cs-glow" />
        {mark && (
          <span className="cs-mark" aria-hidden="true">
            {Array.from({ length: 8 }, () => mark).join('   ')}
          </span>
        )}
      </div>
      <i className="cs-edge cs-edge-b" />
      <i className="cs-edge cs-edge-t" />
      <i className="cs-edge cs-edge-l" />
      <i className="cs-edge cs-edge-r" />
    </div>
  );
}

/** Толщина: линейка слева, увеличенный срез плёнки и штангенциркуль, губка которого опускается до плёнки */
function Caliper({ value, pos, at }: { value: number; pos: Pos; at: number }) {
  const k = 200; // единиц рисунка на 1 мм
  const base = 168; // низ среза плёнки
  const top = base - value * k;
  const start = 0.6; // губка начинает с 0,6 мм
  const a = act(usePos(pos), at);
  const reading = start + (value - start) * a;
  const open = (base - start * k - top) * (1 - a); // насколько губка ещё поднята
  const ticks = Array.from({ length: 11 }, (_, i) => i);

  return (
    <svg className="cs-cal" viewBox="0 0 420 230" aria-hidden="true">
      {/* линейка */}
      <g className="cs-ruler">
        <rect x="8" y={base - 124} width="52" height="136" rx="6" />
        {ticks.map((i) => (
          <line key={i} x1={60 - (i % 2 ? 9 : 17)} x2="60" y1={base - i * 10} y2={base - i * 10} />
        ))}
        {[0, 2, 4, 6, 8, 10].map((i) => (
          <text key={i} x="14" y={base - i * 10 + 4}>
            {i === 0 ? '0' : num(i / 20, 1)}
          </text>
        ))}
        <text className="cs-ruler-unit" x="14" y={base - 110}>
          мм
        </text>
      </g>

      {/* направляющие от плёнки к линейке */}
      <g className="cs-guides" style={{ opacity: a > 0.97 ? 1 : 0 }}>
        <line x1="60" x2="78" y1={top} y2={top} />
        <line x1="60" x2="78" y1={base} y2={base} />
      </g>

      {/* срез плёнки, увеличенный */}
      <g className="cs-band">
        <rect x="78" y={top} width="236" height={base - top} rx="1.5" />
        <rect className="cs-band-hi" x="78" y={top} width="236" height={Math.max(1, (base - top) * 0.28)} />
      </g>
      <text className="cs-zoom" x="196" y={base + 30}>
        срез плёнки, увеличено
      </text>

      {/* штангенциркуль: штанга, неподвижная губка снизу, подвижная — сверху */}
      <g className="cs-caliper">
        <rect className="cs-metal" x="340" y="22" width="16" height="200" rx="3" />
        {Array.from({ length: 19 }, (_, i) => (
          <line key={i} className="cs-cal-tick" x1="350" x2="356" y1={34 + i * 10} y2={34 + i * 10} />
        ))}
        <path className="cs-metal" d={`M356 ${base} H262 l-10 7 V${base + 12} H356 Z`} />
        <g transform={`translate(0 ${open})`}>
          <path className="cs-metal" d={`M356 ${top} H262 l-10 -7 V${top - 12} H356 Z`} />
          <rect className="cs-metal cs-slider" x="332" y={top - 26} width="32" height="30" rx="4" />
          <g className="cs-readout">
            <rect x="366" y={top - 30} width="52" height="26" rx="5" />
            <text x="392" y={top - 12}>
              {num(reading)}
            </text>
          </g>
        </g>
      </g>
    </svg>
  );
}

/**
 * Ширина рулона: рулон катится по плану комнаты и оставляет за собой полотно.
 * Он вращается (полосы бегут по нему), худеет по мере раскатки, а на торце видны витки и картонная втулка.
 */
function Roll({ value, tone, pos, at }: { value: number; tone: string; pos: Pos; at: number }) {
  const id = useId();
  const a = act(usePos(pos), at);
  const w = 280 * Math.min(1, value / 5.5); // ширина комнаты на рисунке: 5,5 м — во всю ширину
  const L = 210 - w / 2; // стены комнаты
  const R = 210 + w / 2;
  const top = 58;
  const H = 166;
  const R0 = 22; // толщина полного рулона
  const R1 = 8; // остаток на втулке
  const core = 5;
  const y = top + a * H; // где рулон касается пола
  // Площадь торца убывает вместе с раскатанным полотном — поэтому радиус убывает как корень
  const r = Math.sqrt(R1 * R1 + (R0 * R0 - R1 * R1) * (1 - a));
  const turn = (a * H) / ((R0 + r) / 2); // на сколько провернулся
  const rx = r * 0.36;
  const rings = Array.from({ length: Math.floor((r - core) / 2.4) }, (_, i) => core + (i + 1) * 2.4);
  const stripes = [0, 1, 2, 3].map((k) => {
    const ang = k * (Math.PI / 2) - turn;
    return { y: y + r * Math.sin(ang) * 0.9, o: Math.max(0, Math.cos(ang)) };
  });

  return (
    <svg className="cs-roll" viewBox="0 0 420 250" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b97ad" />
          <stop offset="0.22" stopColor={tone} />
          <stop offset="0.42" stopColor="#ffffff" />
          <stop offset="0.75" stopColor={tone} />
          <stop offset="1" stopColor="#7d8aa2" />
        </linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor={tone} />
        </linearGradient>
        <pattern id={`${id}g`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" className="cs-floor-grid" />
        </pattern>
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1a3a" stopOpacity="0" />
          <stop offset="1" stopColor="#0e1a3a" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      <g className="cs-dim">
        <line x1={L} x2={R} y1="22" y2="22" />
        <path d={`M${L} 22 l9 -5 v10 Z M${R} 22 l-9 -5 v10 Z`} />
        <rect x="160" y="6" width="100" height="30" rx="15" />
        <text x="210" y="27">
          до {meters(value)} м
        </text>
      </g>

      {/* пустая комната: серый пол в клетку — полотно закрывает его белым */}
      <rect className="cs-floor" x={L} y={top} width={R - L} height={H} />
      <rect x={L} y={top} width={R - L} height={H} fill={`url(#${id}g)`} />

      {/* раскатанное полотно и мягкая тень от рулона на нём */}
      <rect x={L} y={top} width={R - L} height={Math.max(0, y - top)} fill={`url(#${id}f)`} />
      <rect x={L} y={Math.max(top, y - r - 14)} width={R - L} height={Math.max(0, Math.min(14, y - r - top))} fill={`url(#${id}s)`} />
      <rect className="cs-room" x={L} y={top} width={R - L} height={H} rx="3" />
      <text className="cs-noseam" x="210" y="146" style={{ opacity: clamp01((a - 0.7) / 0.25) }}>
        без шва
      </text>

      {/* рулон: тень, тело, бегущие полосы, торец с витками и втулкой */}
      <ellipse cx={(L + R) / 2} cy={y + r * 0.95} rx={(R - L) / 2 + 6} ry={r * 0.4} className="cs-roll-shadow" />
      <path d={`M${R} ${y - r} H${L} a${rx} ${r} 0 0 0 0 ${2 * r} H${R} Z`} fill={`url(#${id}b)`} className="cs-roll-body" />
      {stripes.map((st, i) => (
        <line key={i} x1={L} x2={R} y1={st.y} y2={st.y} className="cs-roll-stripe" style={{ opacity: st.o * 0.6 }} />
      ))}
      <ellipse cx={R} cy={y} rx={rx} ry={r} className="cs-roll-end" />
      {rings.map((rr) => (
        <ellipse key={rr} cx={R} cy={y} rx={rr * 0.36} ry={rr} className="cs-roll-ring" />
      ))}
      <ellipse cx={R} cy={y} rx={core * 0.36} ry={core} className="cs-roll-core" />
      <ellipse cx={R} cy={y} rx={core * 0.18} ry={core * 0.55} className="cs-roll-hole" />
    </svg>
  );
}

/** Веер образцов цвета */
function Fan({ colors, finish }: { colors: string[]; finish: Finish }) {
  const mid = (colors.length - 1) / 2;
  return (
    <div className="cs-fan" aria-hidden="true">
      {colors.map((c, i) => (
        <i key={c} data-finish={finish} style={{ '--c': c, '--i': i, '--r': `${(i - mid) * 13}deg` } as CSSProperties}>
          <b className="cs-sheen" />
        </i>
      ))}
    </div>
  );
}

const kindsWithSwatch: SceneKind[] = ['look', 'thickness', 'opacity', 'marking', 'fire'];

/** Картинка-сцена: при смене сцены кусочек полотна переходит в новое положение, а слои появляются по очереди */
function Stage({ c, finish, scene, pos }: { c: CanvasInfo; finish: Finish; scene: Scene; pos: Pos }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Сначала кадр в исходном положении, потом сцена — чтобы анимация входа сыграла и при смене полотна
    let r2 = 0;
    const r1 = requestAnimationFrame(() => (r2 = requestAnimationFrame(() => setReady(true))));
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
    };
  }, []);

  const kinds = new Set(c.scenes.map((s) => s.kind));
  const at = (kind: SceneKind) => c.scenes.findIndex((s) => s.kind === kind);
  const thickness = c.scenes.find((s) => s.kind === 'thickness');
  const width = c.scenes.find((s) => s.kind === 'width');
  const fire = c.scenes.find((s) => s.kind === 'fire');
  const active = ready ? scene.kind : undefined;

  return (
    <div className="cs-stage" data-scene={active} data-swatch={active && kindsWithSwatch.includes(active) ? '' : undefined} style={{ '--sw': c.tone } as CSSProperties}>
      <i className="cs-shadow" />
      <div className="cs-float">
        <Swatch finish={finish} mark={kinds.has('marking') ? c.name : undefined} />
      </div>

      {thickness?.value && <Caliper value={thickness.value} pos={pos} at={at('thickness')} />}
      {width?.value && <Roll value={width.value} tone={c.tone} pos={pos} at={at('width')} />}
      {kinds.has('palette') && c.colors && <Fan colors={c.colors} finish={finish} />}

      {kinds.has('opacity') && (
        <div className="cs-op" aria-hidden="true">
          <div className="cs-op-thin">
            <i className="cs-op-wire" />
            <i className="cs-op-lamp" />
          </div>
          <span className="cs-op-label cs-op-label-l">Тонкая плёнка</span>
          <span className="cs-op-label cs-op-label-r">{c.name}</span>
        </div>
      )}

      {kinds.has('marking') && (
        <div className="cs-loupe" aria-hidden="true">
          <span>{c.name}</span>
        </div>
      )}

      {fire && (
        <div className="cs-fire" aria-hidden="true">
          <div className="cs-flame">
            <i />
            <i />
            <i />
          </div>
          <span className="cs-nodrops">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
              <path d="m4 4 16 16" />
            </svg>
            без горящих капель
          </span>
        </div>
      )}
    </div>
  );
}

/** Крупная цифра сцены: «около 0,18 мм», «до 5,5 м», «Bs1d0» */
function SceneValue({ scene }: { scene: Scene }) {
  if (scene.badge) return <p className="cs-value">{scene.badge}</p>;
  if (scene.kind === 'thickness' && scene.value)
    return (
      <p className="cs-value">
        {scene.approx && <small>около </small>}
        {num(scene.value)} мм
      </p>
    );
  if (scene.kind === 'width' && scene.value)
    return (
      <p className="cs-value">
        <small>до </small>
        {meters(scene.value)} м
      </p>
    );
  return null;
}

export default function CanvasStory({ items }: { items: CanvasInfo[] }) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [finish, setFinish] = useState<Record<string, Finish>>({});
  const scroller = useRef<HTMLDivElement>(null);
  const sticky = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [pos] = useState(createPos);
  const steps = Math.max(...items.map((c) => c.scenes.length));
  const last = items.length - 1;

  const c = items[index];
  const current = useRef(c);
  current.current = c;
  const scene = c.scenes[Math.min(step, c.scenes.length - 1)];
  const currentFinish = finish[c.id] ?? c.finishes[0];

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last]);

  // CSS-переменные для анимаций: --p-<сцена> — насколько сыграно действие сцены, --f<i> — заполнение полоски шага
  const paint = useCallback(() => {
    const box = scroller.current;
    if (!box) return;
    const p = pos.get();
    current.current.scenes.forEach((s, i) => {
      box.style.setProperty(`--p-${s.kind}`, act(p, i).toFixed(4));
      box.style.setProperty(`--f${i}`, clamp01(p - i).toFixed(4));
    });
  }, [pos]);

  // Прокрутка выбирает сцену, а действие доигрывается само: pos плавно идёт к «сцена сыграна целиком».
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let target = -1;
    const measure = () => {
      const box = scroller.current;
      const pin = sticky.current;
      if (!box || !pin) return 0;
      const run = box.offsetHeight - pin.offsetHeight;
      const pinTop = parseFloat(getComputedStyle(pin).top) || 0;
      const p = run > 0 ? clamp01((pinTop - box.getBoundingClientRect().top) / run) : 0;
      return Math.min(steps - 0.0001, p * steps);
    };
    const frame = (t: number) => {
      raf = 0;
      const dt = last ? Math.min(50, t - last) : 16;
      let p = pos.get();
      // Если пролистали сразу несколько сцен, промежуточные не проигрываем — только последнюю
      if (Math.abs(target - p) > 1) p = target - Math.sign(target - p);
      const move = dt / SCENE_MS;
      p = Math.abs(target - p) <= move ? target : p + Math.sign(target - p) * move;
      pos.set(p);
      paint();
      if (p !== target) {
        last = t;
        raf = requestAnimationFrame(frame);
      } else last = 0;
    };
    const onScroll = () => {
      const at = measure();
      const s = Math.min(steps - 1, Math.floor(at));
      setStep(s);
      scroller.current?.toggleAttribute('data-started', at > 0.12);
      const first = target < 0;
      target = s + 1;
      if (first || reduced()) {
        pos.set(target);
        paint();
      } else if (!raf) raf = requestAnimationFrame(frame);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [steps, pos, paint]);

  // У другого полотна другой порядок сцен — пересчитываем переменные
  useEffect(paint, [c, paint]);

  // Нажатие на шаг прокручивает страницу к середине этой сцены
  const toStep = (i: number) => {
    const box = scroller.current;
    const pin = sticky.current;
    if (!box || !pin) return;
    const run = box.offsetHeight - pin.offsetHeight;
    const pinTop = parseFloat(getComputedStyle(pin).top) || 0;
    const y = box.getBoundingClientRect().top + window.scrollY - pinTop + run * ((i + 0.5) / steps);
    window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <div ref={scroller} className="cs-scroller" style={{ '--steps': steps } as CSSProperties}>
      <div ref={sticky} className="cs-pin">
        <div className="container-page cs-wrap">
          <div className="cs-card">
            <div className="cs-visual" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)}>
              <Stage key={c.id} c={c} finish={currentFinish} scene={scene} pos={pos} />
              <p className="cs-swipehint" aria-hidden="true">
                <i />
                Листайте вниз
              </p>

              <div className="cs-tabs" role="group" aria-label="Выбор полотна">
                {items.map((it, i) => (
                  <button key={it.id} type="button" className="chip" aria-pressed={i === index} onClick={() => go(i)}>
                    {it.name}
                  </button>
                ))}
              </div>
              <div className="cs-arrows">
                <button type="button" className="cs-arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Предыдущее полотно">
                  <IconChevronLeft size={20} />
                </button>
                <button type="button" className="cs-arrow" onClick={() => go(index + 1)} disabled={index === last} aria-label="Следующее полотно">
                  <IconChevronRight size={20} />
                </button>
              </div>
              {c.badge && <span className="canvas-badge cs-badge">{c.badge}</span>}
            </div>

            <div className="cs-info">
              <div className="cs-head" key={c.id}>
                <div className="min-w-0">
                  <p className="cs-origin">{c.origin}</p>
                  <h3 className="cs-name">
                    {c.name}
                    <span>{c.nameRu}</span>
                  </h3>
                </div>
                <p className="cs-price">
                  <b>{rub(c.price)} ₽</b>
                  <span>за м²</span>
                </p>
              </div>

              <ol className="cs-steps" aria-label="Что показать про полотно">
                {c.scenes.map((s, i) => (
                  <li key={s.kind} style={{ '--f': `var(--f${i}, 0)` } as CSSProperties}>
                    <button type="button" aria-current={i === step ? 'step' : undefined} data-done={i < step || undefined} onClick={() => toStep(i)}>
                      <span className="sr-only">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ol>

              <div className="cs-scene" key={`${c.id}-${scene.kind}`} aria-live="polite">
                <p className="cs-kicker">
                  {String(Math.min(step, c.scenes.length - 1) + 1).padStart(2, '0')} / {String(c.scenes.length).padStart(2, '0')}
                </p>
                <h4 className="cs-title">{scene.title}</h4>
                <SceneValue scene={scene} />
                <p className="cs-text">{scene.text}</p>

                {scene.kind === 'look' && (
                  <div className="cs-finishes">
                    {c.finishes.length > 1 ? (
                      <div className="flex flex-wrap gap-2" role="group" aria-label="Фактура">
                        {c.finishes.map((f) => (
                          <button key={f} type="button" className="chip cs-chip" aria-pressed={f === currentFinish} onClick={() => setFinish((prev) => ({ ...prev, [c.id]: f }))}>
                            {finishNames[f].name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <p className="cs-hint">
                      <b>{finishNames[currentFinish].name}</b> — {finishNames[currentFinish].hint}
                    </p>
                  </div>
                )}
              </div>

              <div className="cs-actions">
                <button type="button" className="btn-primary btn-shine flex-1 sm:flex-none sm:px-7" onClick={() => openOrder(c.name)}>
                  Заказать это полотно
                </button>
                <a
                  href={waLink(`Здравствуйте! Интересует натяжной потолок из полотна ${c.name}. Подскажите по проекту.`)}
                  target="_blank"
                  rel="noopener"
                  className="btn-ghost px-4"
                  aria-label={`Спросить про ${c.name} в WhatsApp`}
                >
                  <IconWhatsApp size={18} className="text-wa" />
                  <span className="max-sm:sr-only">Спросить</span>
                </a>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
