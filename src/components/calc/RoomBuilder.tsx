import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ceilingOrder, ceilingTypes, roomNames, type CeilingType } from '../../config/site';
import { canvasNames, prices, type Canvas } from '../../config/prices';
import { AREA_MAX, AREA_MIN, calcRoom, estimatePerimeter, formatNum, formatRub, newRoom, perimeterOf } from '../../lib/pricing';
import AnimatedRub from './AnimatedRub';
import { plural } from '../../lib/plural';
import { useClientStore } from '../../lib/useMounted';
import {
  $calcInView,
  $cartOpen,
  $draft,
  $isEditing,
  $order,
  commitDraft,
  resetDraft,
  setDraftType,
  toggleRef,
  updateDraft,
} from '../../stores/order';
import { IconCheck, IconHeart, IconPlay } from '../icons';
import CeilingPreview from './CeilingPreview';
import Stepper from './Stepper';

export interface Example {
  id: string;
  type: CeilingType;
  src: string;
  srcset: string;
  caption: string;
  video: boolean;
}

interface Props {
  examples: Example[];
  fromPrices: Record<CeilingType, number>;
}

const serverDraft = newRoom({ id: 'server' });
const emptyOrder = { items: [], subtotal: 0, minApplied: false, total: 0 } as ReturnType<typeof $order.get>;
const canvasOrder: Canvas[] = ['mat', 'satin', 'gloss', 'fabric'];

