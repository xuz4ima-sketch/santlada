import { site } from '../config/site';
import { waLink } from '../lib/whatsapp';
import { IconPhone, IconWhatsApp } from './icons';

/** Нижняя панель на телефоне и круглая кнопка WhatsApp на компьютере */
export default function MobileBar() {
  const wa = waLink('Здравствуйте! Пишу с сайта по поводу натяжного потолка.');

  return (
    <>
      <nav
        aria-label="Быстрые действия"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-plane/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      >
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <a href={`tel:+${site.phoneDigits}`} className="btn-ghost min-h-12 px-3.5" aria-label={`Позвонить: ${site.phone}`}>
            <IconPhone size={20} />
          </a>
          <a href={`${import.meta.env.BASE_URL}#ceny`} className="btn-primary btn-shine min-h-12">
            Заказать полотно
          </a>
        </div>
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
