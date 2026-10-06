import { describe, expect, it } from 'vitest';
import { contactLinks, normalizePhone, normalizeTelegram } from './contacts';

/**
 * Контакты — главное, ради чего существует сайт (docs/13, п.1). Значения
 * вводит человек в админке, а попадают они в href на каждой странице
 * контактов, поэтому проверяется и формат, и то, что из значения нельзя
 * собрать ссылку на чужой адрес или `javascript:`.
 */

describe('Telegram', () => {
  it.each([
    ['demo_name', 'demo_name'],
    ['@demo_name', 'demo_name'],
    ['t.me/demo_name', 'demo_name'],
    ['https://t.me/demo_name/', 'demo_name'],
    ['  https://telegram.me/DemoName ', 'DemoName'],
  ])('%j → %j', (raw, expected) => {
    expect(normalizeTelegram(raw)).toBe(expected);
  });

  it.each([
    'abcd',
    'a'.repeat(33),
    '1demo',
    'demo_',
    'de__mo',
    'demo name',
    'https://evil.example/demo',
    'javascript:alert(1)',
    't.me/demo?start=x',
    '',
  ])('%j — не имя пользователя', (raw) => {
    expect(normalizeTelegram(raw)).toBeNull();
  });
});

describe('номер телефона', () => {
  it.each([
    ['+48600000000', '+48600000000'],
    ['+48 600 000 000', '+48600000000'],
    ['+48 (600) 000-000', '+48600000000'],
    ['0048600000000', '+48600000000'],
  ])('%j → %j', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each(['600000000', '+0600000000', '+48', '+48 600 000 000 0000 00', '+48600000000;x', ''])(
    '%j — не номер в международном формате',
    (raw) => {
      expect(normalizePhone(raw)).toBeNull();
    }
  );
});

describe('ссылки на странице контактов', () => {
  const all = {
    'contact.telegram': 'demo_name',
    'contact.whatsapp': '+48600000000',
    'contact.viber': '+48600000001',
    'owner.email': 'kontakt@example.pl',
    'owner.phone': '+48600000002',
  };

  it('каждый способ связи — своя ссылка, в постоянном порядке', () => {
    expect(contactLinks(all)).toEqual([
      { kind: 'telegram', href: 'https://t.me/demo_name', shown: '@demo_name' },
      { kind: 'whatsapp', href: 'https://wa.me/48600000000', shown: '+48600000000' },
      { kind: 'viber', href: 'viber://chat?number=%2B48600000001', shown: '+48600000001' },
      { kind: 'email', href: 'mailto:kontakt@example.pl', shown: 'kontakt@example.pl' },
      { kind: 'phone', href: 'tel:+48600000002', shown: '+48600000002' },
    ]);
  });

  it('пустые способы связи пропускаются', () => {
    expect(contactLinks({ 'owner.email': 'kontakt@example.pl', 'contact.viber': '  ' })).toEqual([
      { kind: 'email', href: 'mailto:kontakt@example.pl', shown: 'kontakt@example.pl' },
    ]);
    expect(contactLinks({})).toEqual([]);
  });

  it('испорченная запись в базе не превращается в ссылку', () => {
    expect(
      contactLinks({
        'contact.telegram': 'javascript:alert(1)',
        'contact.whatsapp': 'https://evil.example',
        'owner.email': 'a@b.pl?subject=x',
        'owner.phone': '600 000 000',
      })
    ).toEqual([]);
  });

  it('ссылки ведут только на свои схемы и домены', () => {
    for (const link of contactLinks(all)) {
      expect(link.href).toMatch(/^(https:\/\/(t\.me|wa\.me)\/|viber:\/\/chat\?|mailto:|tel:\+)/);
    }
  });
});
