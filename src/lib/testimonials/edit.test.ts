import { describe, expect, it } from 'vitest';
import { parseConsentDate, parseTestimonialForm } from './edit';

const NOW = new Date('2026-10-07T12:00:00Z');

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const VALID = {
  alias: 'Клиентка, 34 года',
  body: 'Стало легче.\n\nСпасибо.',
  locale: 'ru',
  consentAt: '2026-10-01',
};

describe('parseConsentDate', () => {
  it('день в UTC', () => {
    expect(parseConsentDate('2026-10-01', NOW)?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
  it('пусто — нет согласия, а не ошибка', () => {
    expect(parseConsentDate('', NOW)).toBeNull();
    expect(parseConsentDate(null, NOW)).toBeNull();
  });
  it.each(['2026-10-08', '2019-12-31', '2026-02-30', '01.10.2026', '2026-10-01T00:00'])(
    'отказ: %s',
    (value) => {
      expect(parseConsentDate(value, NOW)).toBeUndefined();
    }
  );
  it('сегодня — можно', () => {
    expect(parseConsentDate('2026-10-07', NOW)).not.toBeUndefined();
  });
});

describe('parseTestimonialForm', () => {
  it('полная форма', () => {
    expect(parseTestimonialForm(form(VALID), NOW)).toEqual({
      ok: true,
      value: {
        authorAlias: 'Клиентка, 34 года',
        body: 'Стало легче.\n\nСпасибо.',
        locale: 'ru',
        consentAt: new Date('2026-10-01T00:00:00Z'),
      },
    });
  });

  it('без даты согласия сохранить можно — показать нельзя (это решает действие)', () => {
    const result = parseTestimonialForm(form({ ...VALID, consentAt: '' }), NOW);
    expect(result).toMatchObject({ ok: true, value: { consentAt: null } });
  });

  it.each([
    [{ alias: '' }, 'alias'],
    [{ alias: 'две\nстроки' }, 'alias'],
    [{ alias: 'x'.repeat(81) }, 'alias'],
    [{ body: '   ' }, 'body'],
    [{ body: 'x'.repeat(2001) }, 'body'],
    [{ locale: 'de' }, 'locale'],
    [{ consentAt: '2030-01-01' }, 'consent'],
  ])('отказ %j → %s', (patch, field) => {
    expect(parseTestimonialForm(form({ ...VALID, ...patch }), NOW)).toEqual({ ok: false, field });
  });
});
