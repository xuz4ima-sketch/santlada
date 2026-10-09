import { useEffect, useRef, useState } from 'react';
import { canvases } from '../config/canvases';
import { ORDER_EVENT } from '../lib/order';
import QuickMeasure from './QuickMeasure';
import { IconClose } from './icons';

const rub = new Intl.NumberFormat('ru-RU').format;

/** Окно заказа: открывается из каталога с выбранным полотном, заявка уходит мастеру в WhatsApp */
export default function OrderDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  const [canvas, setCanvas] = useState('');
  // Новый ключ — новая пустая форма при каждом открытии
  const [session, setSession] = useState(0);

  useEffect(() => {
    const open = (e: Event) => {
      setCanvas((e as CustomEvent<{ canvas?: string }>).detail?.canvas ?? '');
      setSession((n) => n + 1);
      if (!ref.current?.open) ref.current?.showModal();
    };
    window.addEventListener(ORDER_EVENT, open);
    return () => window.removeEventListener(ORDER_EVENT, open);
  }, []);

  const info = canvases.find((c) => c.name === canvas);

  return (
    <dialog
      ref={ref}
      className="order-dialog"
      aria-labelledby="order-title"
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="order-head">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium tracking-wide text-ink-soft uppercase">Заказ полотна</p>
          <h2 id="order-title" className="mt-1 font-display text-[1.5rem] leading-tight font-semibold tracking-[-0.02em]">
            {canvas || 'Заказ потолка'}
          </h2>
          {info && (
            <p className="mt-1 text-[0.9375rem] text-ink-soft">
              <b className="font-semibold text-brand tabular-nums">{rub(info.price)} ₽</b> за м² · {info.origin}
            </p>
          )}
        </div>
        <button type="button" className="cat-arrow shrink-0" onClick={() => ref.current?.close()} aria-label="Закрыть">
          <IconClose size={20} />
        </button>
      </div>
      <p className="mb-5 text-[0.9375rem] leading-relaxed text-ink-soft">
        Оставьте город и пару деталей — заявка придёт мне в WhatsApp. Я отвечу, договоримся о бесплатном замере и я назову точную стоимость.
      </p>
      {session > 0 && <QuickMeasure key={session} canvas={canvas} locked />}
    </dialog>
  );
}
