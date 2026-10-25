import { describe, expect, it } from 'vitest';
import {
  currentPrices,
  formatPrice,
  isCurrencyCode,
  orderCurrencies,
  parseAmount,
  parseNewServiceForm,
  parsePriceForm,
  parseServiceForm,
  planPriceChange,
  priceHistory,
  visitorCurrency,
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

describe('валюта', () => {
  it.each(['PLN', 'EUR', 'USD', 'RUB', 'BYN', 'UAH', 'CHF', 'CZK', 'GBP'])(
    '%s — валюта с копейками',
    (code) => {
      expect(isCurrencyCode(code)).toBe(true);
    }
  );

  it.each([
    ['не код ISO', 'BTC'],
    ['строчными', 'pln'],
    ['без копеек: иена', 'JPY'],
    ['три знака после запятой: динар', 'KWD'],
    ['не строка', 42],
    ['пусто', ''],
    ['инъекция', 'PLN<script>'],
  ])('%s — отказ', (_name, value) => {
    expect(isCurrencyCode(value)).toBe(false);
  });

  it('злотые первыми, остальные по алфавиту, без повторов', () => {
    expect(orderCurrencies(['RUB', 'EUR', 'PLN', 'BYN', 'EUR'])).toEqual([
      'PLN',
      'BYN',
      'EUR',
      'RUB',
    ]);
  });

  it('валюта посетителя — только из валют с ценами, иначе злотые', () => {
    const available = ['PLN', 'EUR', 'BYN'];
    expect(visitorCurrency('EUR', available)).toBe('EUR');
    expect(visitorCurrency(' eur ', available)).toBe('EUR');
    expect(visitorCurrency('USD', available)).toBe('PLN');
    expect(visitorCurrency('<script>', available)).toBe('PLN');
    expect(visitorCurrency(null, available)).toBe('PLN');
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

  it('цена: валюта — любой код с копейками, сумма', () => {
    expect(parsePriceForm(form({ serviceId: ID, currency: ' byn ', amount: '250,50' }))).toEqual({
      ok: true,
      value: { serviceId: ID, currency: 'BYN', amountMinor: 25050 },
    });
    expect(parsePriceForm(form({ serviceId: ID, currency: 'BTC', amount: '1' }))).toEqual({
      ok: false,
      field: 'currency',
    });
    expect(parsePriceForm(form({ serviceId: ID, currency: 'PLN', amount: '0' }))).toEqual({
      ok: false,
      field: 'amount',
    });
  });
});

describe('история цен', () => {
  const day = (n: number) => new Date(Date.UTC(2026, 9, n));
  const price = (patch: Partial<StoredPrice>): StoredPrice => ({
    id: 'p1',
    currency: 'PLN',
    amountMinor: 25000,
    validFrom: day(1),
    validTo: null,
    ...patch,
  });

  it('новая сумма закрывает прежнюю цену в той же валюте, а не правит её', () => {
    expect(planPriceChange([price({})], { currency: 'PLN', amountMinor: 26000 }, day(5))).toEqual({
      close: ['p1'],
      create: true,
    });
  });

  it('та же сумма в той же валюте — ничего не меняется', () => {
    expect(planPriceChange([price({})], { currency: 'PLN', amountMinor: 25000 }, day(5))).toEqual({
      close: [],
      create: false,
    });
  });

  it('закрытая в прошлом цена и цены других валют не трогаются', () => {
    const prices = [
      price({ id: 'old', validTo: day(2) }),
      price({ id: 'eur', currency: 'EUR', amountMinor: 6000 }),
    ];
    expect(planPriceChange(prices, { currency: 'PLN', amountMinor: 25000 }, day(5))).toEqual({
      close: [],
      create: true,
    });
  });

  it('действующая цена в каждой валюте; закрытая и будущая не показываются', () => {
    const prices = [
      price({ id: 'pln-old', amountMinor: 20000, validTo: day(3) }),
      price({ id: 'pln', validFrom: day(3) }),
      price({ id: 'eur', currency: 'EUR', amountMinor: 6000 }),
      price({ id: 'byn-future', currency: 'BYN', validFrom: day(10) }),
    ];
    const now = currentPrices(prices, day(5));
    expect(now.get('PLN')?.id).toBe('pln');
    expect(now.get('EUR')?.id).toBe('eur');
    expect(now.has('BYN')).toBe(false);
    expect(currentPrices(prices, day(2)).get('PLN')?.id).toBe('pln-old');
  });

  it('архив: по валютам, злотые первыми, от новых цен к старым, будущих нет', () => {
    const prices = [
      price({ id: 'a', amountMinor: 20000, validTo: day(3) }),
      price({ id: 'b', validFrom: day(3) }),
      price({ id: 'c', currency: 'EUR', amountMinor: 6000 }),
      price({ id: 'd', currency: 'BYN', validFrom: day(10) }),
    ];
    const archive = priceHistory(prices, day(5));
    expect(archive.map((entry) => entry.currency)).toEqual(['PLN', 'EUR']);
    expect(archive[0]?.periods.map((period) => period.amountMinor)).toEqual([25000, 20000]);
  });
});
