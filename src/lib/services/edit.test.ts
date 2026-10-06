import { describe, expect, it } from 'vitest';
import {
  formatPrice,
  normalizeRegion,
  parseAmount,
  parseNewServiceForm,
  parsePriceForm,
  parseServiceForm,
  pickPrice,
  planPriceChange,
  type StoredPrice,
} from './edit';

/**
 * Цена на сайте психолога — сведения для потребителя: итоговая сумма
 * с валютой (docs/03 п.11.1, правило 6). Ошибка здесь — не опечатка
 * в тексте, а неверное обещание. Поэтому деньги проверяются строже всего.
 */

const ID = '3f2b8c1e-6a4d-4e5f-9b7a-1c2d3e4f5a6b';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

describe('сумма из формы', () => {
  it.each([
    ['250', 25000],
    ['250,5', 25050],
    ['250.50', 25050],
    ['1 250,00', 125000],
    ['1 250', 125000],
    [' 0,01 ', 1],
  ])('%j → %d минорных единиц', (raw, minor) => {
    expect(parseAmount(raw)).toBe(minor);
  });

  it.each([
    '',
    '0',
    '0,00',
    '-10',
    '10,555',
    '1e3',
    '12,3,4',
    'abc',
    '1000001',
    '0x10',
    '250,',
    ',5',
  ])('%j — отказ', (raw) => {
    expect(parseAmount(raw)).toBeNull();
  });

  it('без арифметики с плавающей точкой: 0,10 + 0,20 не даёт 0,30000000000000004', () => {
    expect((parseAmount('0,1') ?? 0) + (parseAmount('0,2') ?? 0)).toBe(30);
  });
});

describe('цена на сайте', () => {
  it('копейки не округляются: итоговая цена — ровно та, что назначена', () => {
    expect(formatPrice(6050, 'EUR', 'en')).toBe('€60.50');
    expect(formatPrice(6000, 'EUR', 'en')).toBe('€60');
    expect(formatPrice(25050, 'PLN', 'pl').replace(/\s/g, ' ')).toBe('250,50 zł');
  });
});

describe('регион', () => {
  it.each([
    ['PL', 'PL'],
    [' pl ', 'PL'],
    ['default', 'DEFAULT'],
  ])('%j → %j', (raw, region) => {
    expect(normalizeRegion(raw)).toBe(region);
  });

  it.each(['POL', 'P', '', 'P1', 'ПЛ', null])('%j — не регион', (raw) => {
    expect(normalizeRegion(raw)).toBeNull();
  });
});

describe('формы услуги', () => {
  it('новая услуга: служебное имя латиницей и русское название', () => {
    expect(parseNewServiceForm(form({ slug: 'family-60', title: 'Семейная' }))).toEqual({
      ok: true,
      value: { slug: 'family-60', title: 'Семейная' },
    });
    expect(parseNewServiceForm(form({ slug: 'Семья', title: 'x' }))).toEqual({
      ok: false,
      field: 'slug',
    });
    expect(parseNewServiceForm(form({ slug: 'family', title: '  ' }))).toEqual({
      ok: false,
      field: 'title',
    });
  });

  const base = {
    serviceId: ID,
    title_ru: 'Консультация',
    title_pl: 'Konsultacja',
    title_en: '',
    description_ru: 'Абзац\n\nвторой',
    description_pl: '',
    description_en: '',
    durationMinutes: '50',
    isActive: 'on',
  };

  it('настройки: пустые переводы не хранятся, флажок читается', () => {
    expect(parseServiceForm(form(base))).toEqual({
      ok: true,
      value: {
        serviceId: ID,
        titleI18n: { ru: 'Консультация', pl: 'Konsultacja' },
        descriptionI18n: { ru: 'Абзац\n\nвторой' },
        durationMinutes: 50,
        isActive: true,
      },
    });
    const { isActive: _, ...hidden } = base;
    expect(parseServiceForm(form(hidden))).toMatchObject({ ok: true, value: { isActive: false } });
  });

  it.each([
    [{ title_ru: '' }, 'title_ru'],
    [{ title_pl: 'две\nстроки' }, 'title_pl'],
    [{ durationMinutes: '5' }, 'durationMinutes'],
    [{ durationMinutes: '50.5' }, 'durationMinutes'],
    [{ durationMinutes: 'час' }, 'durationMinutes'],
    [{ serviceId: 'not-a-uuid' }, 'serviceId'],
  ])('%j — отказ в поле %s', (patch, field) => {
    expect(parseServiceForm(form({ ...base, ...patch }))).toEqual({ ok: false, field });
  });

  it('цена: регион, валюта из списка, сумма', () => {
    expect(
      parsePriceForm(form({ serviceId: ID, region: 'pl', currency: 'PLN', amount: '250,50' }))
    ).toEqual({
      ok: true,
      value: { serviceId: ID, region: 'PL', currency: 'PLN', amountMinor: 25050 },
    });
    expect(
      parsePriceForm(form({ serviceId: ID, region: 'PL', currency: 'BTC', amount: '1' }))
    ).toEqual({ ok: false, field: 'currency' });
  });
});

describe('история цен', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 9, n));
  const price = (patch: Partial<StoredPrice>): StoredPrice => ({
    id: 'p1',
    region: 'PL',
    currency: 'PLN',
    amountMinor: 25000,
    validFrom: day(1),
    validTo: null,
    ...patch,
  });

  it('новая сумма закрывает прежнюю цену, а не правит её', () => {
    expect(
      planPriceChange([price({})], { region: 'PL', currency: 'PLN', amountMinor: 26000 }, day(5))
    ).toEqual({ close: ['p1'], create: true });
  });

  it('та же сумма в той же валюте — ничего не меняется', () => {
    expect(
      planPriceChange([price({})], { region: 'PL', currency: 'PLN', amountMinor: 25000 }, day(5))
    ).toEqual({ close: [], create: false });
  });

  it('закрытая в прошлом цена и цены других регионов не трогаются', () => {
    const prices = [
      price({ id: 'old', validTo: day(2) }),
      price({ id: 'de', region: 'DE', currency: 'EUR' }),
    ];
    expect(
      planPriceChange(prices, { region: 'PL', currency: 'PLN', amountMinor: 25000 }, day(5))
    ).toEqual({ close: [], create: true });
  });

  it('посетитель видит цену своей страны, иначе общую; закрытая не показывается', () => {
    const prices = [
      price({ id: 'pl-old', amountMinor: 20000, validTo: day(3) }),
      price({ id: 'pl', validFrom: day(3) }),
      price({ id: 'default', region: 'DEFAULT', currency: 'EUR', amountMinor: 6000 }),
    ];
    expect(pickPrice(prices, 'PL', day(5))?.id).toBe('pl');
    expect(pickPrice(prices, 'PL', day(2))?.id).toBe('pl-old');
    expect(pickPrice(prices, 'DE', day(5))?.id).toBe('default');
    expect(pickPrice([price({ validTo: day(2) })], 'PL', day(5))).toBeNull();
  });

  it('цена с будущей датой начала ещё не показывается', () => {
    expect(pickPrice([price({ validFrom: day(10) })], 'PL', day(5))).toBeNull();
  });
});
