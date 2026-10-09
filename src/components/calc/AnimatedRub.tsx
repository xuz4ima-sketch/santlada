import { useEffect, useRef, useState } from 'react';
import { formatRub } from '../../lib/pricing';

/**
 * Сумма, которая «набегает» к новому значению (как Count Up в React Bits).
 * Скринридер получает сразу итог, а не промежуточные числа.
 */
export default function AnimatedRub({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    if (current.current === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current.current = value;
      setShown(value);
      return;
    }
    const from = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / 550);
      current.current = Math.round(from + (value - from) * (1 - (1 - p) ** 3));
      setShown(current.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <>
      <span aria-hidden="true">{formatRub(shown)}</span>
      <span className="sr-only">{formatRub(value)}</span>
    </>
  );
}
