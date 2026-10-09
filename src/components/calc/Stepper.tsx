import { useEffect, useState, type ReactNode } from 'react';
import { IconMinus, IconPlus } from '../icons';

interface Props {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: ReactNode;
  /** Сколько знаков после запятой разрешено */
  decimals?: number;
}

const toText = (n: number) => String(n).replace('.', ',');

export default function Stepper({ id, label, value, onChange, min = 0, max = 999, step = 1, unit, hint, decimals = 0 }: Props) {
  const [text, setText] = useState(toText(value));
  useEffect(() => setText(toText(value)), [value]);

  const clamp = (n: number) => {
    const f = 10 ** decimals;
    return Math.min(max, Math.max(min, Math.round(n * f) / f));
  };
  const commit = (raw: string) => {
    const n = Number(raw.replace(',', '.').replace(/[^\d.]/g, ''));
    const next = Number.isFinite(n) && raw.trim() !== '' ? clamp(n) : min;
    onChange(next);
    setText(toText(next));
  };
  const hintId = hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-control)] bg-plane ring-1 ring-line ring-inset transition-colors hover:bg-haze disabled:opacity-40"
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          aria-label={`Уменьшить: ${label}`}
        >
          <IconMinus size={18} />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            className="field h-12 pr-12 text-center text-[1.0625rem] font-semibold tabular-nums"
            inputMode={decimals ? 'decimal' : 'numeric'}
            value={text}
            aria-describedby={hintId}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit((e.target as HTMLInputElement).value);
              }
            }}
          />
          {unit && (
            <span className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-[0.9375rem] text-ink-soft">
              {unit}
            </span>
          )}
        </div>
        <button
          type="button"
          className="grid size-12 shrink-0 place-items-center rounded-[var(--radius-control)] bg-plane ring-1 ring-line ring-inset transition-colors hover:bg-haze disabled:opacity-40"
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          aria-label={`Увеличить: ${label}`}
        >
          <IconPlus size={18} />
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-[0.875rem] leading-snug text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );
}
