import { prices as defaultPrices, canvasNames, type Canvas } from '../config/prices';
import { ceilingTypes, type CeilingType } from '../config/site';

export type Prices = typeof defaultPrices;

export interface Room {
  id: string;
  name: string;
  type: CeilingType;
  canvas: Canvas;
  colored: boolean;
  /** Площадь, м² */
  area: number;
  /** Периметр, м. null — считаем приблизительно по площади */
  perimeter: number | null;
  corners: number;
  pipes: number;
  spots: number;
  chandeliers: number;
  /** Световые линии, м */
  linesM: number;
  /** Светодиодная подсветка в нише или карнизе, м */
  ledM: number;
  /** Скрытый карниз, м */
  corniceM: number;
  /** Примеры работ, которые понравились клиенту (id работ) */
  refs: string[];
  comment: string;
}

export interface PriceLine {
  label: string;
  qty: number;
  unit: 'м²' | 'м' | 'шт';
  price: number;
  sum: number;
}

export const AREA_MIN = 1;
export const AREA_MAX = 300;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Периметр квадратной комнаты той же площади — нижняя оценка */
export function estimatePerimeter(area: number): number {
  if (!(area > 0)) return 0;
  return round1(4 * Math.sqrt(area));
}

export function perimeterOf(room: Pick<Room, 'area' | 'perimeter'>): number {
  return room.perimeter && room.perimeter > 0 ? room.perimeter : estimatePerimeter(room.area);
}

export function extraCorners(corners: number): number {
  return Math.max(0, Math.round(corners) - 4);
}

export function newRoom(partial: Partial<Room> = {}): Room {
  return {
    id: partial.id ?? makeId(),
    name: 'Гостиная',
    type: 'klassika',
    canvas: 'mat',
    colored: false,
    area: 16,
    perimeter: null,
    corners: 4,
    pipes: 0,
    spots: 0,
    chandeliers: 1,
    linesM: 0,
    ledM: 0,
    corniceM: 0,
    refs: [],
    comment: '',
    ...partial,
  };
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Строки сметы по одной комнате и итог */
export function calcRoom(room: Room, p: Prices = defaultPrices): { lines: PriceLine[]; total: number } {
  const lines: PriceLine[] = [];
  const add = (label: string, qty: number, unit: PriceLine['unit'], price: number) => {
    if (qty > 0 && price > 0) lines.push({ label, qty, unit, price, sum: Math.round(qty * price) });
  };

  const area = Math.min(AREA_MAX, Math.max(0, room.area || 0));
  const perimeter = perimeterOf({ area, perimeter: room.perimeter });
  const canvasPrice = p.canvas[room.canvas] + (room.colored ? p.colorExtra : 0);

  add(`Полотно ${canvasNames[room.canvas].toLowerCase()}${room.colored ? ', цветное' : ''} с монтажом`, area, 'м²', canvasPrice);
  if (room.type === 'paryashchiy') add('Парящий профиль с подсветкой', perimeter, 'м', p.profile.paryashchiy);
  if (room.type === 'tenevoy') add('Теневой профиль', perimeter, 'м', p.profile.tenevoy);
  if (room.type === 'klassika' || room.type === 'linii') add('Профиль по периметру', perimeter, 'м', p.profile[room.type]);
  add('Углы после четырёх', extraCorners(room.corners), 'шт', p.extraCorner[room.type]);
  add('Обход трубы', room.pipes, 'шт', p.pipe);
  add('Точечные светильники', room.spots, 'шт', p.spot);
  add('Установка люстры', room.chandeliers, 'шт', p.chandelier);
  add('Световые линии', room.linesM, 'м', p.lightLine);
  add('Светодиодная подсветка', room.ledM, 'м', p.ledStrip);
  add('Скрытый карниз', room.corniceM, 'м', p.cornice);

  return { lines, total: lines.reduce((s, l) => s + l.sum, 0) };
}

export function calcOrder(rooms: Room[], p: Prices = defaultPrices) {
  const items = rooms.map((room) => ({ room, ...calcRoom(room, p) }));
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const minApplied = rooms.length > 0 && subtotal < p.minOrder;
  return { items, subtotal, minApplied, total: minApplied ? p.minOrder : subtotal };
}

/** «От … ₽/м²» для карточек: комната 16 м², 4 угла, матовое белое полотно, без светильников */
export function fromPricePerM2(type: CeilingType, p: Prices = defaultPrices): number {
  const room = newRoom({ id: 'ref', type, area: 16, chandeliers: 0, linesM: type === 'linii' ? 4 : 0 });
  return roundTo(calcRoom(room, p).total / 16, 10);
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

const rub = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
export const formatRub = (n: number) => `${rub.format(Math.round(n))} ₽`;
export const formatNum = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);

/** Короткое описание комнаты для корзины */
export function roomSummary(room: Room): string {
  const parts = [ceilingTypes[room.type].name, `${canvasNames[room.canvas].toLowerCase()} полотно`, `${formatNum(room.area)} м²`];
  if (extraCorners(room.corners) > 0) parts.push(`углов ${room.corners}`);
  if (room.spots) parts.push(`светильников ${room.spots}`);
  if (room.linesM) parts.push(`линии ${formatNum(room.linesM)} м`);
  return parts.join(', ');
}
