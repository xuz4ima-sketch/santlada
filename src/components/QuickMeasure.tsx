import { useId, useRef, useState } from 'react';
import { canvases } from '../config/canvases';
import { measureTimes, site } from '../config/site';
import { buildMeasureMessage, emptyContact, waLink, type Contact } from '../lib/whatsapp';
import { IconWhatsApp } from './icons';

const OTHER = '__other';

interface Props {
  /** Полотно, выбранное в каталоге */
  canvas?: string;
  /** Полотно уже выбрано в каталоге — выбор полотна в форме не показываем */
  locked?: boolean;
}

/** Заказ полотна и запись на замер — заявка уходит мастеру в WhatsApp */
export default function QuickMeasure({ canvas = '', locked = false }: Props) {
  const uid = useId();
  const [contact, setContact] = useState<Contact>({ ...emptyContact, canvas });
  const [otherCity, setOtherCity] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  const set = (patch: Partial<Contact>) => setContact((c) => ({ ...c, ...patch }));
  const listed = site.cities.includes(contact.city);
  const cityValue = listed ? contact.city : otherCity || contact.city ? OTHER : '';
  const ordering = Boolean(contact.canvas);

  return (
    <form className="grid gap-4" onSubmit={(e) => e.preventDefault()} noValidate aria-label={ordering ? 'Заказ полотна' : 'Запись на бесплатный замер'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-city`} className="label">
            Город или район
          </label>
          <select
            id={`${uid}-city`}
            ref={selectRef}
            className="field select-field"
            value={cityValue}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? `${uid}-city-error` : undefined}
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
              value={listed ? '' : contact.city}
              onChange={(e) => {
                setError('');
                set({ city: e.target.value });
              }}
            />
          )}
          {error && (
            <p id={`${uid}-city-error`} className="mt-1.5 text-[0.875rem] font-medium text-danger">
              {error}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${uid}-name`} className="label">
            Как к вам обращаться
          </label>
          <input
            id={`${uid}-name`}
            className="field"
            autoComplete="given-name"
            placeholder="Имя"
            value={contact.name}
            onChange={(e) => set({ name: e.target.value })}
          />
        </div>
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

      {!locked && (
        <fieldset>
          <legend className="label">Полотно</legend>
          <div className="flex flex-wrap gap-2">
            {canvases.map((c) => (
              <button key={c.id} type="button" className="chip" aria-pressed={contact.canvas === c.name} onClick={() => set({ canvas: contact.canvas === c.name ? '' : c.name })}>
                {c.name}
              </button>
            ))}
            <button type="button" className="chip" aria-pressed={contact.canvas === ''} onClick={() => set({ canvas: '' })}>
              Посоветуйте
            </button>
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor={`${uid}-comment`} className="label">
          Что нужно сделать
        </label>
        <textarea
          id={`${uid}-comment`}
          className="field min-h-[5.5rem] resize-y"
          placeholder="Например, две комнаты и кухня, хочу световые линии. Фото понравившегося потолка можно прислать в чате"
          value={contact.comment}
          onChange={(e) => set({ comment: e.target.value })}
        />
      </div>

      <a
        href={waLink(buildMeasureMessage(contact))}
        target="_blank"
        rel="noopener"
        className="btn-wa w-full text-[1rem] sm:w-auto sm:justify-self-start"
        onClick={(e) => {
          if (!contact.city.trim()) {
            e.preventDefault();
            setError('Выберите город — так я пойму, куда ехать на замер.');
            selectRef.current?.focus();
            return;
          }
          setSent(true);
        }}
      >
        <IconWhatsApp size={20} />
        {ordering ? 'Отправить заказ мастеру' : 'Записаться на замер'}
      </a>
      {sent && (
        <p className="text-[0.9375rem] text-ink-soft" role="status">
          Открыли WhatsApp с текстом заказа. Нажмите «Отправить» в чате — заявка придёт мне, и, если есть фото потолка, который понравился, приложите его. Я отвечу и договорюсь с вами о времени.
        </p>
      )}
    </form>
  );
}
