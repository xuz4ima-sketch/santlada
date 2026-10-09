import { useStore } from '@nanostores/react';
import { site } from '../config/site';
import { calcRoom, formatRub, newRoom } from '../lib/pricing';
import { useClientStore } from '../lib/useMounted';
import { waLink } from '../lib/whatsapp';
import { $calcInView, $cartOpen, $draft, $isEditing, $notice, $order, commitDraft, scrollToCalc } from '../stores/order';
import { IconBag, IconPhone, IconWhatsApp } from './icons';

const emptyOrder = { items: [], subtotal: 0, minApplied: false, total: 0 } as ReturnType<typeof $order.get>;
const serverDraft = newRoom({ id: 'server' });

export default function MobileBar() {
  const order = useClientStore($order, emptyOrder);
  const draft = useClientStore($draft, serverDraft);
  const editing = useClientStore($isEditing, false);
  const inCalc = useStore($calcInView);
  const notice = useStore($notice);
  const count = order.items.length;
  const wa = waLink('Здравствуйте! Пишу с сайта по поводу натяжного потолка.');

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 flex justify-center px-4 lg:bottom-8"
        role="status"
        aria-live="polite"
      >
        {notice && (
          <p key={notice.id} className="animate-rise rounded-full bg-ink px-4 py-2.5 text-[0.9375rem] font-medium text-white shadow-[var(--shadow-float)]">
            {notice.text}
          </p>
        )}
      </div>

      <nav
        aria-label="Быстрые действия"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-plane/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      >
        {inCalc ? (
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1 pl-1">
              <p className="truncate text-[0.8125rem] text-ink-soft">{draft.name || 'Комната'}, примерно</p>
              <p className="font-display text-[1.125rem] font-semibold tabular-nums">{formatRub(calcRoom(draft).total)}</p>
            </div>
            <button type="button" className="btn-primary px-4" onClick={() => commitDraft()}>
              {editing ? 'Сохранить' : 'Добавить в заказ'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-[auto_auto_1fr] gap-2">
            <a href={`tel:+${site.phoneDigits}`} className="btn-ghost min-h-12 px-3.5" aria-label={`Позвонить: ${site.phone}`}>
              <IconPhone size={20} />
            </a>
            <a href={wa} target="_blank" rel="noopener" className="btn-wa min-h-12 px-3.5" aria-label="Написать в WhatsApp">
              <IconWhatsApp size={22} />
            </a>
            {count > 0 ? (
              <button type="button" className="btn-ink min-h-12" onClick={() => $cartOpen.set(true)}>
                <IconBag size={20} />
                <span className="hidden min-[360px]:inline">Заказ:</span>
                <span className="whitespace-nowrap tabular-nums">{formatRub(order.total)}</span>
              </button>
            ) : (
              <a href="/#calc" className="btn-primary min-h-12" onClick={(e) => {
                if (document.getElementById('calc')) {
                  e.preventDefault();
                  scrollToCalc();
                }
              }}>
                Рассчитать стоимость
              </a>
            )}
          </div>
        )}
      </nav>

      <a
        href={wa}
        target="_blank"
        rel="noopener"
        className="fixed right-6 bottom-6 z-40 hidden size-14 place-items-center rounded-full bg-wa text-white shadow-[var(--shadow-float)] transition-transform hover:scale-105 lg:grid"
        aria-label="Написать в WhatsApp"
      >
        <IconWhatsApp size={28} />
      </a>
    </>
  );
}
