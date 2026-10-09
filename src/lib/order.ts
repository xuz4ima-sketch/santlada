/** Связка «каталог → заказ»: каталог сообщает окну заказа, какое полотно выбрано */
export const ORDER_EVENT = 'santlada:order';

export function openOrder(canvas?: string) {
  window.dispatchEvent(new CustomEvent<{ canvas?: string }>(ORDER_EVENT, { detail: { canvas } }));
}

/**
 * Какое полотно сейчас на экране (или null, если блок с полотнами ушёл с экрана).
 * Нужно нижней панели телефона: пока человек смотрит полотно, её кнопка заказывает именно его.
 */
export const CANVAS_EVENT = 'santlada:canvas';

export function showCanvas(canvas: string | null) {
  window.dispatchEvent(new CustomEvent<{ canvas: string | null }>(CANVAS_EVENT, { detail: { canvas } }));
}
