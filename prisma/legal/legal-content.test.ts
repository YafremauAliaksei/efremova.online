import { describe, expect, it } from 'vitest';
import { PROFILE_FIELDS, fillPlaceholders } from '../../src/lib/site-profile-fields';
import { LEGAL_DOCUMENTS } from '../legal-content';

/**
 * Сторож правовых текстов-образцов (docs/03 п.11.3).
 *
 * Опечатка в метке ({{owner.nipp}}) на сайте видна как «не заполнено»
 * даже после того, как владелец всё заполнил. Здесь она ловится сразу.
 */

const allFilled = Object.fromEntries(PROFILE_FIELDS.map((field) => [field.key, 'значение']));

function textsOf(doc: (typeof LEGAL_DOCUMENTS)[number]): string[] {
  return [
    doc.title,
    ...doc.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.items ?? []),
    ]),
  ];
}

describe('правовые тексты', () => {
  it.each(LEGAL_DOCUMENTS.map((doc) => [`${doc.slug}/${doc.locale}`, doc] as const))(
    '%s: все метки — известные поля профиля',
    (_, doc) => {
      const missing = textsOf(doc)
        .flatMap((text) => fillPlaceholders(text, allFilled))
        .filter((part) => part.kind === 'missing');
      expect(missing).toEqual([]);
    }
  );

  it('у каждого документа есть польская версия — она основная', () => {
    const slugs = new Set(LEGAL_DOCUMENTS.map((doc) => doc.slug));
    for (const slug of slugs) {
      expect(LEGAL_DOCUMENTS.some((doc) => doc.slug === slug && doc.locale === 'pl')).toBe(true);
    }
  });

  it('языковые версии одного документа — одной редакции и с одинаковым числом разделов', () => {
    const bySlug = Map.groupBy(LEGAL_DOCUMENTS, (doc) => doc.slug);
    for (const docs of bySlug.values()) {
      const pl = docs.find((doc) => doc.locale === 'pl');
      for (const doc of docs) {
        expect(doc.version).toBe(pl?.version);
        expect(doc.sections).toHaveLength(pl?.sections.length ?? 0);
      }
    }
  });
});
