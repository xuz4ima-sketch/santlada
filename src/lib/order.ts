/** Связка «каталог → заказ»: каталог сообщает окну заказа, какое полотно выбрано */
export const ORDER_EVENT = 'santlada:order';

export function openOrder(canvas?: string) {
  window.dispatchEvent(new CustomEvent<{ canvas?: string }>(ORDER_EVENT, { detail: { canvas } }));
}
