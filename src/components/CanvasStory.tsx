import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { finishNames, type CanvasInfo, type Finish, type Scene, type SceneKind } from '../config/canvases';
import { openOrder, showCanvas } from '../lib/order';
import { waLink } from '../lib/whatsapp';
import { IconChevronLeft, IconChevronRight, IconWhatsApp } from './icons';

/*
 * «Полотна и цены» — история из сцен: кусочек полотна поворачивается, его меряет штангенциркуль,
 * раскатывается рулон и т. д. Действие сцены — CSS-переходы по transform и opacity, доигрывают сами.
 *
 * И на компьютере, и на телефоне одинаково: карточка стоит на месте (sticky), а прокрутка страницы снизу вверх
 * переключает сцены. Номер сцены определяет не обработчик прокрутки, а IntersectionObserver: под карточкой лежат
 * невидимые «ступеньки» (по одной на сцену), и та, что пересекает середину экрана, — текущая. Так при прокрутке
 * скрипт ничего не считает и не мерит, страница не дёргается; новая сцена просто запускает CSS-переход.
 * Полотна листаются вкладками, стрелками или горизонтальным свайпом по картинке.
 * Сцены и тексты — в src/config/canvases.ts, анимации — в global.css (раздел «Полотна: история»).
 */

const rub = new Intl.NumberFormat('ru-RU').format;
const num = (n: number, digits = 2) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
const meters = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const pct = (part: number, whole: number) => `${(part / whole) * 100}%`;

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
            <i className="cs-mark-cover" />
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

/** Табло штангенциркуля: цифры бегут от 0,60 до толщины вместе с губкой (кривая — как у губки в CSS) */
function useReadout(ref: RefObject<SVGTextElement | null>, active: boolean, from: number, to: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active || reduced()) {
      el.textContent = num(active ? to : from);
      return;
    }
    let raf = 0;
    const t0 = performance.now() + 500; // задержка губки в CSS
    const tick = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - t0) / 1300));
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      el.textContent = num(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ref, active, from, to]);
}

/**
 * Толщина: линейка слева, увеличенный срез плёнки и штангенциркуль.
 * Подвижная губка — отдельный слой поверх рисунка: она съезжает вниз до плёнки через transform.
 */
function Caliper({ value, active }: { value: number; active: boolean }) {
  const k = 200; // единиц рисунка на 1 мм
  const base = 168; // низ среза плёнки
  const top = base - value * k;
  const start = 0.6; // губка начинает с 0,6 мм
  const open = base - start * k - top; // на сколько губка поднята в начале (отрицательное — вверх)
  const ticks = Array.from({ length: 11 }, (_, i) => i);
  const readout = useRef<SVGTextElement>(null);
  useReadout(readout, active, start, value);

  return (
    <div className="cs-cal" aria-hidden="true" style={{ '--open': pct(open, 230) } as CSSProperties}>
      <svg viewBox="0 0 420 230">
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
          <text x="14" y={base - 110}>
            мм
          </text>
        </g>

        {/* срез плёнки, увеличенный */}
        <g className="cs-band">
          <rect x="78" y={top} width="236" height={base - top} rx="1.5" />
          <rect className="cs-band-hi" x="78" y={top} width="236" height={Math.max(1, (base - top) * 0.28)} />
        </g>
        <text className="cs-zoom" x="196" y={base + 30}>
          срез плёнки, увеличено
        </text>

        {/* штангенциркуль: штанга и неподвижная губка снизу */}
        <rect className="cs-metal" x="340" y="22" width="16" height="200" rx="3" />
        {Array.from({ length: 19 }, (_, i) => (
          <line key={i} className="cs-cal-tick" x1="350" x2="356" y1={34 + i * 10} y2={34 + i * 10} />
        ))}
        <path className="cs-metal" d={`M356 ${base} H262 l-10 7 V${base + 12} H356 Z`} />
      </svg>

      {/* направляющие от плёнки к линейке — появляются, когда губка дошла */}
      <svg className="cs-guides" viewBox="0 0 420 230">
        <line x1="60" x2="78" y1={top} y2={top} />
        <line x1="60" x2="78" y1={base} y2={base} />
      </svg>

      {/* подвижная губка с табло */}
      <svg className="cs-jaw" viewBox="0 0 420 230">
        <path className="cs-metal" d={`M356 ${top} H262 l-10 -7 V${top - 12} H356 Z`} />
        <rect className="cs-metal" x="332" y={top - 26} width="32" height="30" rx="4" />
        <g className="cs-readout">
          <rect x="366" y={top - 30} width="52" height="26" rx="5" />
          <text ref={readout} x="392" y={top - 12}>
            {num(start)}
          </text>
        </g>
      </svg>
    </div>
  );
}

