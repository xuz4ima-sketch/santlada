import { describe, expect, it } from 'vitest';
import { prices } from '../config/prices';
import { calcOrder, calcRoom, estimatePerimeter, extraCorners, fromPricePerM2, newRoom, perimeterOf } from './pricing';

describe('периметр', () => {
  it('оценивается по площади как у квадратной комнаты', () => {
    expect(estimatePerimeter(16)).toBe(16);
    expect(estimatePerimeter(20)).toBe(17.9);
    expect(estimatePerimeter(0)).toBe(0);
  });

  it('берётся из ввода, если клиент его указал', () => {
    expect(perimeterOf({ area: 16, perimeter: 18.5 })).toBe(18.5);
    expect(perimeterOf({ area: 16, perimeter: null })).toBe(16);
  });
});

describe('углы', () => {
  it('платные только после четырёх', () => {
    expect(extraCorners(3)).toBe(0);
    expect(extraCorners(4)).toBe(0);
    expect(extraCorners(5)).toBe(1);
    expect(extraCorners(8)).toBe(4);
  });

  it('попадают в смету по цене вида потолка', () => {
    const room = newRoom({ type: 'paryashchiy', corners: 6, chandeliers: 0 });
    const line = calcRoom(room).lines.find((l) => l.label === 'Углы после четырёх');
    expect(line?.qty).toBe(2);
    expect(line?.sum).toBe(2 * prices.extraCorner.paryashchiy);
  });

  it('при четырёх углах строки нет', () => {
    const { lines } = calcRoom(newRoom({ corners: 4 }));
    expect(lines.some((l) => l.label === 'Углы после четырёх')).toBe(false);
  });
});

describe('смета комнаты', () => {
  it('классика: полотно и люстра', () => {
    const { lines, total } = calcRoom(newRoom({ area: 18, canvas: 'gloss', chandeliers: 1 }));
    expect(lines.map((l) => l.label)).toEqual(['Полотно глянцевое с монтажом', 'Установка люстры']);
    expect(total).toBe(18 * prices.canvas.gloss + prices.chandelier);
  });

  it('парящий: профиль считается по периметру', () => {
    const room = newRoom({ type: 'paryashchiy', area: 16, chandeliers: 0 });
    const { total } = calcRoom(room);
    expect(total).toBe(16 * prices.canvas.mat + 16 * prices.profile.paryashchiy);
  });

  it('цветное полотно дороже белого', () => {
    const white = calcRoom(newRoom({ chandeliers: 0 })).total;
    const colored = calcRoom(newRoom({ colored: true, chandeliers: 0 })).total;
    expect(colored - white).toBe(16 * prices.colorExtra);
  });

  it('все опции складываются', () => {
    const room = newRoom({
      type: 'linii',
      area: 20,
      perimeter: 18,
      corners: 5,
      pipes: 1,
      spots: 4,
      chandeliers: 0,
      linesM: 6,
      ledM: 3,
      corniceM: 3,
    });
    const expected =
      20 * prices.canvas.mat +
      18 * prices.profile.linii +
      1 * prices.extraCorner.linii +
      prices.pipe +
      4 * prices.spot +
      6 * prices.lightLine +
      3 * prices.ledStrip +
      3 * prices.cornice;
    expect(calcRoom(room).total).toBe(expected);
  });
});

describe('заказ', () => {
  it('суммирует комнаты', () => {
    const a = newRoom({ area: 18 });
    const b = newRoom({ area: 12, type: 'tenevoy' });
    const order = calcOrder([a, b]);
    expect(order.total).toBe(calcRoom(a).total + calcRoom(b).total);
    expect(order.minApplied).toBe(false);
  });

  it('учитывает минимальный заказ', () => {
    const order = calcOrder([newRoom({ area: 3, chandeliers: 0 })]);
    expect(order.subtotal).toBeLessThan(prices.minOrder);
    expect(order.minApplied).toBe(true);
    expect(order.total).toBe(prices.minOrder);
  });

  it('пустой заказ стоит ноль', () => {
    expect(calcOrder([]).total).toBe(0);
  });
});

describe('цена «от» для карточек', () => {
  it('классика равна цене матового полотна', () => {
    expect(fromPricePerM2('klassika')).toBe(prices.canvas.mat);
  });

  it('парящий дороже классики на профиль', () => {
    expect(fromPricePerM2('paryashchiy')).toBe(prices.canvas.mat + prices.profile.paryashchiy);
  });
});
