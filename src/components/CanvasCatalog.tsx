import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { openOrder } from '../lib/order';
import { waLink } from '../lib/whatsapp';
import { IconChevronLeft, IconChevronRight, IconWhatsApp } from './icons';

export interface CatalogItem {
  id: string;
  name: string;
  nameRu: string;
  origin: string;
  price: number;
  badge?: string;
  description: string;
  points: string[];
  photo?: { src: string; srcset: string; width: number; height: number };
}

const rub = new Intl.NumberFormat('ru-RU').format;
const d = (n: number) => ({ '--d': n }) as CSSProperties;

/** Листаемый каталог полотен: одна карточка на экране, переход — пальцем, стрелками или кнопками */
export default function CanvasCatalog({ items }: { items: CatalogItem[] }) {
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hint, setHint] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const horizontal = useRef(false);
  const moved = useRef(false);
  const last = items.length - 1;

  const go = useCallback((i: number) => setIndex(Math.max(0, Math.min(last, i))), [last]);

  // Подсказка «листайте» исчезает после первого перехода
  useEffect(() => {
    if (index > 0) setHint(false);
  }, [index]);

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, t: Date.now(), id: e.pointerId };
    horizontal.current = false;
    moved.current = false;
  };

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!horizontal.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dy) > Math.abs(dx)) {
        start.current = null;
        return;
      }
      horizontal.current = true;
      setDragging(true);
      try {
        viewport.current?.setPointerCapture(s.id);
      } catch {
        // указатель уже отпущен — листаем и без захвата
      }
    }
    moved.current = true;
    // У крайних карточек тянется туго — как резинка
    const edge = (index === 0 && dx > 0) || (index === last && dx < 0);
    setDrag(edge ? dx * 0.3 : dx);
  };

  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || !horizontal.current) return;
    const width = viewport.current?.offsetWidth ?? 1;
    const dx = e.clientX - s.x;
    const speed = dx / Math.max(1, Date.now() - s.t);
    setDragging(false);
    setDrag(0);
    if (dx < -width * 0.16 || speed < -0.45) go(index + 1);
    else if (dx > width * 0.16 || speed > 0.45) go(index - 1);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  };

  const width = viewport.current?.offsetWidth || 1;

  return (
    <div className="cat" data-dragging={dragging || undefined}>
      <div
        ref={viewport}
        className="cat-viewport"
        role="group"
        aria-roledescription="карусель"
        aria-label="Каталог полотен"
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onClickCapture={(e) => {
          // После перетаскивания палец отпускается над кнопкой — нажатием это считать не нужно
          if (moved.current) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
          }
        }}
      >
        <div className="cat-track" style={{ transform: `translate3d(calc(${-index * 100}% + ${drag}px), 0, 0)` }}>
          {items.map((c, i) => {
            const active = i === index;
            return (
              <article
                key={c.id}
                className="cat-slide"
                data-active={active || undefined}
                style={{ '--p': (i - index + drag / width).toFixed(3) } as CSSProperties}
                aria-roledescription="слайд"
                aria-label={`${i + 1} из ${items.length}: ${c.name}`}
                {...(active ? {} : { inert: true })}
              >
                <div className="cat-card">
                  <div className="cat-photo">
                    {c.photo && (
                      <img
                        src={c.photo.src}
                        srcSet={c.photo.srcset}
                        sizes="(min-width: 1200px) 560px, (min-width: 768px) 48vw, 100vw"
                        width={c.photo.width}
                        height={c.photo.height}
                        alt={`Натяжной потолок, полотно ${c.name}`}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        decoding="async"
                        draggable={false}
                      />
                    )}
                    {c.badge && <span className="canvas-badge">{c.badge}</span>}
                    <span className="cat-count" aria-hidden="true">
                      {i + 1} / {items.length}
                    </span>
                  </div>

                  <div className="cat-info">
                    <p className="cat-rise text-[0.8125rem] font-medium tracking-wide text-ink-soft uppercase" style={d(0)}>
                      {c.origin}
                    </p>
                    <h3 className="cat-rise mt-1.5 font-display text-[1.875rem] leading-tight font-semibold tracking-[-0.02em] sm:text-[2.25rem]" style={d(1)}>
                      {c.name}
                      <span className="ml-2 align-middle font-sans text-[0.9375rem] whitespace-nowrap font-normal tracking-normal text-ink-soft">{c.nameRu}</span>
                    </h3>
                    <p className="cat-rise mt-3 flex items-baseline gap-1.5" style={d(2)}>
                      <b className="font-display text-[2.5rem] leading-none font-semibold tracking-[-0.03em] text-brand tabular-nums">{rub(c.price)} ₽</b>
                      <span className="text-[0.9375rem] text-ink-soft">за м²</span>
                    </p>
                    <p className="cat-rise mt-4 text-[1rem] leading-relaxed text-ink-soft" style={d(3)}>
                      {c.description}
                    </p>
                    <ul className="cat-rise mt-4 grid gap-2 text-[0.9375rem]" style={d(4)}>
                      {c.points.map((pt) => (
                        <li key={pt} className="flex gap-2.5">
                          <svg className="mt-[0.3em] shrink-0 text-brand" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="m5 12 5 5 9-10" />
                          </svg>
                          {pt}
                        </li>
                      ))}
                    </ul>
                    <div className="cat-rise mt-auto flex flex-wrap gap-2.5 pt-6" style={d(5)}>
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
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <div className="cat-tabs" role="tablist" aria-label="Выбор полотна">
          {items.map((c, i) => (
            <button key={c.id} type="button" role="tab" className="chip whitespace-nowrap" aria-selected={i === index} onClick={() => go(i)}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="ml-auto flex shrink-0 gap-2">
          <button type="button" className="cat-arrow" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Предыдущее полотно">
            <IconChevronLeft size={22} />
          </button>
          <button type="button" className="cat-arrow" onClick={() => go(index + 1)} disabled={index === last} aria-label="Следующее полотно">
            <IconChevronRight size={22} />
          </button>
        </div>
      </div>

      <p className="cat-hint mt-3 text-[0.875rem] text-ink-soft" data-hidden={!hint || undefined} aria-hidden="true">
        Листайте пальцем или нажмите стрелку — там ещё {last} {last === 1 ? 'полотно' : 'полотна'}
      </p>
    </div>
  );
}
