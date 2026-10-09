import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useStore } from '@nanostores/react';
import { measureTimes, site } from '../../config/site';
import { prices } from '../../config/prices';
import { formatRub, roomSummary } from '../../lib/pricing';
import { plural } from '../../lib/plural';
import { useClientStore } from '../../lib/useMounted';
import { buildOrderMessage, emptyContact, waLink, type Contact } from '../../lib/whatsapp';
import {
  $cartOpen,
  $contact,
  $order,
  clearOrder,
  duplicateRoom,
  editRoom,
  removeRoom,
  resetDraft,
  scrollToCalc,
} from '../../stores/order';
import { IconClose, IconCopy, IconEdit, IconPhone, IconPlus, IconTrash, IconWhatsApp } from '../icons';

const emptyOrder = { items: [], subtotal: 0, minApplied: false, total: 0 } as ReturnType<typeof $order.get>;
const OTHER = '__other';

function siteOrigin() {
  if (typeof window === 'undefined') return site.url;
  return /^(localhost|127\.|0\.0\.0\.0)/.test(window.location.hostname) ? site.url : window.location.origin;
}

export default function CartDrawer() {
  const open = useStore($cartOpen);
  const order = useClientStore($order, emptyOrder);
  const contact = useClientStore($contact, emptyContact);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const citySelectRef = useRef<HTMLSelectElement>(null);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [otherCity, setOtherCity] = useState(false);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setSent(false);
      setError('');
    }
    if (!open && d.open) d.close();
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }, [open]);

  const set = (patch: Partial<Contact>) => $contact.set({ ...$contact.get(), ...patch });
  const rooms = order.items.map((i) => i.room);
  const message = buildOrderMessage(rooms, contact, siteOrigin());
  const cityIsListed = site.cities.includes(contact.city);
  const cityValue = cityIsListed ? contact.city : otherCity || contact.city ? OTHER : '';

  const close = () => $cartOpen.set(false);
  const goToCalc = (fresh: boolean) => {
    if (fresh) resetDraft();
    close();
    if (document.getElementById('calc')) setTimeout(scrollToCalc, 50);
    else window.location.href = '/#calc';
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="cart-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[30rem] border-0 bg-ceiling p-0 text-ink shadow-[var(--shadow-float)] open:animate-slide-in"
      onClose={close}
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-plane px-5 py-4">
          <h2 id="cart-title" className="font-display text-[1.25rem] font-semibold">
            Ваш заказ
          </h2>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-lg ring-1 ring-line ring-inset hover:bg-haze"
            onClick={close}
            aria-label="Закрыть заказ"
          >
            <IconClose size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          {rooms.length === 0 ? (
            <div className="rounded-[var(--radius-card)] bg-plane p-5 ring-1 ring-line">
              <p className="font-semibold">В заказе пока пусто</p>
              <p className="mt-1 text-[0.9375rem] text-ink-soft">
                Соберите потолок для комнаты в калькуляторе — это займёт пару минут. Потом можно добавить остальные комнаты.
              </p>
              <button type="button" className="btn-primary mt-4 w-full" onClick={() => goToCalc(false)}>
                Перейти к расчёту
              </button>
            </div>
          ) : (
            <>
              <ul className="grid gap-3">
                {order.items.map(({ room, total }, i) => (
                  <li key={room.id} className="rounded-[var(--radius-card)] bg-plane p-4 ring-1 ring-line">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="font-semibold">
                        {i + 1}. {room.name || 'Комната'}
                      </p>
                      <p className="shrink-0 font-semibold tabular-nums">{formatRub(total)}</p>
                    </div>
                    <p className="mt-1 text-[0.875rem] leading-snug text-ink-soft">{roomSummary(room)}</p>
                    {room.refs.length > 0 && (
                      <p className="mt-1 text-[0.875rem] text-ink-soft">
                        Понравилось {room.refs.length} {plural(room.refs.length, ['пример', 'примера', 'примеров'])}
                      </p>
                    )}
                    {confirmId === room.id ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[0.9375rem]">
                        <span>Удалить комнату из заказа?</span>
                        <button
                          type="button"
                          className="rounded-lg bg-danger px-3 py-1.5 font-semibold text-white"
                          onClick={() => {
                            removeRoom(room.id);
                            setConfirmId(null);
                          }}
                        >
                          Удалить
                        </button>
                        <button type="button" className="rounded-lg px-3 py-1.5 font-semibold ring-1 ring-line" onClick={() => setConfirmId(null)}>
                          Оставить
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <SmallButton onClick={() => editRoom(room.id)} icon={<IconEdit size={16} />}>
                          Изменить
                        </SmallButton>
                        <SmallButton onClick={() => duplicateRoom(room.id)} icon={<IconCopy size={16} />}>
                          Копия
                        </SmallButton>
                        <SmallButton onClick={() => setConfirmId(room.id)} icon={<IconTrash size={16} />}>
                          Удалить
                        </SmallButton>
                      </div>
                    )}
                  </li>
                ))}
              </ul>

              <button type="button" className="btn-ghost mt-3 w-full" onClick={() => goToCalc(true)}>
                <IconPlus size={18} />
                Добавить комнату
              </button>

              <div className="mt-5 rounded-[var(--radius-card)] bg-haze p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">
                    Итого за {rooms.length} {plural(rooms.length)}
                  </span>
                  <span className="font-display text-[1.375rem] font-semibold tabular-nums">{formatRub(order.total)}</span>
                </div>
                <p className="mt-1 text-[0.8125rem] leading-snug text-ink-soft">
                  {order.minApplied
                    ? `Расчёт ${formatRub(order.subtotal)}, но минимальный заказ — ${formatRub(prices.minOrder)}. `
                    : ''}
                  Цена предварительная: точную сумму Иса назовёт после бесплатного замера.
                </p>
              </div>

              <form
                className="mt-6 grid gap-4"
                onSubmit={(e) => e.preventDefault()}
                aria-labelledby="cart-contact-title"
                noValidate
              >
                <h3 id="cart-contact-title" className="text-[1.0625rem] font-semibold">
                  Куда приехать на замер
                </h3>

                <div>
                  <label htmlFor="cart-city" className="label">
                    Город или район
                  </label>
                  <select
                    id="cart-city"
                    ref={citySelectRef}
                    className="field select-field"
                    value={cityValue}
                    aria-invalid={Boolean(error) || undefined}
                    aria-describedby={error ? 'cart-city-error' : undefined}
                    onChange={(e) => {
                      setError('');
                      if (e.target.value === OTHER) {
                        setOtherCity(true);
                        set({ city: '' });
                      } else {
                        setOtherCity(false);
                        set({ city: e.target.value });
                      }
                    }}
                  >
                    <option value="" disabled>
                      Выберите из списка
                    </option>
                    {site.cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={OTHER}>Другой город или село</option>
                  </select>
                  {cityValue === OTHER && (
                    <input
                      className="field mt-2"
                      placeholder="Название города или села"
                      aria-label="Название города или села"
                      value={cityIsListed ? '' : contact.city}
                      onChange={(e) => {
                        setError('');
                        set({ city: e.target.value });
                      }}
                    />
                  )}
                  {error && (
                    <p id="cart-city-error" className="mt-1.5 text-[0.875rem] font-medium text-danger">
                      {error}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="cart-address" className="label">
                    Адрес <span className="font-normal text-ink-soft">— можно потом в чате</span>
                  </label>
                  <input
                    id="cart-address"
                    className="field"
                    placeholder="Улица и дом или название села"
                    autoComplete="street-address"
                    value={contact.address}
                    onChange={(e) => set({ address: e.target.value })}
                  />
                </div>

                <fieldset>
                  <legend className="label">Когда удобно на замер</legend>
                  <div className="flex flex-wrap gap-2">
                    {measureTimes.map((t) => (
                      <button key={t} type="button" className="chip" aria-pressed={contact.when === t} onClick={() => set({ when: contact.when === t ? '' : t })}>
                        {t}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="cart-name" className="label">
                    Как к вам обращаться
                  </label>
                  <input
                    id="cart-name"
                    className="field"
                    autoComplete="given-name"
                    placeholder="Имя"
                    value={contact.name}
                    onChange={(e) => set({ name: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="cart-phone" className="label">
                    Другой номер для звонка <span className="font-normal text-ink-soft">— если нужно</span>
                  </label>
                  <input
                    id="cart-phone"
                    className="field"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+7"
                    aria-describedby="cart-phone-hint"
                    value={contact.phone}
                    onChange={(e) => set({ phone: e.target.value })}
                  />
                  <p id="cart-phone-hint" className="mt-1.5 text-[0.8125rem] text-ink-soft">
                    Ваш номер WhatsApp Иса увидит и так.
                  </p>
                </div>

                <div>
                  <label htmlFor="cart-comment" className="label">
                    Комментарий к заказу
                  </label>
                  <textarea
                    id="cart-comment"
                    className="field min-h-[5.5rem] resize-y"
                    placeholder="Например, квартира на 5 этаже, ремонт закончим к марту"
                    value={contact.comment}
                    onChange={(e) => set({ comment: e.target.value })}
                  />
                </div>
              </form>
            </>
          )}
        </div>

        {rooms.length > 0 && (
          <div className="border-t border-line bg-plane px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {sent ? (
              <div className="mb-3 rounded-[var(--radius-control)] bg-haze px-3.5 py-3 text-[0.9375rem]" role="status">
                Открыли WhatsApp с текстом заказа. Нажмите «Отправить» в чате — и заказ уйдёт Исе.{' '}
                <button type="button" className="font-semibold text-brand-deep underline-offset-4 hover:underline" onClick={() => clearOrder()}>
                  Очистить заказ
                </button>
              </div>
            ) : null}
            <a
              href={waLink(message)}
              target="_blank"
              rel="noopener"
              className="btn-wa w-full text-[1rem]"
              onClick={(e) => {
                if (!contact.city.trim()) {
                  e.preventDefault();
                  setError('Выберите город — так Иса поймёт, куда ехать на замер.');
                  citySelectRef.current?.focus();
                  return;
                }
                setSent(true);
              }}
            >
              <IconWhatsApp size={20} />
              Отправить заказ в WhatsApp
            </a>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost min-h-11 text-[0.875rem]" onClick={copy}>
                <IconCopy size={16} />
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
              <a href={`tel:+${site.phoneDigits}`} className="btn-ghost min-h-11 text-[0.875rem]">
                <IconPhone size={16} />
                Позвонить
              </a>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}

function SmallButton({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[0.875rem] font-medium text-ink-soft ring-1 ring-line ring-inset hover:bg-haze hover:text-ink"
    >
      {icon}
      {children}
    </button>
  );
}
