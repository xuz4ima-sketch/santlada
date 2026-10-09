import { $cartOpen, $order } from '../../stores/order';
import { formatRub } from '../../lib/pricing';
import { useClientStore } from '../../lib/useMounted';
import { IconBag } from '../icons';
import { plural } from '../../lib/plural';

const emptyOrder = { items: [], subtotal: 0, minApplied: false, total: 0 } as ReturnType<typeof $order.get>;

export default function CartButton() {
  const order = useClientStore($order, emptyOrder);
  const count = order.items.length;

  return (
    <button
      type="button"
      onClick={() => $cartOpen.set(true)}
      className="hdr-btn relative inline-flex min-h-11 items-center gap-2 rounded-lg px-3 ring-1 ring-line ring-inset transition-colors hover:bg-haze"
      aria-label={count ? `Заказ: ${count} ${plural(count)}, ${formatRub(order.total)}` : 'Заказ пуст'}
    >
      <IconBag size={20} />
      <span className="hidden text-[0.9375rem] font-semibold sm:inline">{count ? formatRub(order.total) : 'Заказ'}</span>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-brand text-[0.75rem] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}
