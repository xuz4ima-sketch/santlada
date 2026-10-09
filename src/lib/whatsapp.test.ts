import { describe, expect, it } from 'vitest';
import { buildLikeMessage, buildMeasureMessage, emptyContact, waLink, workUrl } from './whatsapp';

const contact = { ...emptyContact, name: 'Магомед', city: 'Хасавюрт', when: 'В выходные' };

describe('заказ и запись на замер', () => {
  it('содержит контакты, полотно и комментарий', () => {
    const text = buildMeasureMessage({ ...contact, canvas: 'BAUF', comment: 'Три комнаты' });
    expect(text).toContain('*Заказ натяжного потолка — SANTLADA*');
    expect(text).toContain('Имя: Магомед');
    expect(text).toContain('Адрес: Хасавюрт');
    expect(text).toContain('Замер: в выходные');
    expect(text).toContain('Полотно: BAUF, 650 ₽/м²');
    expect(text).toContain('Что нужно: Три комнаты');
  });

  it('без выбранного полотна — запись на замер, просит совет', () => {
    const text = buildMeasureMessage({ ...emptyContact, city: 'Кизляр' });
    expect(text).toContain('*Запись на бесплатный замер — SANTLADA*');
    expect(text).toContain('Полотно: посоветуйте');
  });

  it('не пишет пустые поля', () => {
    const text = buildMeasureMessage({ ...emptyContact, city: 'Кизляр' });
    expect(text).not.toContain('Имя:');
    expect(text).not.toContain('Замер:');
    expect(text).not.toContain('Что нужно:');
  });

  it('убирает символы форматирования из текста клиента', () => {
    const text = buildMeasureMessage({ ...emptyContact, name: '_Али_', comment: '*срочно*' });
    expect(text).toContain('Имя: Али');
    expect(text).toContain('Что нужно: срочно');
  });
});

describe('ссылки', () => {
  it('кодирует текст для wa.me', () => {
    const link = waLink('Привет & пока\nновая строка');
    expect(link.startsWith('https://wa.me/79285983432?text=')).toBe(true);
    expect(decodeURIComponent(link.split('text=')[1])).toBe('Привет & пока\nновая строка');
  });

  it('ссылка на работу ведёт на главную', () => {
    expect(workUrl('v-898', 'https://santlada.ru/')).toBe('https://santlada.ru/#v-898');
  });

  it('«Хочу такой потолок» с подписью и ссылкой', () => {
    const text = buildLikeMessage('Парящий потолок в ванной', 'w-530', 'https://santlada.ru');
    expect(text).toContain('«Парящий потолок в ванной»');
    expect(text).toContain('https://santlada.ru/#w-530');
  });
});
