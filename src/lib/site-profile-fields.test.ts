import { describe, expect, it } from 'vitest';
import {
  PROFILE_FIELDS,
  fillPlaceholders,
  isValidNip,
  missingRequired,
  parseSiteStatus,
  validateField,
} from './site-profile-fields';

/**
 * Тесты профиля владельца и меток в текстах (docs/03 п.11.3).
 *
 * Главное: незаполненное место никогда не исчезает молча — ни пустое
 * значение, ни опечатка в имени метки. Сайт-образец обязан показывать,
 * где ещё пусто.
 */

describe('метки в тексте', () => {
  it('заполненная метка заменяется значением, соседний текст склеивается', () => {
    expect(fillPlaceholders('NIP {{owner.nip}}.', { 'owner.nip': '5260250274' })).toEqual([
      { kind: 'text', text: 'NIP 5260250274.' },
    ]);
  });

  it('пустая метка видна как «не заполнено»', () => {
    expect(fillPlaceholders('Adres: {{owner.address}}', {})).toEqual([
      { kind: 'text', text: 'Adres: ' },
      { kind: 'missing', key: 'owner.address' },
    ]);
  });

  it('метка с опечаткой не пропадает, а видна как незаполненная', () => {
    expect(fillPlaceholders('{{owner.nipp}}', { 'owner.nipp': 'подделка' })).toEqual([
      { kind: 'missing', key: 'owner.nipp' },
    ]);
  });

  it('пометка для юриста выделяется отдельной частью', () => {
    expect(fillPlaceholders('Termin ⟦ЮРИСТ: проверить срок⟧ dni', {})).toEqual([
      { kind: 'text', text: 'Termin ' },
      { kind: 'lawyer', text: '⟦ЮРИСТ: проверить срок⟧' },
      { kind: 'text', text: ' dni' },
    ]);
  });

  it('пробелы внутри фигурных скобок допустимы', () => {
    expect(fillPlaceholders('{{ owner.email }}', { 'owner.email': 'a@b.pl' })).toEqual([
      { kind: 'text', text: 'a@b.pl' },
    ]);
  });

  it('текст без меток возвращается одной частью', () => {
    expect(fillPlaceholders('Zwykły tekst', {})).toEqual([{ kind: 'text', text: 'Zwykły tekst' }]);
  });
});

describe('поля профиля', () => {
  it('NIP с верной контрольной цифрой проходит, с неверной — нет', () => {
    expect(isValidNip('5260250274')).toBe(true);
    expect(isValidNip('5260250275')).toBe(false);
    expect(isValidNip('526-025-02-74')).toBe(false);
    expect(isValidNip('123')).toBe(false);
  });

  it('пустое значение — «не заполнено», а не ошибка', () => {
    expect(validateField('owner.nip', '   ')).toEqual({ ok: true, value: '' });
  });

  it.each([
    ['owner.email', 'не почта'],
    ['owner.nip', '1234567890'],
    ['owner.regon', '12345'],
    ['owner.fullName', 'Имя\nвторая строка'],
    ['owner.unknown', 'что угодно'],
  ])('%s = %j отклоняется', (key, value) => {
    expect(validateField(key, value)).toEqual({ ok: false });
  });

  it('значение обрезается по краям', () => {
    expect(validateField('owner.email', '  kontakt@example.pl ')).toEqual({
      ok: true,
      value: 'kontakt@example.pl',
    });
  });

  it('пока обязательные поля пусты, они перечислены', () => {
    const required = PROFILE_FIELDS.filter((field) => field.required).map((field) => field.key);
    expect(missingRequired({}).map((field) => field.key)).toEqual(required);

    const all = Object.fromEntries(required.map((key) => [key, 'x']));
    expect(missingRequired(all)).toEqual([]);
  });
});

describe('режим сайта', () => {
  it('всё, кроме явного live, — разработка', () => {
    expect(parseSiteStatus('live')).toBe('live');
    expect(parseSiteStatus(undefined)).toBe('development');
    expect(parseSiteStatus('LIVE')).toBe('development');
    expect(parseSiteStatus('')).toBe('development');
  });
});