export default function RoomBuilder({ examples, fromPrices }: Props) {
  const room = useClientStore($draft, serverDraft);
  const editing = useClientStore($isEditing, false);
  const order = useClientStore($order, emptyOrder);
  const calc = calcRoom(room);
  const rootRef = useRef<HTMLDivElement>(null);
  const [exactPerimeter, setExactPerimeter] = useState(false);

  useEffect(() => setExactPerimeter(room.perimeter !== null), [room.id]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => $calcInView.set(entry.isIntersecting), {
      rootMargin: '-35% 0px -35% 0px',
    });
    io.observe(el);
    return () => {
      io.disconnect();
      $calcInView.set(false);
    };
  }, []);

  const typeExamples = examples.filter((e) => e.type === room.type);
  const customName = !roomNames.includes(room.name);
  const suggestedSpots = Math.max(1, Math.round(room.area / 2));

  const summary = (
    <Summary
      title={`${room.name || 'Комната'}: ${ceilingTypes[room.type].name.toLowerCase()}`}
      lines={calc.lines}
      total={calc.total}
      editing={editing}
      orderCount={order.items.length}
      orderTotal={order.total}
    />
  );

  return (
    <div ref={rootRef} className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-10 xl:grid-cols-[minmax(0,1fr)_25rem]">
      <form
        className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Расчёт стоимости потолка"
      >
        {editing && (
          <p className="rounded-[var(--radius-card)] bg-haze px-4 py-3 text-[0.9375rem]">
            Вы меняете комнату «{room.name}» из заказа. Сохраните изменения, когда закончите.
          </p>
        )}

        <Step n={1} title="Комната">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Название комнаты">
            {roomNames.map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                aria-pressed={room.name === name}
                onClick={() => updateDraft({ name })}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="mt-3 max-w-sm">
            <label htmlFor="calc-name" className="label">
              Или своё название
            </label>
            <input
              id="calc-name"
              className="field"
              placeholder="Например, кабинет"
              maxLength={40}
              value={customName ? room.name : ''}
              onChange={(e) => updateDraft({ name: e.target.value })}
            />
          </div>
        </Step>

        <Step n={2} title="Вид потолка">
          <fieldset>
            <legend className="sr-only">Вид потолка</legend>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {ceilingOrder.map((type) => {
                const thumb = examples.find((e) => e.type === type);
                return (
                  <label
                    key={type}
                    data-spot
                    className="group relative flex cursor-pointer items-center gap-3 rounded-[var(--radius-card)] bg-plane p-2.5 pr-3.5 ring-1 ring-line ring-inset transition-shadow hover:ring-mist has-[:checked]:ring-2 has-[:checked]:ring-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
                  >
                    <input
                      type="radio"
                      name="calc-type"
                      value={type}
                      checked={room.type === type}
                      onChange={() => setDraftType(type)}
                      className="sr-only"
                    />
                    {thumb && (
                      <img
                        src={thumb.src}
                        srcSet={thumb.srcset}
                        sizes="64px"
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-16 shrink-0 rounded-[var(--radius-control)] object-cover"
                      />
                    )}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{ceilingTypes[type].name}</span>
                      <span className="text-[0.875rem] text-ink-soft">от {formatRub(fromPrices[type])} за м²</span>
                    </span>
                    <span
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-brand text-white opacity-0 transition-opacity group-has-[:checked]:opacity-100"
                      aria-hidden
                    >
                      <IconCheck size={15} strokeWidth={2.6} />
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="mt-5 text-[0.9375rem] leading-snug">
            {ceilingTypes[room.type].description}
          </p>

          {typeExamples.length > 0 && (
            <div className="mt-5">
              <p className="label">Отметьте примеры, которые нравятся — Иса увидит их в заявке</p>
              <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-6 sm:overflow-visible">
                {typeExamples.map((ex) => {
                  const on = room.refs.includes(ex.id);
                  return (
                    <li key={ex.id} className="w-[28%] shrink-0 snap-start sm:w-auto">
                      <button
                        type="button"
                        onClick={() => toggleRef(ex.id)}
                        aria-pressed={on}
                        aria-label={`${ex.caption}${on ? ' — отмечено' : ''}`}
                        className="relative block w-full overflow-hidden rounded-[var(--radius-control)] ring-1 ring-line aria-pressed:ring-2 aria-pressed:ring-brand"
                      >
                        <img
                          src={ex.src}
                          srcSet={ex.srcset}
                          sizes="120px"
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="aspect-square w-full object-cover"
                        />
                        {ex.video && (
                          <span className="absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-ink/70 text-white">
                            <IconPlay size={12} />
                          </span>
                        )}
                        <span
                          className={`absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full transition-colors ${
                            on ? 'bg-brand text-white' : 'bg-white/90 text-ink'
                          }`}
                        >
                          {on ? <IconCheck size={16} strokeWidth={2.4} /> : <IconHeart size={15} />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <a href={`/raboty/?vid=${room.type}`} className="mt-1 inline-block text-[0.9375rem] font-medium text-brand-deep underline-offset-4 hover:underline">
                Все примеры этого вида
              </a>
            </div>
          )}

          <div className="mt-6 lg:hidden">
            <PreviewCard room={room} />
          </div>
        </Step>

        <Step n={3} title="Полотно">
          <fieldset>
            <legend className="sr-only">Фактура полотна</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {canvasOrder.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer flex-col rounded-[var(--radius-control)] bg-plane px-3.5 py-3 ring-1 ring-line ring-inset hover:ring-mist has-[:checked]:bg-ink has-[:checked]:text-white has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand"
                >
                  <input
                    type="radio"
                    name="calc-canvas"
                    value={c}
                    checked={room.canvas === c}
                    onChange={() => updateDraft({ canvas: c })}
                    className="sr-only"
                  />
                  <span className="font-semibold">{canvasNames[c]}</span>
                  <span className="text-[0.8125rem] opacity-75">{formatRub(prices.canvas[c])} за м²</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="label">Цвет</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { value: false, label: 'Белое' },
                { value: true, label: `Цветное, +${formatRub(prices.colorExtra)} за м²` },
              ].map((o) => (
                <label key={String(o.value)} className="chip cursor-pointer has-[:checked]:bg-ink has-[:checked]:text-white has-[:checked]:ring-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand">
                  <input
                    type="radio"
                    name="calc-color"
                    checked={room.colored === o.value}
                    onChange={() => updateDraft({ colored: o.value })}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
        </Step>

        <Step n={4} title="Размеры и углы">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Stepper
                id="calc-area"
                label="Площадь потолка"
                value={room.area}
                min={AREA_MIN}
                max={AREA_MAX}
                step={1}
                decimals={1}
                unit="м²"
                onChange={(area) => updateDraft({ area })}
                hint="Не знаете точно — укажите примерно, Иса всё измерит на замере."
              />
              <input
                type="range"
                min={AREA_MIN}
                max={80}
                step={0.5}
                value={Math.min(room.area, 80)}
                onChange={(e) => updateDraft({ area: Number(e.target.value) })}
                aria-label="Площадь потолка, ползунок"
                className="mt-3 w-full accent-brand"
              />
            </div>

            <div className="sm:col-span-2">
              {exactPerimeter ? (
                <Stepper
                  id="calc-perimeter"
                  label="Периметр комнаты"
                  value={perimeterOf(room)}
                  min={1}
                  max={300}
                  decimals={1}
                  unit="м"
                  onChange={(perimeter) => updateDraft({ perimeter })}
                  hint={
                    <button
                      type="button"
                      className="font-medium text-brand-deep underline-offset-4 hover:underline"
                      onClick={() => {
                        setExactPerimeter(false);
                        updateDraft({ perimeter: null });
                      }}
                    >
                      Посчитать по площади
                    </button>
                  }
                />
              ) : (
                <p className="text-[0.9375rem]">
                  Периметр ≈ <b className="tabular-nums">{formatNum(estimatePerimeter(room.area))} м</b> — посчитали по площади.{' '}
                  <button
                    type="button"
                    className="font-medium text-brand-deep underline-offset-4 hover:underline"
                    onClick={() => {
                      setExactPerimeter(true);
                      updateDraft({ perimeter: estimatePerimeter(room.area) });
                    }}
                  >
                    Указать точно
                  </button>
                </p>
              )}
            </div>

            <Stepper
              id="calc-corners"
              label="Углов в комнате"
              value={room.corners}
              min={3}
              max={40}
              onChange={(corners) => updateDraft({ corners })}
              hint={`Четыре угла входят в цену, каждый следующий — ${formatRub(prices.extraCorner[room.type])}.`}
            />
            <Stepper
              id="calc-pipes"
              label="Трубы через потолок"
              value={room.pipes}
              max={20}
              onChange={(pipes) => updateDraft({ pipes })}
              hint="Отопление или газ. Полотно аккуратно обходит каждую."
            />
          </div>
        </Step>

        <Step n={5} title="Свет">
          <div className="grid gap-5 sm:grid-cols-2">
            <Stepper
              id="calc-spots"
              label="Точечные светильники"
              value={room.spots}
              max={100}
              unit="шт"
              onChange={(spots) => updateDraft({ spots })}
              hint={
                room.spots === 0 ? (
                  <>
                    Обычно один на 2 м².{' '}
                    <button
                      type="button"
                      className="font-medium text-brand-deep underline-offset-4 hover:underline"
                      onClick={() => updateDraft({ spots: suggestedSpots })}
                    >
                      Поставить {suggestedSpots}
                    </button>
                  </>
                ) : (
                  `${formatRub(prices.spot)} за светильник с установкой.`
                )
              }
            />
            <Stepper
              id="calc-chandeliers"
              label="Люстры"
              value={room.chandeliers}
              max={10}
              unit="шт"
              onChange={(chandeliers) => updateDraft({ chandeliers })}
              hint="Закладная под люстру и подключение."
            />
            <Stepper
              id="calc-lines"
              label="Световые линии"
              value={room.linesM}
              max={300}
              decimals={1}
              unit="м"
              onChange={(linesM) => updateDraft({ linesM })}
              hint={room.type === 'linii' ? 'Общая длина всех линий. Подставили примерно — поправьте.' : 'Можно добавить к любому виду потолка.'}
            />
            <Stepper
              id="calc-led"
              label="Светодиодная подсветка"
              value={room.ledM}
              max={300}
              decimals={1}
              unit="м"
              onChange={(ledM) => updateDraft({ ledM })}
              hint={room.type === 'paryashchiy' ? 'Подсветка по периметру уже входит в парящий профиль.' : 'Лента в нише или в карнизе.'}
            />
          </div>
        </Step>

        <Step n={6} title="Карниз и пожелания">
          <div className="grid gap-5 sm:grid-cols-2">
            <Stepper
              id="calc-cornice"
              label="Скрытый карниз"
              value={room.corniceM}
              max={100}
              decimals={1}
              unit="м"
              onChange={(corniceM) => updateDraft({ corniceM })}
              hint="Ниша для штор вдоль окна. Обычно — ширина стены с окном."
            />
            <div>
              <label htmlFor="calc-comment" className="label">
                Пожелания по комнате
              </label>
              <textarea
                id="calc-comment"
                className="field min-h-[6.5rem] resize-y"
                placeholder="Например, хочу линии как на фото, высота потолка 3 м"
                maxLength={400}
                value={room.comment}
                onChange={(e) => updateDraft({ comment: e.target.value })}
              />
            </div>
          </div>
        </Step>

        <div className="lg:hidden">{summary}</div>
      </form>

      <aside className="hidden lg:block" aria-label="Схема и стоимость">
        <div className="sticky top-24 grid gap-4">
          <PreviewCard room={room} />
          {summary}
        </div>
      </aside>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-plane p-4 ring-1 ring-line sm:p-6" aria-labelledby={`calc-step-${n}`}>
      <h3 id={`calc-step-${n}`} className="mb-4 flex items-center gap-3 text-[1.125rem] font-semibold">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-haze font-display text-[0.875rem] text-brand-deep" aria-hidden>
          {n}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function PreviewCard({ room }: { room: Parameters<typeof CeilingPreview>[0]['room'] }) {
  return (
    <figure className="rounded-[var(--radius-card)] bg-plane p-3 ring-1 ring-line">
      <CeilingPreview room={room} className="block h-auto w-full" />
      <figcaption className="mt-2 px-1 text-[0.8125rem] text-ink-soft">
        Схема потолка, вид снизу. {room.corners} {plural(room.corners, ['угол', 'угла', 'углов'])}
        {room.corners > 12 ? ' — на схеме показаны не все' : ''}.
      </figcaption>
    </figure>
  );
}

function Summary({
  title,
  lines,
  total,
  editing,
  orderCount,
  orderTotal,
}: {
  title: string;
  lines: ReturnType<typeof calcRoom>['lines'];
  total: number;
  editing: boolean;
  orderCount: number;
  orderTotal: number;
}) {
  return (
    <div className="rounded-[var(--radius-card)] bg-plane p-4 ring-1 ring-line sm:p-5">
      <p className="font-semibold">{title}</p>
      <ul className="mt-3 grid gap-2 text-[0.9375rem]">
        {lines.map((l) => (
          <li key={l.label} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0">
              {l.label}
              <span className="block text-[0.8125rem] text-ink-soft tabular-nums">
                {formatNum(l.qty)} {l.unit} × {formatRub(l.price)}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums">{formatRub(l.sum)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="font-semibold">Примерно</span>
        <span className="font-display text-[1.5rem] font-semibold tabular-nums" aria-live="polite">
          <AnimatedRub value={total} />
        </span>
      </div>
      <p className="mt-1 text-[0.8125rem] leading-snug text-ink-soft">Точную цену Иса назовёт после бесплатного замера.</p>

      <div className="mt-4 grid gap-2">
        <button type="button" className="btn-primary w-full" onClick={() => commitDraft()}>
          {editing ? 'Сохранить изменения' : 'Добавить в заказ'}
        </button>
        {editing && (
          <button type="button" className="btn-ghost w-full" onClick={() => resetDraft()}>
            Отменить изменения
          </button>
        )}
      </div>

      {orderCount > 0 && (
        <p className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] bg-haze px-3.5 py-2.5 text-[0.9375rem]">
          <span>
            В заказе {orderCount} {plural(orderCount)} на {formatRub(orderTotal)}
          </span>
          <button type="button" className="font-semibold text-brand-deep underline-offset-4 hover:underline" onClick={() => $cartOpen.set(true)}>
            Открыть заказ
          </button>
        </p>
      )}
    </div>
  );
}
