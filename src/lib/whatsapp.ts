import { site, ceilingTypes } from '../config/site';
import { canvasNames } from '../config/prices';
import { calcOrder, extraCorners, formatNum, formatRub, perimeterOf, type Room } from './pricing';

export interface Contact {
  name: string;
  phone: string;
  city: string;
  address: string;
  when: string;
  comment: string;
}

export const emptyContact: Contact = { name: '', phone: '', city: '', address: '', when: '', comment: '' };

/** Звёздочки и подчёркивания в WhatsApp включают форматирование — убираем их из текста клиента */
const clean = (s: string) => s.replace(/[*_~`]/g, '').replace(/\s+\n/g, '\n').trim();

export function workUrl(id: string, origin: string = site.url): string {
  return `${origin.replace(/\/$/, '')}/raboty/#${id}`;
}

function contactLines(c: Contact): string[] {
  const lines: string[] = [];
  if (clean(c.name)) lines.push(`Имя: ${clean(c.name)}`);
  if (clean(c.phone)) lines.push(`Телефон: ${clean(c.phone)}`);
  const place = [clean(c.city), clean(c.address)].filter(Boolean).join(', ');
  if (place) lines.push(`Адрес: ${place}`);
  if (clean(c.when)) lines.push(`Замер: ${clean(c.when).toLowerCase()}`);
  return lines;
}

function roomLines(room: Room, index: number, total: number, origin: string): string[] {
  const type = ceilingTypes[room.type].name.toLowerCase();
  const lines = [`*${index}. ${clean(room.name) || 'Комната'}*, ${type} потолок`];
  lines.push(`Полотно: ${canvasNames[room.canvas].toLowerCase()}, ${room.colored ? 'цветное' : 'белое'}`);

  const perimeter = perimeterOf(room);
  const perimeterText = room.perimeter ? `${formatNum(perimeter)} м` : `≈ ${formatNum(perimeter)} м`;
  lines.push(`Площадь: ${formatNum(room.area)} м², периметр ${perimeterText}`);

  const extra = extraCorners(room.corners);
  if (extra > 0) lines.push(`Углов: ${room.corners} (${extra} сверх четырёх)`);
  if (room.pipes) lines.push(`Обход труб: ${room.pipes}`);

  const light: string[] = [];
  if (room.spots) light.push(`светильники ${room.spots} шт`);
  if (room.chandeliers) light.push(`люстры ${room.chandeliers} шт`);
  if (room.linesM) light.push(`световые линии ${formatNum(room.linesM)} м`);
  if (room.ledM) light.push(`подсветка ${formatNum(room.ledM)} м`);
  if (light.length) lines.push(`Свет: ${light.join(', ')}`);
  if (room.corniceM) lines.push(`Скрытый карниз: ${formatNum(room.corniceM)} м`);

  if (room.refs.length) {
    lines.push(`Понравились примеры:`);
    for (const id of room.refs) lines.push(workUrl(id, origin));
  }
  if (clean(room.comment)) lines.push(`Комментарий: ${clean(room.comment)}`);
  lines.push(`≈ ${formatRub(total)}`);
  return lines;
}

/** Текст заявки с расчётом по комнатам */
export function buildOrderMessage(rooms: Room[], contact: Contact, origin: string = site.url): string {
  const order = calcOrder(rooms);
  const blocks: string[][] = [];

  blocks.push([`*Заявка с сайта ${site.brand}*`, ...contactLines(contact)]);
  order.items.forEach((item, i) => blocks.push(roomLines(item.room, i + 1, item.total, origin)));

  const totals = [`*Итого ≈ ${formatRub(order.total)}*`, 'Цена предварительная, точная — после бесплатного замера.'];
  if (order.minApplied) totals.push(`Расчёт ${formatRub(order.subtotal)}, минимальный заказ — ${formatRub(order.total)}.`);
  blocks.push(totals);

  if (clean(contact.comment)) blocks.push([`Комментарий: ${clean(contact.comment)}`]);

  return blocks.map((b) => b.join('\n')).join('\n\n');
}

/** Текст заявки на замер без расчёта */
export function buildMeasureMessage(contact: Contact): string {
  const blocks = [[`*Запись на бесплатный замер — ${site.brand}*`, ...contactLines(contact)]];
  if (clean(contact.comment)) blocks.push([`Комментарий: ${clean(contact.comment)}`]);
  return blocks.map((b) => b.join('\n')).join('\n\n');
}

export function waLink(text?: string, phone: string = site.phoneDigits): string {
  return text ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : `https://wa.me/${phone}`;
}
