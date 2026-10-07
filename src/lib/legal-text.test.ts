import { describe, expect, it } from 'vitest';
import { LEGAL_DOCUMENTS } from '../../prisma/legal-content';
import { nextVersion, parseLegalText, sectionsToText } from './legal-text';

describe('sectionsToText ↔ parseLegalText', () => {
  it.each(LEGAL_DOCUMENTS.map((doc) => [`${doc.slug}/${doc.locale}`, doc] as const))(
    '%s: документ из сида проходит туда и обратно без потерь',
    (_, doc) => {
      const parsed = parseLegalText(sectionsToText(doc.sections));
      expect(parsed).toEqual({ ok: true, sections: doc.sections });
    }
  );
});

describe('parseLegalText', () => {
  it('разделы, якоря, абзацы через пустую строку, пункты', () => {
    const text = [
      '## Кто мы {#who}',
      'Первая строка',
      'того же абзаца.',
      '',
      'Второй абзац с {{owner.fullName}}.',
      '- пункт один',
      '- пункт два',
      '',
      '## Без якоря',
      '- только список',
    ].join('\n');
    expect(parseLegalText(text)).toEqual({
      ok: true,
      sections: [
        {
          heading: 'Кто мы',
          anchor: 'who',
          paragraphs: ['Первая строка того же абзаца.', 'Второй абзац с {{owner.fullName}}.'],
          items: ['пункт один', 'пункт два'],
        },
        { heading: 'Без якоря', items: ['только список'] },
      ],
    });
  });

  it('переводы строк Windows и края строк не мешают', () => {
    expect(parseLegalText('  ## A  \r\n  текст  \r\n')).toEqual({
      ok: true,
      sections: [{ heading: 'A', paragraphs: ['текст'] }],
    });
  });

  it.each([
    ['', 'empty'],
    ['   \n  ', 'empty'],
    ['текст до заголовка\n## A\nx', 'beforeHeading'],
    ['## A\n- пункт\nабзац после списка', 'paragraphAfterList'],
    ['## A\n## B\nx', 'emptySection'],
    ['## A {#x}\nt\n## B {#x}\nt', 'duplicateAnchor'],
    ['## A\nадрес {{owner.unknownKey}}', 'placeholder'],
    ['## A\nтекст ' + String.fromCharCode(0x202e) + 'наоборот', 'chars'],
    ['## A\n' + 'x'.repeat(100_001), 'tooLong'],
    [Array.from({ length: 81 }, (_, i) => `## S${String(i)}\nt`).join('\n'), 'tooManySections'],
  ])('отказ: %j → %s', (text, code) => {
    const result = parseLegalText(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe(code);
  });

  it('ошибка указывает строку', () => {
    expect(parseLegalText('## A\nt\n\n\n## B\n- x\nабзац')).toEqual({
      ok: false,
      error: { code: 'paragraphAfterList', line: 7 },
    });
  });

  it('не строка — пусто', () => {
    expect(parseLegalText(null)).toEqual({ ok: false, error: { code: 'empty' } });
  });

  it('пометки для юриста — обычный текст', () => {
    expect(parseLegalText('## A\n⟦ЮРИСТ: проверить срок⟧').ok).toBe(true);
  });
});

describe('nextVersion', () => {
  const now = new Date('2026-10-07T23:30:00Z');
  it('документ и дата UTC', () => {
    expect(nextVersion('privacy', now, new Set())).toBe('privacy-2026-10-07');
  });
  it('вторая и третья за день — с суффиксом', () => {
    expect(nextVersion('privacy', now, new Set(['privacy-2026-10-07']))).toBe(
      'privacy-2026-10-07-2'
    );
    expect(
      nextVersion('privacy', now, new Set(['privacy-2026-10-07', 'privacy-2026-10-07-2']))
    ).toBe('privacy-2026-10-07-3');
  });
});