/**
 * Ширина рулона: рулон катится по плану комнаты и оставляет за собой полотно.
 * Комната — неподвижный рисунок, а полотно и рулон — слои поверх: полотно растёт (scaleY),
 * рулон едет вниз и худеет, полосы на нём бегут — будто он вращается. Всё на transform.
 */
function Roll({ value }: { value: number }) {
  const W = 420; // размеры рисунка
  const Hh = 250;
  const w = 280 * Math.min(1, value / 5.5); // ширина комнаты: 5,5 м — во всю ширину
  const L = 210 - w / 2;
  const R = 210 + w / 2;
  const top = 58;
  const H = 166;
  const R0 = 22; // толщина полного рулона
  const R1 = 8; // остаток на втулке

  const vars = {
    '--travel': `${(H / (2 * R0)) * 100}%`,
    '--thin': R1 / R0,
  } as CSSProperties;

  return (
    <div className="cs-roll" aria-hidden="true" style={vars}>
      <svg viewBox={`0 0 ${W} ${Hh}`}>
        <defs>
          <pattern id="cs-floor-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" className="cs-floor-grid" />
          </pattern>
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
        <rect className="cs-floor" x={L} y={top} width={w} height={H} />
        <rect x={L} y={top} width={w} height={H} fill="url(#cs-floor-grid)" />
      </svg>

      <i className="cs-roll-film" style={{ left: pct(L, W), width: pct(w, W), top: pct(top, Hh), height: pct(H, Hh) }} />

      <svg viewBox={`0 0 ${W} ${Hh}`} className="cs-roll-walls">
        <rect className="cs-room" x={L} y={top} width={w} height={H} rx="3" />
      </svg>

      <span className="cs-noseam" style={{ top: pct(146, Hh) }}>
        без шва
      </span>

      <div className="cs-roller" style={{ left: pct(L, W), width: pct(w, W), top: pct(top - R0, Hh), height: pct(2 * R0, Hh) }}>
        <i className="cs-roller-shade" />
        <i className="cs-roller-body">
          <b />
        </i>
        <i className="cs-roller-end" />
      </div>
    </div>
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
function Stage({ c, finish, scene }: { c: CanvasInfo; finish: Finish; scene: Scene }) {
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

      {thickness?.value && <Caliper value={thickness.value} active={active === 'thickness'} />}
      {width?.value && <Roll value={width.value} />}
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
  const rungs = useRef<(HTMLDivElement | null)[]>([]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const steps = Math.max(...items.map((c) => c.scenes.length));
  const last = items.length - 1;

  const c = items[index];
  const current = Math.min(step, c.scenes.length - 1);
  const scene = c.scenes[current];
  const currentFinish = finish[c.id] ?? c.finishes[0];

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last]);

  // Прокрутка → номер сцены. Ступенька, которая пересекает середину экрана, — текущая сцена.
  // Сама анимация сцены — CSS-переходы, они доигрывают до конца без скрипта.
  useEffect(() => {
    const els = rungs.current.filter((el): el is HTMLDivElement => !!el);
    if (!els.length || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        // Быстрый взмах пальца может принести сразу несколько записей — берём самую дальнюю из пересёкших линию
        let pick = -1;
        for (const e of entries) if (e.isIntersecting) pick = Math.max(pick, els.indexOf(e.target as HTMLDivElement));
        if (pick < 0) return;
        setStep(pick);
        if (pick > 0) scroller.current?.setAttribute('data-started', '');
      },
      { rootMargin: '-50% 0px -50% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [steps]);

  // Пока история на экране, нижняя панель телефона заказывает показанное полотно
  const inView = useRef(false);
  const shownName = useRef(c.name);
  shownName.current = c.name;
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const io = new IntersectionObserver(([e]) => {
      inView.current = e.isIntersecting;
      showCanvas(e.isIntersecting ? shownName.current : null);
    });
    io.observe(box);
    return () => {
      io.disconnect();
      showCanvas(null);
    };
  }, []);
  useEffect(() => {
    if (inView.current) showCanvas(c.name);
  }, [c.name]);

  // Нажатие на шаг прокручивает страницу так, чтобы ступенька этой сцены встала на середину экрана
  const toStep = (i: number) => {
    const el = rungs.current[i];
    if (!el) return;
    const box = el.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + box.top + box.height / 2 - window.innerHeight / 2, behavior: reduced() ? 'auto' : 'smooth' });
  };

  // Горизонтальный свайп по картинке — другое полотно (вертикальный жест остаётся прокруткой страницы)
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('button, a')) return;
    drag.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - d.y) * 1.2) go(index + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      ref={scroller}
      className="cs-scroller"
      style={{ '--steps': steps } as CSSProperties}
    >
      {/* Невидимые ступеньки — по одной на сцену; их пересечение с серединой экрана переключает сцену */}
      <div className="cs-rungs" aria-hidden="true">
        {Array.from({ length: steps }, (_, i) => (
          <div key={i} ref={(el) => void (rungs.current[i] = el)} className="cs-rung" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <div className="cs-pin">
        <div className="container-page cs-wrap">
          <div className="cs-card">
            <div className="cs-visual" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (drag.current = null)}>
              <Stage key={c.id} c={c} finish={currentFinish} scene={scene} />

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
              <p className="cs-swipehint" aria-hidden="true">
                <i />
                Листайте вниз
              </p>
            </div>

            <div className="cs-info">
              <div className="cs-head" key={`head-${c.id}`}>
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

              <ol className="cs-steps" aria-label="Что показать про полотно" key={`steps-${c.id}`}>
                {c.scenes.map((s, i) => (
                  <li key={s.kind}>
                    <button
                      type="button"
                      aria-current={i === current ? 'step' : undefined}
                      data-done={i < current || undefined}
                      onClick={() => toStep(i)}
                    >
                      <span className="sr-only">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ol>

              {/* Все сцены лежат друг на друге: высота карточки не прыгает при смене сцены */}
              <div className="cs-scenes" key={`scenes-${c.id}`} aria-live="polite">
                {c.scenes.map((s, i) => (
                  <div
                    key={s.kind}
                    className="cs-scene"
                    data-current={i === current || undefined}
                    data-before={i < current || undefined}
                    aria-hidden={i !== current || undefined}
                  >
                    <p className="cs-kicker">
                      {String(i + 1).padStart(2, '0')} / {String(c.scenes.length).padStart(2, '0')}
                    </p>
                    <h4 className="cs-title">{s.title}</h4>
                    <SceneValue scene={s} />
                    <p className="cs-text">{s.text}</p>

                    {s.kind === 'look' && (
                      <div className="cs-finishes">
                        {c.finishes.length > 1 ? (
                          <div className="flex flex-wrap gap-2" role="group" aria-label="Фактура">
                            {c.finishes.map((f) => (
                              <button
                                key={f}
                                type="button"
                                className="chip cs-chip"
                                aria-pressed={f === currentFinish}
                                tabIndex={i === current ? undefined : -1}
                                onClick={() => setFinish((prev) => ({ ...prev, [c.id]: f }))}
                              >
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
                ))}
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
