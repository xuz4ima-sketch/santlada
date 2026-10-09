import { canvases } from '../config/canvases';
import { site } from '../config/site';

export interface Contact {
  name: string;
  city: string;
  when: string;
  /** Выбранное полотно или пусто — «посоветуйте» */
  canvas: string;
  comment: string;
}

export const emptyContact: Contact = { name: '', city: '', when: '', canvas: '', comment: '' };

/** Звёздочки и подчёркивания в WhatsApp включают форматирование — убираем их из текста клиента */
const clean = (s: string) => s.replace(/[*_~`]/g, '').replace(/\s+\n/g, '\n').trim();

/** Ссылка на работу: главная страница откроет её на весь экран */
export function workUrl(id: string, origin: string = site.url): string {
  return `${origin.replace(/\/$/, '')}/#${id}`;
}

/** Текст заказа: с выбранным полотном — заказ, без него — просто запись на замер */
export function buildMeasureMessage(contact: Contact): string {
  const canvas = clean(contact.canvas);
  const info = canvases.find((c) => c.name === canvas);
  const lines = [canvas ? `*Заказ натяжного потолка — ${site.brand}*` : `*Запись на бесплатный замер — ${site.brand}*`];
  if (clean(contact.name)) lines.push(`Имя: ${clean(contact.name)}`);
  if (clean(contact.city)) lines.push(`Адрес: ${clean(contact.city)}`);
  if (clean(contact.when)) lines.push(`Замер: ${clean(contact.when).toLowerCase()}`);
  lines.push(`Полотно: ${canvas ? (info ? `${canvas}, ${info.price} ₽/м²` : canvas) : 'посоветуйте'}`);

  const blocks = [lines];
  if (clean(contact.comment)) blocks.push([`Что нужно: ${clean(contact.comment)}`]);
  return blocks.map((b) => b.join('\n')).join('\n\n');
}

/** Текст «Хочу такой потолок» со ссылкой на работу */
export function buildLikeMessage(caption: string, id: string, origin: string = site.url): string {
  return `Здравствуйте! Хочу такой потолок, как на вашем сайте: «${clean(caption)}».\n${workUrl(id, origin)}`;
}

export function waLink(text?: string, phone: string = site.phoneDigits): string {
  return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
}
