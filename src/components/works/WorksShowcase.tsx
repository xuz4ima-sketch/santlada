import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ceilingOrder, ceilingTypes } from '../../config/site';
import type { Work } from '../../lib/works';
import { wantLike } from '../../stores/order';
import { IconChevronLeft, IconChevronRight, IconHeart, IconPlay } from '../icons';
import { Lightbox, filterNames, type Filter } from './WorksGallery';

interface Cover {
  src: string;
  srcset: string;
}

interface Props {
  works: Work[];
  /** Круглые фото на кнопках видов потолка */
  covers: Partial<Record<Filter, Cover>>;
}

/**
 * Работы на главной — карусель в 3D с выбором вида потолка.
 * Положение задаёт число pos (какая работа в центре, дробное — пока тянут пальцем).
 * Для каждой карточки считается расстояние до центра d, из него — сдвиг, наклон, размер и прозрачность.
 * Смена вида: карточки «складываются» в стопку, список меняется, и новые «раскладываются» веером.
 */
const filters: Filter[] = ['all', ...ceilingOrder];
const OUT_MS = 380;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const pad = (n: number) => String(n).padStart(2, '0');

type Phase = 'idle' | 'out' | 'hold';

export default function WorksShowcase({ works, covers }: Props) {
  const [tab, setTab] = useState<Filter>('all');
  const [filter, setFilter] = useState<Filter>('all');
  const [phase, setPhase] = useState<Phase>('idle');
  const [pos, setPos] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const list = useMemo(() => (filter === 'all' ? works : works.filter((w) => w.types.includes(filter))), [works, filter]);
  const counts = useMemo(() => {
    const c = { all: works.length } as Record<Filter, number>;
    for (const t of ceilingOrder) c[t] = works.filter((w) => w.types.includes(t)).length;
    return c;
  }, [works]);

  const last = Math.max(0, list.length - 1);
  const index = clamp(Math.round(pos), 0, last);
  const work = list[index];

  const stageRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const tabEls = useRef<(HTMLButtonElement | null)[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const drag = useRef<{ x: number; start: number; moved: boolean; lastX: number; lastT: number; vx: number } | null>(null);
  const live = useRef({ index: 0, last: 0 });
  live.current = { index, last };
  const [marker, setMarker] = useState<{ x: number; w: number } | null>(null);

  const go = useCallback((i: number) => setPos(clamp(i, 0, live.current.last)), []);

  // Ползунок под выбранной кнопкой вида
  useLayoutEffect(() => {
    const measure = () => {
      const el = tabEls.current[filters.indexOf(tab)];
      if (el) setMarker({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure);
    return () => window.removeEventListener('resize', measure);
  }, [tab]);

  const choose = (f: Filter) => {
    if (f === tab || phase !== 'idle') return;
    setTab(f);
    const el = tabEls.current[filters.indexOf(f)];
    const row = trackRef.current;
    if (el && row) row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFilter(f);
      setPos(0);
      return;
    }
    setPhase('out');
    timer.current = window.setTimeout(() => {
      setFilter(f);
      setPos(0);
      setPhase('hold');
    }, OUT_MS);
  };

  // После смены списка один кадр держим стопку без анимации, затем раскладываем веером
  useEffect(() => {
    if (phase !== 'hold') return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setPhase('idle'));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [phase]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Ссылка вида /#w-226 сразу открывает работу
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    const i = id ? works.findIndex((w) => w.id === id) : -1;
    if (i >= 0) {
      setPos(i);
      setOpenIndex(i);
    }
  }, [works]);

  // Два пальца по трекпаду в сторону
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let locked = false;
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY) || Math.abs(event.deltaX) < 24) return;
      event.preventDefault();
      if (locked) return;
      locked = true;
      go(live.current.index + (event.deltaX > 0 ? 1 : -1));
      window.setTimeout(() => (locked = false), 450);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [go]);

  // Сколько пикселей — один шаг между соседними карточками
  const stepPx = () => {
    const stage = stageRef.current;
    const item = stage?.querySelector<HTMLElement>('.wf-item');
    if (!stage || !item) return 300;
    const percent = parseFloat(getComputedStyle(stage).getPropertyValue('--wf-step')) || 64;
    return (item.offsetWidth * percent) / 100;
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.moved) return;
    setDragging(false);
    go(Math.round(pos - (d.vx * 220) / stepPx()));
  };

  const spread = phase === 'idle' ? 1 : 0;
  const ms = phase === 'out' ? 420 : 760;
  const types = work ? work.types.map((t) => ceilingTypes[t].name).join(', ') : '';

  return (
    <div className="wf overflow-hidden rounded-[var(--radius-media)] bg-[radial-gradient(90%_110%_at_50%_0%,#fff,var(--color-haze)_72%)] p-3 ring-1 ring-line sm:p-4 lg:p-5">
      <div className="flex items-center justify-between gap-3">
        <div
          ref={trackRef}
          className="-mx-1 max-w-full overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="Вид потолка"
        >
          <div className="relative flex w-max gap-1 rounded-full bg-plane p-1.5 shadow-[var(--shadow-float)] ring-1 ring-line">
            {marker && (
              <span
                aria-hidden="true"
                className="absolute top-1.5 bottom-1.5 left-0 rounded-full bg-brand-deep transition-[transform,width] duration-500 ease-[cubic-bezier(0.65,0,0.2,1)]"
                style={{ width: marker.w, transform: `translateX(${marker.x}px)` }}
              />
            )}
            {filters.map((f, i) => {
              const cover = covers[f];
              const active = tab === f;
              return (
                <button
                  key={f}
                  ref={(el) => {
                    tabEls.current[i] = el;
                  }}
                  type="button"
                  aria-pressed={active}
                  onClick={() => choose(f)}
                  className={`relative z-10 inline-flex min-h-11 items-center gap-2 rounded-full py-1 pr-3.5 pl-1.5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors duration-300 ${
                    active ? 'text-white' : 'text-ink hover:text-brand'
                  } ${active && !marker ? 'bg-brand-deep' : ''}`}
                >
                  {cover ? (
                    <img
                      src={cover.src}
                      srcSet={cover.srcset}
                      sizes="36px"
                      alt=""
                      width={36}
                      height={36}
                      loading="lazy"
                      decoding="async"
                      className="size-9 rounded-full object-cover"
                    />
                  ) : (
                    <span className="size-1" aria-hidden="true" />
                  )}
                  {filterNames[f]}
                  <span className={`text-[0.8125rem] tabular-nums ${active ? 'text-white/70' : 'text-ink-soft'}`}>{counts[f]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div
        ref={stageRef}
        className="wf-stage mt-3 sm:mt-4"
        role="group"
        aria-roledescription="carousel"
        aria-label="Примеры работ"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') go(index - 1);
          if (e.key === 'ArrowRight') go(index + 1);
          if (e.key === 'Home') go(0);
          if (e.key === 'End') go(last);
        }}
        onPointerDown={(e) => {
          if (phase !== 'idle' || (e.pointerType === 'mouse' && e.button !== 0)) return;
          drag.current = { x: e.clientX, start: pos, moved: false, lastX: e.clientX, lastT: e.timeStamp, vx: 0 };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          if (!d.moved) {
            if (Math.abs(dx) < 8) return;
            d.moved = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          const dt = e.timeStamp - d.lastT;
          if (dt > 0) d.vx = d.vx * 0.7 + ((e.clientX - d.lastX) / dt) * 0.3;
          d.lastX = e.clientX;
          d.lastT = e.timeStamp;
          setPos(clamp(d.start - dx / stepPx(), -0.4, last + 0.4));
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {list.map((w, i) => {
          const raw = i - pos;
          const d = raw * spread;
          const a = Math.abs(d);
          const near = Math.abs(raw) < 3.2;
          const shown = phase === 'idle' && a < 2.4;
          const opacity = shown ? (a <= 1 ? 1 - a * 0.12 : 0.88 - (a - 1) * 0.63) : 0;
          return (
            <div
              key={w.id}
              className="wf-item"
              style={{
                zIndex: 100 - Math.round(Math.abs(raw) * 10),
                visibility: near ? 'visible' : 'hidden',
                pointerEvents: shown ? 'auto' : 'none',
                opacity,
                transform: `perspective(1600px) translateX(calc(var(--wf-step) * ${d.toFixed(4)})) translateZ(${(-Math.min(a, 3) * 130).toFixed(1)}px) rotateY(${clamp(-d * 24, -42, 42).toFixed(2)}deg) scale(${(1 - Math.min(a, 2.6) * 0.09).toFixed(4)})`,
                transition:
                  dragging || phase === 'hold'
                    ? 'none'
                    : `transform ${ms}ms cubic-bezier(0.22, 0.8, 0.2, 1), opacity ${Math.round(ms * 0.6)}ms ease`,
              }}
            >
              <button
                type="button"
                className="wf-card group"
                tabIndex={i === index ? 0 : -1}
                aria-label={i === index ? `Открыть: ${w.caption}${w.kind === 'video' ? ', видео' : ''}` : `Показать: ${w.caption}`}
                onClick={() => (i === index ? setOpenIndex(i) : go(i))}
              >
                <img
                  src={w.thumb.src}
                  srcSet={w.thumb.srcset}
                  sizes="(min-width: 768px) 44rem, 78vw"
                  width={w.thumb.width}
                  height={w.thumb.height}
                  alt=""
                  loading={i < 3 ? 'eager' : 'lazy'}
                  decoding="async"
                  draggable={false}
                />
                <span
                  aria-hidden="true"
                  className="absolute inset-0 bg-brand-deep transition-opacity duration-500"
                  style={{ opacity: Math.min(a, 1.4) * 0.3 }}
                />
                {w.kind === 'video' && (
                  <span className="absolute top-3 left-3 z-[1] inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-2.5 py-1 text-[0.75rem] font-semibold text-white">
                    <IconPlay size={12} />
                    Видео
                  </span>
                )}
                <span
                  aria-hidden="true"
                  className="absolute right-3 bottom-3 z-[1] rounded-full bg-white/90 px-3 py-1.5 text-[0.8125rem] font-semibold text-ink opacity-0 shadow-[var(--shadow-float)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  style={{ display: i === index ? undefined : 'none' }}
                >
                  Рассмотреть
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {work && (
        <div className="mt-4 grid gap-3 sm:mt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-8">
          <div className="min-w-0" aria-live="polite">
            <p className="text-[0.8125rem] font-semibold tracking-[0.12em] text-brand uppercase tabular-nums">
              {pad(index + 1)} / {pad(list.length)} · {types}
            </p>
            <p key={work.id} className="mt-1.5 animate-rise font-display text-[1.1875rem] leading-snug sm:text-[1.375rem]">
              {work.caption}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-plane ring-1 ring-line transition-colors ring-inset hover:bg-brand-deep hover:text-white disabled:opacity-35 disabled:hover:bg-plane disabled:hover:text-ink"
              aria-label="Предыдущая работа"
            >
              <IconChevronLeft size={22} />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index === last}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-plane ring-1 ring-line transition-colors ring-inset hover:bg-brand-deep hover:text-white disabled:opacity-35 disabled:hover:bg-plane disabled:hover:text-ink"
              aria-label="Следующая работа"
            >
              <IconChevronRight size={22} />
            </button>
            <button type="button" data-magnet className="btn-primary min-w-0 flex-1 whitespace-nowrap lg:flex-none" onClick={() => wantLike({ id: work.id, type: work.types[0] })}>
              <IconHeart size={18} />
              Хочу такой потолок
            </button>
          </div>
        </div>
      )}

      {list.length > 1 && (
        <div className="mt-4 flex gap-1" role="group" aria-label="Выбор работы по порядку">
          {list.map((w, i) => (
            <button
              key={w.id}
              type="button"
              onClick={() => go(i)}
              aria-label={`Работа ${i + 1} из ${list.length}`}
              aria-current={i === index}
              className="group/seg -my-2 flex-1 py-2"
            >
              <span
                className={`block h-1 rounded-full transition-colors duration-300 ${i === index ? 'bg-brand' : 'bg-mist group-hover/seg:bg-brand/50'}`}
              />
            </button>
          ))}
        </div>
      )}

      {openIndex !== null && list[openIndex] && (
        <Lightbox
          list={list}
          index={openIndex}
          onIndex={(i) => {
            setOpenIndex(i);
            setPos(i);
          }}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}
