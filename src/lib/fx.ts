/*
 * Мелкие эффекты, подсмотренные в React Bits: магнит у кнопок (Magnet), подсветка карточки за курсором
 * (Spotlight Card), наклон фото (Tilted Card) и «набегающие» числа (Count Up).
 * Мышь-эффекты включаются только на устройствах с мышью; магнит и наклон — ещё и без «уменьшить движение».
 * Разметка просто помечается атрибутами: data-magnet, data-spot, data-tilt, data-count.
 */

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Магнит: кнопка слегка тянется к курсору, когда он рядом (в пределах RANGE пикселей от края) */
const MAGNET_RANGE = 56;
const MAGNET_PULL = 0.3;
const MAGNET_MAX = 12;
const magnetShift = new WeakMap<HTMLElement, { x: number; y: number }>();

function setMagnet(el: HTMLElement, x: number, y: number) {
  magnetShift.set(el, { x, y });
  el.style.setProperty('--mx', `${x.toFixed(1)}px`);
  el.style.setProperty('--my', `${y.toFixed(1)}px`);
}

function releaseMagnets() {
  for (const el of document.querySelectorAll<HTMLElement>('[data-magnet]')) {
    if (magnetShift.get(el)) setMagnet(el, 0, 0);
  }
}

export function initPointerFx() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      const target = event.target as Element | null;

      const spot = target?.closest<HTMLElement>('[data-spot]');
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--sx', `${event.clientX - r.left}px`);
        spot.style.setProperty('--sy', `${event.clientY - r.top}px`);
      }

      if (reduceMotion()) return;

      const tilt = target?.closest<HTMLElement>('[data-tilt]');
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        const px = (event.clientX - r.left) / r.width - 0.5;
        const py = (event.clientY - r.top) / r.height - 0.5;
        tilt.style.setProperty('--ry', `${(px * 9).toFixed(2)}deg`);
        tilt.style.setProperty('--rx', `${(-py * 7).toFixed(2)}deg`);
      }

      for (const el of document.querySelectorAll<HTMLElement>('[data-magnet]')) {
        const r = el.getBoundingClientRect();
        if (!r.width) continue;
        const shift = magnetShift.get(el) ?? { x: 0, y: 0 };
        // rect уже сдвинут самим магнитом — возвращаем центр на место, иначе кнопка будет дрожать
        const dx = event.clientX - (r.left + r.width / 2 - shift.x);
        const dy = event.clientY - (r.top + r.height / 2 - shift.y);
        const near = Math.abs(dx) < r.width / 2 + MAGNET_RANGE && Math.abs(dy) < r.height / 2 + MAGNET_RANGE;
        if (near) {
          const clamp = (v: number) => Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, v));
          setMagnet(el, clamp(dx * MAGNET_PULL), clamp(dy * MAGNET_PULL));
        } else if (shift.x || shift.y) {
          setMagnet(el, 0, 0);
        }
      }
    },
    { passive: true },
  );

  document.addEventListener('pointerout', (event) => {
    const tilt = (event.target as Element | null)?.closest<HTMLElement>('[data-tilt]');
    if (tilt && !tilt.contains(event.relatedTarget as Node | null)) {
      tilt.style.setProperty('--rx', '0deg');
      tilt.style.setProperty('--ry', '0deg');
    }
  });

  document.documentElement.addEventListener('mouseleave', releaseMagnets);
}

/**
 * Число «набегает» от ~55% до значения из data-count (суффикс — из data-suffix, например « ₽»).
 * Разметка уже содержит итоговое число, поэтому без скрипта и при «уменьшить движение» ничего не меняется.
 */
const ruNumber = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const counting = new WeakMap<HTMLElement, number>();

const renderCount = (el: HTMLElement, n: number) => {
  el.textContent = `${ruNumber.format(Math.round(n))}${el.dataset.suffix ?? ''}`;
};

/** Ставит число в начальное значение заранее — чтобы до начала счёта не мелькал итог */
export function primeCount(el: HTMLElement | null | undefined) {
  const to = Number(el?.dataset.count);
  if (el && Number.isFinite(to) && !reduceMotion()) renderCount(el, to * 0.55);
}

export function countUp(el: HTMLElement | null | undefined, { ms = 900, delay = 0 } = {}) {
  if (!el || reduceMotion()) return;
  const to = Number(el.dataset.count);
  if (!Number.isFinite(to)) return;
  const from = to * 0.55;
  const render = (n: number) => renderCount(el, n);

  cancelAnimationFrame(counting.get(el) ?? 0);
  render(from);
  const start = performance.now() + delay;
  const tick = (now: number) => {
    const p = Math.min(1, Math.max(0, (now - start) / ms));
    render(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) counting.set(el, requestAnimationFrame(tick));
  };
  counting.set(el, requestAnimationFrame(tick));
}
