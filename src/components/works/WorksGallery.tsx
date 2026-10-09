import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ceilingOrder, ceilingTypes, type CeilingType } from '../../config/site';
import type { Work } from '../../lib/works';
import { wantLike } from '../../stores/order';
import { IconChevronLeft, IconChevronRight, IconClose, IconHeart, IconPlay } from '../icons';

export type Filter = CeilingType | 'all';

interface Props {
  works: Work[];
  /** На главной часть работ прячется на телефоне до нажатия «Показать ещё» */
  compact?: boolean;
  /** Синхронизировать фильтр с адресом страницы (?vid=linii) */
  syncUrl?: boolean;
  /** Кнопки фильтра по виду потолка */
  filters?: boolean;
  /** masonry — фото в натуральных пропорциях, grid — ровная сетка квадратов */
  layout?: 'masonry' | 'grid';
}

export const filterNames: Record<Filter, string> = {
  all: 'Все',
  linii: 'Световые линии',
  paryashchiy: 'Парящие',
  tenevoy: 'Теневые',
  klassika: 'Классические',
};

const MOBILE_LIMIT = 8;

export default function WorksGallery({ works, compact = false, syncUrl = false, filters = true, layout = 'masonry' }: Props) {
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const list = useMemo(() => (filter === 'all' ? works : works.filter((w) => w.types.includes(filter))), [works, filter]);
  const counts = useMemo(() => {
    const c = { all: works.length } as Record<Filter, number>;
    for (const t of ceilingOrder) c[t] = works.filter((w) => w.types.includes(t)).length;
    return c;
  }, [works]);

  // Ссылка вида /raboty/#w-226 сразу открывает работу; ?vid=linii — включает фильтр
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vid = params.get('vid') as Filter | null;
    let current: Filter = 'all';
    if (syncUrl && filters && vid && vid in filterNames) {
      current = vid;
      setFilter(vid);
    }
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const inCurrent = (current === 'all' ? works : works.filter((w) => w.types.includes(current as CeilingType))).findIndex((w) => w.id === id);
    if (inCurrent >= 0) setOpenIndex(inCurrent);
    else {
      const all = works.findIndex((w) => w.id === id);
      if (all >= 0) {
        setFilter('all');
        setOpenIndex(all);
      }
    }
  }, [works, syncUrl, filters]);

  const choose = (f: Filter) => {
    setFilter(f);
    setExpanded(false);
    if (syncUrl) {
      const url = new URL(window.location.href);
      if (f === 'all') url.searchParams.delete('vid');
      else url.searchParams.set('vid', f);
      history.replaceState(null, '', url);
    }
  };

  return (
    <div>
      {filters && (
        <div className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Фильтр по виду потолка">
          <div className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
            {(['all', ...ceilingOrder] as Filter[]).map((f) => (
              <button key={f} type="button" className="chip whitespace-nowrap" aria-pressed={filter === f} onClick={() => choose(f)}>
                {filterNames[f]}
                <span className="text-[0.8125rem] tabular-nums opacity-60">{counts[f]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className={layout === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-4' : 'columns-2 gap-3 sm:columns-3 lg:columns-4 [&>li]:mb-3'}>
        {list.map((work, i) => (
          <li
            key={work.id}
            id={syncUrl ? work.id : undefined}
            className={`break-inside-avoid ${compact && !expanded && i >= MOBILE_LIMIT ? 'hidden lg:block' : ''}`}
          >
            <Tile work={work} square={layout === 'grid'} onOpen={() => setOpenIndex(i)} />
          </li>
        ))}
      </ul>

      {compact && !expanded && list.length > MOBILE_LIMIT && (
        <button type="button" className="btn-ghost mt-2 w-full lg:hidden" onClick={() => setExpanded(true)}>
          Показать ещё {list.length - MOBILE_LIMIT}
        </button>
      )}

      {openIndex !== null && list[openIndex] && (
        <Lightbox
          list={list}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </div>
  );
}

function Tile({ work, square, onOpen }: { work: Work; square: boolean; onOpen: () => void }) {
  return (
    <figure className="group relative overflow-hidden rounded-[var(--radius-card)] bg-haze">
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-label={`Открыть: ${work.caption}${work.kind === 'video' ? ', видео' : ''}`}>
        <img
          src={work.thumb.src}
          srcSet={work.thumb.srcset}
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 33vw, 50vw"
          width={work.thumb.width}
          height={work.thumb.height}
          alt={work.caption}
          loading="lazy"
          decoding="async"
          className={square ? 'block aspect-square w-full object-cover' : 'block h-auto w-full'}
        />
        {work.kind === 'video' && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 rounded-full bg-ink/75 px-2.5 py-1 text-[0.75rem] font-semibold text-white">
            <IconPlay size={12} />
            Видео
          </span>
        )}
      </button>
      <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-ink/80 via-ink/40 to-transparent p-3 pt-12 text-[0.875rem] leading-snug text-white [@media(hover:hover)]:block [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        {work.caption}
      </figcaption>
      <button
        type="button"
        onClick={() => wantLike({ id: work.id, type: work.types[0] })}
        className="absolute top-2.5 right-2.5 hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[0.8125rem] font-semibold text-ink opacity-0 shadow-[var(--shadow-float)] transition-opacity group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)]:inline-flex"
      >
        <IconHeart size={14} />
        Хочу такой
      </button>
    </figure>
  );
}

export function Lightbox({
  list,
  index,
  onIndex,
  onClose,
}: {
  list: Work[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const startX = useRef<number | null>(null);
  const work = list[index];
  const prev = useCallback(() => onIndex((index - 1 + list.length) % list.length), [index, list.length, onIndex]);
  const next = useCallback(() => onIndex((index + 1) % list.length), [index, list.length, onIndex]);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.documentElement.style.overflow = '';
      history.replaceState(null, '', window.location.pathname + window.location.search);
    };
  }, []);

  useEffect(() => {
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${work.id}`);
    // Заранее подгружаем соседние фото
    for (const n of [list[(index + 1) % list.length], list[(index - 1 + list.length) % list.length]]) {
      if (n && n.kind === 'photo') new Image().src = n.full.src;
    }
  }, [work.id, index, list]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  const types = work.types.map((t) => ceilingTypes[t].name).join(', ');

  return (
    <dialog
      ref={ref}
      aria-label={work.caption}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-ink/95 p-0 text-white"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-[0.875rem] text-white/70 tabular-nums">
            {index + 1} из {list.length}
          </p>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20"
            onClick={onClose}
            aria-label="Закрыть просмотр"
            autoFocus
          >
            <IconClose size={22} />
          </button>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
          onPointerDown={(e) => {
            startX.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (startX.current === null) return;
            const dx = e.clientX - startX.current;
            startX.current = null;
            if (Math.abs(dx) > 50) {
              if (dx > 0) prev();
              else next();
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          {work.kind === 'video' && work.video ? (
            <video
              key={work.id}
              src={work.video}
              poster={work.full.src}
              controls
              autoPlay
              muted
              loop
              playsInline
              className="max-h-full max-w-full rounded-[var(--radius-card)] bg-black"
            />
          ) : (
            <img
              key={work.id}
              src={work.full.src}
              width={work.full.width}
              height={work.full.height}
              alt={work.caption}
              className="max-h-full max-w-full animate-fade-in rounded-[var(--radius-card)] object-contain select-none"
              draggable={false}
            />
          )}

          {list.length > 1 && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute top-1/2 left-2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"
                aria-label="Предыдущее фото"
              >
                <IconChevronLeft size={24} />
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute top-1/2 right-2 hidden size-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 hover:bg-white/20 sm:grid"
                aria-label="Следующее фото"
              >
                <IconChevronRight size={24} />
              </button>
            </>
          )}
        </div>

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="font-semibold">{work.caption}</p>
            <p className="text-[0.875rem] text-white/70">{types}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={prev} className="btn min-h-12 flex-1 bg-white/10 text-white hover:bg-white/20 sm:hidden" aria-label="Предыдущее фото">
              <IconChevronLeft size={20} />
            </button>
            <button
              type="button"
              className="btn-primary min-h-12 flex-[3] whitespace-nowrap sm:flex-none"
              onClick={() => {
                onClose();
                wantLike({ id: work.id, type: work.types[0] });
              }}
            >
              <IconHeart size={18} />
              Хочу такой потолок
            </button>
            <button type="button" onClick={next} className="btn min-h-12 flex-1 bg-white/10 text-white hover:bg-white/20 sm:hidden" aria-label="Следующее фото">
              <IconChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
