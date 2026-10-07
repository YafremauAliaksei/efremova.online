import 'server-only';
import { db } from '@/lib/db';
import { isLocale, type Locale } from '@/lib/i18n';

/**
 * Отзывы для сайта: только показанные и только с датой согласия. Второе
 * условие гарантирует и база (CHECK), здесь оно повторено, чтобы чтение
 * не зависело от того, на месте ли ограничение.
 */

export interface PublicTestimonial {
  id: string;
  authorAlias: string;
  body: string;
  /** Язык текста: отзыв не переводится, у него свой lang */
  locale: Locale;
}

export async function getTestimonials(take?: number): Promise<PublicTestimonial[]> {
  try {
    const rows = await db.testimonial.findMany({
      where: { isPublished: true, consentAt: { not: null } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, authorAlias: true, body: true, locale: true },
      ...(take === undefined ? {} : { take }),
    });
    return rows.map((row) => ({ ...row, locale: isLocale(row.locale) ? row.locale : 'ru' }));
  } catch {
    // База недоступна — без отзывов, но страница на месте
    return [];
  }
}
