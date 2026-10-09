import { describe, expect, it } from 'vitest';
import { newRoom } from './pricing';
import { buildMeasureMessage, buildOrderMessage, emptyContact, waLink, workUrl } from './whatsapp';

const contact = { ...emptyContact, name: 'Магомед', city: 'Хасавюрт', address: 'ул. Абубакарова, 5', when: 'В выходные' };

describe('заявка в WhatsApp', () => {
  it('содержит контакты, комнаты и итог', () => {
    const text = buildOrderMessage(
      [
        newRoom({ name: 'Гостиная', type: 'paryashchiy', area: 18, corners: 6, spots: 6, refs: ['w-226'] }),
        newRoom({ name: 'Спальня', type: 'tenevoy', area: 12 }),
      ],
      contact,
      'https://santlada.ru',
    );
    expect(text).toContain('*Заявка с сайта SANTLADA*');
    expect(text).toContain('Имя: Магомед');
    expect(text).toContain('Адрес: Хасавюрт, ул. Абубакарова, 5');
    expect(text).toContain('Замер: в выходные');
    expect(text).toContain('*1. Гостиная*, парящий потолок');
    expect(text).toContain('Углов: 6 (2 сверх четырёх)');
    expect(text).toContain('https://santlada.ru/raboty/#w-226');
    expect(text).toContain('*2. Спальня*, теневой потолок');
    expect(text).toMatch(/\*Итого ≈ [\d\s  ]+₽\*/);
  });

  it('не пишет пустые поля', () => {
    const text = buildOrderMessage([newRoom({ chandeliers: 0 })], { ...emptyContact, city: 'Кизляр' });
    expect(text).not.toContain('Имя:');
    expect(text).not.toContain('Телефон:');
    expect(text).not.toContain('Свет:');
    expect(text).not.toContain('Углов:');
  });

  it('показывает приблизительный периметр со знаком ≈', () => {
    expect(buildOrderMessage([newRoom({ area: 16 })], emptyContact)).toContain('периметр ≈ 16 м');
    expect(buildOrderMessage([newRoom({ area: 16, perimeter: 17 })], emptyContact)).toContain('периметр 17 м');
  });

  it('сообщает о минимальном заказе', () => {
    const text = buildOrderMessage([newRoom({ area: 2, chandeliers: 0 })], emptyContact);
    expect(text).toContain('минимальный заказ');
  });

  it('убирает символы форматирования из текста клиента', () => {
    const text = buildOrderMessage([newRoom({ comment: '*срочно*' })], { ...emptyContact, name: '_Али_' });
    expect(text).toContain('Имя: Али');
    expect(text).toContain('Комментарий: срочно');
  });

  it('запись на замер без расчёта', () => {
    const text = buildMeasureMessage({ ...contact, comment: 'Три комнаты' });
    expect(text).toContain('Запись на бесплатный замер');
    expect(text).toContain('Комментарий: Три комнаты');
    expect(text).not.toContain('Итого');
  });
});

describe('ссылки', () => {
  it('кодирует текст для wa.me', () => {
    const link = waLink('Привет & пока\nновая строка');
    expect(link.startsWith('https://wa.me/79285983432?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1])).toBe('Привет & пока\nновая строка');
  });

  it('ссылка на пример работы', () => {
    expect(workUrl('v-898', 'https://santlada.ru/')).toBe('https://santlada.ru/raboty/#v-898');
  });
});
